// Room model & occupancy grid (spec 01 §3) — the single source of truth for
// the cafe's layout. Pure TypeScript; knows nothing about Phaser or JSON files
// (item metadata arrives through the FootprintItem/ItemCatalog interfaces).

import { Emitter } from '../events';
import { DIRS, DIR_DELTA, EngineError, tileEq, type Dir, type Tile } from '../types';

export type PlacementId = string; // 'p_' + monotonic counter, stable across save/load
export type WallDecorId = string; // 'w_' + monotonic counter (same persisted counter)
export type WallSide = 'left' | 'right';
export type Rot = 0 | 1; // 1 = 90°, swaps footprint w/h

/** Item metadata the grid needs; the gameplay layer builds these from furniture.json. */
export interface FootprintItem {
  itemId: string;
  kind: string; // furniture.json typeLabel: stove/chair/table/counter/sink/fridge/decor/pot/...
  w: number;
  h: number;
}

/** Resolves itemId -> metadata during deserialize; unknown ids are evicted to storage. */
export type ItemCatalog = (itemId: string) => FootprintItem | null;

export interface Cell {
  floorId: string;
  occupantId: PlacementId | null;
}

export interface Placement {
  id: PlacementId;
  itemId: string;
  kind: string;
  anchor: Tile; // min-corner; footprint covers [ax, ax+w) x [ay, ay+h)
  rot: Rot;
  footprint: { w: number; h: number }; // rot-resolved
}

export interface WallDecorPlacement {
  id: WallDecorId;
  itemId: string;
  side: WallSide;
  index: number;
  span: number;
}

export interface Seat {
  chairId: PlacementId;
  tile: Tile;
  tableId: PlacementId;
  facing: Dir; // toward the adjacent table
}

export type PlaceCheck = { ok: true } | { ok: false; reason: 'oob' | 'occupied' | 'door' | 'character' };
export type RemovalCheck = { ok: true } | { ok: false; reason: string };

export interface GridEvents extends Record<string, unknown> {
  placed: { placement: Placement };
  removed: { placement: Placement };
  moved: { placement: Placement; from: Tile };
  floorSkin: { tile: Tile; floorId: string };
  wallSkin: { side: WallSide; index: number; wallId: string };
  wallDecorPlaced: { decor: WallDecorPlacement };
  wallDecorRemoved: { decor: WallDecorPlacement };
  door: { tile: Tile };
  expanded: { w: number; h: number };
}

export interface LayoutSchema {
  layoutRev: 1;
  w: number;
  h: number;
  expansionTier: number;
  door: { x: number; y: number };
  floors: string[]; // row-major w*h floor ids
  wallsRight: string[];
  wallsLeft: string[];
  wallDecor: { id: string; itemId: string; side: WallSide; index: number; span: number }[];
  placements: { id: string; itemId: string; x: number; y: number; rot: Rot }[];
  storage: { itemId: string; count: number }[];
  idCounter: number; // persisted so ids never collide after load
}

export interface RepairRecord {
  kind:
    | 'placement-evicted'
    | 'wallDecor-evicted'
    | 'door-relocated'
    | 'floors-resized'
    | 'walls-resized'
    | 'idCounter-raised';
  detail: string;
}

export const FLOOR_DEFAULT = 'floor_default';
export const WALL_DEFAULT = 'wall_default';

const STARTER_W = 7;
const STARTER_H = 8;

export function starterLayout(): LayoutSchema {
  return {
    layoutRev: 1,
    w: STARTER_W,
    h: STARTER_H,
    expansionTier: 0,
    door: { x: Math.floor(STARTER_W / 2), y: STARTER_H - 1 },
    floors: new Array(STARTER_W * STARTER_H).fill(FLOOR_DEFAULT),
    wallsRight: new Array(STARTER_W).fill(WALL_DEFAULT),
    wallsLeft: new Array(STARTER_H).fill(WALL_DEFAULT),
    wallDecor: [],
    placements: [],
    storage: [],
    idCounter: 0,
  };
}

export class CafeGrid {
  readonly events = new Emitter<GridEvents>();
  version = 0; // ++ on ANY mutation; walkers watch this

  private _w: number;
  private _h: number;
  private _expansionTier: number;
  private cells: Cell[]; // row-major: index = ty * w + tx
  private wallsRight: string[];
  private wallsLeft: string[];
  private wallDecorById = new Map<WallDecorId, WallDecorPlacement>();
  private placementsById = new Map<PlacementId, Placement>();
  private _door: Tile;
  private idCounter: number;
  private storage = new Map<string, number>(); // itemId -> count (removed items land here)
  private removalGuard: ((id: PlacementId) => RemovalCheck) | null = null;
  /** Optional live-character probe: canPlace returns 'character' when any covered cell has one. */
  private characterProbe: ((t: Tile) => boolean) | null = null;

  constructor(layout: LayoutSchema, catalog: ItemCatalog) {
    this._w = layout.w;
    this._h = layout.h;
    this._expansionTier = layout.expansionTier;
    this.cells = layout.floors.map((floorId) => ({ floorId, occupantId: null }));
    this.wallsRight = [...layout.wallsRight];
    this.wallsLeft = [...layout.wallsLeft];
    this._door = { tx: layout.door.x, ty: layout.door.y };
    this.idCounter = layout.idCounter;
    for (const s of layout.storage) this.storage.set(s.itemId, s.count);
    for (const p of layout.placements) {
      const item = catalog(p.itemId);
      if (!item) throw new EngineError('unknown-item', `unknown itemId ${p.itemId} (use deserialize() for sanitizing load)`);
      this.placeInternal(item, { tx: p.x, ty: p.y }, p.rot, p.id);
    }
    for (const d of layout.wallDecor) {
      this.wallDecorById.set(d.id, { ...d });
    }
  }

  static starter(catalog: ItemCatalog): CafeGrid {
    return new CafeGrid(starterLayout(), catalog);
  }

  get w(): number {
    return this._w;
  }
  get h(): number {
    return this._h;
  }
  get expansionTier(): number {
    return this._expansionTier;
  }

  // ── queries ────────────────────────────────────────────────────────────────

  inBounds(t: Tile): boolean {
    return t.tx >= 0 && t.ty >= 0 && t.tx < this._w && t.ty < this._h;
  }

  walkable(t: Tile): boolean {
    return this.inBounds(t) && this.cells[t.ty * this._w + t.tx].occupantId === null;
  }

  cellAt(t: Tile): Readonly<Cell> {
    if (!this.inBounds(t)) throw new EngineError('oob', `cellAt out of bounds (${t.tx},${t.ty})`);
    return this.cells[t.ty * this._w + t.tx];
  }

  placementAt(t: Tile): Placement | null {
    if (!this.inBounds(t)) return null;
    const id = this.cells[t.ty * this._w + t.tx].occupantId;
    return id ? (this.placementsById.get(id) ?? null) : null;
  }

  placements(): ReadonlyMap<PlacementId, Placement> {
    return this.placementsById;
  }

  wallDecor(): ReadonlyMap<WallDecorId, WallDecorPlacement> {
    return this.wallDecorById;
  }

  wallSkin(side: WallSide, index: number): string {
    const arr = side === 'right' ? this.wallsRight : this.wallsLeft;
    return arr[index] ?? WALL_DEFAULT;
  }

  storageContents(): ReadonlyMap<string, number> {
    return this.storage;
  }

  door(): Tile {
    return { ...this._door };
  }

  /** Walkable 4-neighbors of the footprint perimeter — where actors stand to use it. */
  interactionCells(id: PlacementId): Tile[] {
    const p = this.placementsById.get(id);
    if (!p) return [];
    const out: Tile[] = [];
    const seen = new Set<number>();
    for (let dx = 0; dx < p.footprint.w; dx++) {
      for (let dy = 0; dy < p.footprint.h; dy++) {
        const cell = { tx: p.anchor.tx + dx, ty: p.anchor.ty + dy };
        for (const dir of DIRS) {
          const n = { tx: cell.tx + DIR_DELTA[dir].tx, ty: cell.ty + DIR_DELTA[dir].ty };
          const key = n.ty * 4096 + n.tx;
          if (seen.has(key)) continue;
          seen.add(key);
          if (this.walkable(n)) out.push(n);
        }
      }
    }
    return out;
  }

  /** Chairs orthogonally adjacent to a table footprint (original: pairs cap throughput). */
  seats(): Seat[] {
    const out: Seat[] = [];
    for (const p of this.placementsById.values()) {
      if (p.kind !== 'chair') continue;
      for (const dir of DIRS) {
        const n = { tx: p.anchor.tx + DIR_DELTA[dir].tx, ty: p.anchor.ty + DIR_DELTA[dir].ty };
        const adj = this.placementAt(n);
        if (adj && adj.kind === 'table') {
          out.push({ chairId: p.id, tile: { ...p.anchor }, tableId: adj.id, facing: dir });
          break; // one seat per chair; first table in canonical DIRS order wins
        }
      }
    }
    return out;
  }

  // ── sim-state guard ────────────────────────────────────────────────────────

  setRemovalGuard(guard: (id: PlacementId) => RemovalCheck): void {
    this.removalGuard = guard;
  }

  canRemove(id: PlacementId): RemovalCheck {
    if (!this.placementsById.has(id)) return { ok: false, reason: 'not-found' };
    return this.removalGuard ? this.removalGuard(id) : { ok: true };
  }

  setCharacterProbe(probe: (t: Tile) => boolean): void {
    this.characterProbe = probe;
  }

  // ── mutation ───────────────────────────────────────────────────────────────

  canPlace(item: FootprintItem, anchor: Tile, rot: Rot, ignoreId?: PlacementId): PlaceCheck {
    const w = rot === 1 ? item.h : item.w;
    const h = rot === 1 ? item.w : item.h;
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        const t = { tx: anchor.tx + dx, ty: anchor.ty + dy };
        if (!this.inBounds(t)) return { ok: false, reason: 'oob' };
        if (tileEq(t, this._door)) return { ok: false, reason: 'door' };
        const occ = this.cells[t.ty * this._w + t.tx].occupantId;
        if (occ !== null && occ !== ignoreId) return { ok: false, reason: 'occupied' };
        if (this.characterProbe?.(t)) return { ok: false, reason: 'character' };
      }
    }
    return { ok: true };
  }

  place(item: FootprintItem, anchor: Tile, rot: Rot): PlacementId {
    const check = this.canPlace(item, anchor, rot);
    if (!check.ok) throw new EngineError('place-invalid', `cannot place ${item.itemId}: ${check.reason}`);
    const id = this.placeInternal(item, anchor, rot);
    this.bump();
    this.events.emit('placed', { placement: this.placementsById.get(id)! });
    return id;
  }

  /** Non-destructive: the item goes to Storage (the only destination — no sell path). */
  remove(id: PlacementId): Placement {
    const guard = this.canRemove(id);
    if (!guard.ok) throw new EngineError('remove-blocked', guard.reason);
    const p = this.placementsById.get(id)!;
    this.clearFootprint(p);
    this.placementsById.delete(id);
    this.storage.set(p.itemId, (this.storage.get(p.itemId) ?? 0) + 1);
    this.bump();
    this.events.emit('removed', { placement: p });
    return p;
  }

  /** ID-PRESERVING move: downstream references (stoveId, seatId...) survive a nudge. */
  moveItem(id: PlacementId, anchor: Tile, rot: Rot): boolean {
    const p = this.placementsById.get(id);
    if (!p) return false;
    const item: FootprintItem = { itemId: p.itemId, kind: p.kind, w: p.rot === 1 ? p.footprint.h : p.footprint.w, h: p.rot === 1 ? p.footprint.w : p.footprint.h };
    const check = this.canPlace(item, anchor, rot, id);
    if (!check.ok) return false;
    const from = { ...p.anchor };
    this.clearFootprint(p);
    p.anchor = { ...anchor };
    p.rot = rot;
    p.footprint = { w: rot === 1 ? item.h : item.w, h: rot === 1 ? item.w : item.h };
    this.stampFootprint(p);
    this.bump();
    this.events.emit('moved', { placement: p, from });
    return true;
  }

  /** Pull one unit of itemId out of Storage (throws if none) — pairs with place(). */
  takeFromStorage(itemId: string): void {
    const n = this.storage.get(itemId) ?? 0;
    if (n <= 0) throw new EngineError('storage-empty', `no ${itemId} in storage`);
    if (n === 1) this.storage.delete(itemId);
    else this.storage.set(itemId, n - 1);
  }

  addToStorage(itemId: string, count = 1): void {
    this.storage.set(itemId, (this.storage.get(itemId) ?? 0) + count);
  }

  setFloorSkin(t: Tile, floorId: string): void {
    if (!this.inBounds(t)) throw new EngineError('oob', `setFloorSkin out of bounds`);
    this.cells[t.ty * this._w + t.tx].floorId = floorId;
    this.bump();
    this.events.emit('floorSkin', { tile: { ...t }, floorId });
  }

  setWallSkin(side: WallSide, index: number, wallId: string): void {
    const arr = side === 'right' ? this.wallsRight : this.wallsLeft;
    if (index < 0 || index >= arr.length) throw new EngineError('oob', `wall index ${index} out of range`);
    arr[index] = wallId;
    this.bump();
    this.events.emit('wallSkin', { side, index, wallId });
  }

  placeWallDecor(itemId: string, side: WallSide, index: number, span: number): WallDecorId {
    const len = side === 'right' ? this._w : this._h;
    if (index < 0 || index + span > len) throw new EngineError('oob', 'wallDecor outside wall');
    for (const d of this.wallDecorById.values()) {
      if (d.side === side && index < d.index + d.span && d.index < index + span)
        throw new EngineError('occupied', 'wallDecor sections double-booked');
    }
    const id: WallDecorId = `w_${++this.idCounter}`;
    const decor: WallDecorPlacement = { id, itemId, side, index, span };
    this.wallDecorById.set(id, decor);
    this.bump();
    this.events.emit('wallDecorPlaced', { decor });
    return id;
  }

  removeWallDecor(id: WallDecorId): void {
    const d = this.wallDecorById.get(id);
    if (!d) return;
    this.wallDecorById.delete(id);
    this.storage.set(d.itemId, (this.storage.get(d.itemId) ?? 0) + 1);
    this.bump();
    this.events.emit('wallDecorRemoved', { decor: d });
  }

  /** Door must sit on a front edge (tx = w-1 or ty = h-1) and be unoccupied. */
  setDoor(t: Tile): void {
    if (!this.inBounds(t) || !(t.tx === this._w - 1 || t.ty === this._h - 1))
      throw new EngineError('door-invalid', 'door must be on a front edge');
    if (this.cells[t.ty * this._w + t.tx].occupantId !== null)
      throw new EngineError('door-invalid', 'door tile is occupied');
    this._door = { ...t };
    this.bump();
    this.events.emit('door', { tile: { ...t } });
  }

  /** Square-step expansion; preserves all state, pads new floors/walls with defaults. */
  expand(newW: number, newH: number): void {
    if (newW < this._w || newH < this._h) throw new EngineError('expand-invalid', 'room cannot shrink');
    if (newW === this._w && newH === this._h) return;
    const next: Cell[] = new Array(newW * newH);
    for (let ty = 0; ty < newH; ty++) {
      for (let tx = 0; tx < newW; tx++) {
        next[ty * newW + tx] =
          tx < this._w && ty < this._h ? this.cells[ty * this._w + tx] : { floorId: FLOOR_DEFAULT, occupantId: null };
      }
    }
    this.cells = next;
    while (this.wallsRight.length < newW) this.wallsRight.push(WALL_DEFAULT);
    while (this.wallsLeft.length < newH) this.wallsLeft.push(WALL_DEFAULT);
    this._w = newW;
    this._h = newH;
    this._expansionTier++;
    // The old door edge is interior now; keep its tx, snap to the new front edge.
    if (!(this._door.tx === newW - 1 || this._door.ty === newH - 1)) {
      const candidate = { tx: this._door.tx, ty: newH - 1 };
      this._door = this.cells[candidate.ty * newW + candidate.tx].occupantId === null
        ? candidate
        : { tx: Math.floor(newW / 2), ty: newH - 1 };
    }
    this.bump();
    this.events.emit('expanded', { w: newW, h: newH });
  }

  // ── persistence ────────────────────────────────────────────────────────────

  serialize(): LayoutSchema {
    return {
      layoutRev: 1,
      w: this._w,
      h: this._h,
      expansionTier: this._expansionTier,
      door: { x: this._door.tx, y: this._door.ty },
      floors: this.cells.map((c) => c.floorId),
      wallsRight: [...this.wallsRight],
      wallsLeft: [...this.wallsLeft],
      wallDecor: [...this.wallDecorById.values()].map((d) => ({ ...d })),
      placements: [...this.placementsById.values()].map((p) => ({
        id: p.id,
        itemId: p.itemId,
        x: p.anchor.tx,
        y: p.anchor.ty,
        rot: p.rot,
      })),
      storage: [...this.storage.entries()].map(([itemId, count]) => ({ itemId, count })),
      idCounter: this.idCounter,
    };
  }

  /**
   * Sanitizing load (spec 01 §10.5): never throws on bad-but-parseable data.
   * Repairs are reported, evicted items land in storage, nothing is deleted.
   */
  static deserialize(l: LayoutSchema, catalog: ItemCatalog): { grid: CafeGrid; repairs: RepairRecord[] } {
    const repairs: RepairRecord[] = [];
    const w = Math.max(1, l.w | 0);
    const h = Math.max(1, l.h | 0);

    const floors = [...(l.floors ?? [])];
    if (floors.length !== w * h) {
      repairs.push({ kind: 'floors-resized', detail: `floors ${floors.length} -> ${w * h}` });
      floors.length = Math.min(floors.length, w * h);
      while (floors.length < w * h) floors.push(FLOOR_DEFAULT);
    }
    const fixWalls = (arr: string[] | undefined, len: number, side: string): string[] => {
      const out = [...(arr ?? [])];
      if (out.length !== len) {
        repairs.push({ kind: 'walls-resized', detail: `${side} walls ${out.length} -> ${len}` });
        out.length = Math.min(out.length, len);
        while (out.length < len) out.push(WALL_DEFAULT);
      }
      return out;
    };

    const base: LayoutSchema = {
      layoutRev: 1,
      w,
      h,
      expansionTier: l.expansionTier ?? 0,
      door: l.door ?? { x: Math.floor(w / 2), y: h - 1 },
      floors,
      wallsRight: fixWalls(l.wallsRight, w, 'right'),
      wallsLeft: fixWalls(l.wallsLeft, h, 'left'),
      wallDecor: [],
      placements: [],
      storage: [...(l.storage ?? [])],
      idCounter: l.idCounter ?? 0,
    };
    const grid = new CafeGrid(base, catalog);

    // Door validity (must be front edge + will stay unoccupied since no placements yet).
    if (!grid.inBounds(grid._door) || !(grid._door.tx === w - 1 || grid._door.ty === h - 1)) {
      repairs.push({ kind: 'door-relocated', detail: `door (${grid._door.tx},${grid._door.ty}) -> default` });
      grid._door = { tx: Math.floor(w / 2), ty: h - 1 };
    }

    // Replay placements through validation; failures evict to storage.
    let maxId = 0;
    for (const p of l.placements ?? []) {
      const m = /^p_(\d+)$/.exec(p.id);
      if (m) maxId = Math.max(maxId, parseInt(m[1], 10));
      const item = catalog(p.itemId);
      const check = item ? grid.canPlace(item, { tx: p.x, ty: p.y }, p.rot) : ({ ok: false, reason: 'unknown-item' } as const);
      if (item && check.ok) {
        grid.placeInternal(item, { tx: p.x, ty: p.y }, p.rot, p.id);
      } else {
        repairs.push({ kind: 'placement-evicted', detail: `${p.itemId}@(${p.x},${p.y}): ${item ? (check as { reason: string }).reason : 'unknown-item'}` });
        grid.storage.set(p.itemId, (grid.storage.get(p.itemId) ?? 0) + 1);
      }
    }
    // Wall decor with range/double-book validation.
    for (const d of l.wallDecor ?? []) {
      const m = /^w_(\d+)$/.exec(d.id);
      if (m) maxId = Math.max(maxId, parseInt(m[1], 10));
      const len = d.side === 'right' ? w : h;
      const overlaps = [...grid.wallDecorById.values()].some(
        (e) => e.side === d.side && d.index < e.index + e.span && e.index < d.index + d.span,
      );
      if (d.index >= 0 && d.index + d.span <= len && !overlaps) {
        grid.wallDecorById.set(d.id, { ...d });
      } else {
        repairs.push({ kind: 'wallDecor-evicted', detail: `${d.itemId}@${d.side}:${d.index}` });
        grid.storage.set(d.itemId, (grid.storage.get(d.itemId) ?? 0) + 1);
      }
    }
    if (grid.idCounter < maxId) {
      repairs.push({ kind: 'idCounter-raised', detail: `${grid.idCounter} -> ${maxId}` });
      grid.idCounter = maxId;
    }
    return { grid, repairs };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private placeInternal(item: FootprintItem, anchor: Tile, rot: Rot, forcedId?: PlacementId): PlacementId {
    const id: PlacementId = forcedId ?? `p_${++this.idCounter}`;
    const p: Placement = {
      id,
      itemId: item.itemId,
      kind: item.kind,
      anchor: { ...anchor },
      rot,
      footprint: { w: rot === 1 ? item.h : item.w, h: rot === 1 ? item.w : item.h },
    };
    this.placementsById.set(id, p);
    this.stampFootprint(p);
    return id;
  }

  private stampFootprint(p: Placement): void {
    for (let dx = 0; dx < p.footprint.w; dx++)
      for (let dy = 0; dy < p.footprint.h; dy++)
        this.cells[(p.anchor.ty + dy) * this._w + (p.anchor.tx + dx)].occupantId = p.id;
  }

  private clearFootprint(p: Placement): void {
    for (let dx = 0; dx < p.footprint.w; dx++)
      for (let dy = 0; dy < p.footprint.h; dy++)
        this.cells[(p.anchor.ty + dy) * this._w + (p.anchor.tx + dx)].occupantId = null;
  }

  private bump(): void {
    this.version++;
  }
}
