# Tile-Based Isometric Engine Foundation (src/engine/ + src/view/)

> Status: **revised after adversarial review** — where this conflicts with `00-canon.md`, canon wins.

# SPEC: Tile-Based Isometric Engine Foundation

**System:** `src/engine/` (pure TypeScript, no Phaser) + `src/view/` (Phaser adapters)
**Status:** Implementation-ready, **rev 2 after hostile review**. Owner priority #1 — every other system builds on this.
**Sources of truth:** `/home/user/zombie-cafe-game/CLAUDE.md` (charter, pillars), the original-game research (`original_game_research.json`, dimension "Cafe expansion, decoration, layout" + "Cooking … serving"), current code under `/home/user/zombie-cafe-game/src/`, legacy API reference `legacy-unity/Assets/_Game/Scripts/Cafe/GridManager.cs`.

---

## 0. Canon & authority map (added in rev 2 — read first)

The review's dominant finding was constants restated across specs. This section is the fix's engine half: it declares exactly what this spec **owns** (other specs cite by reference, never restate) and what it **defers** (this spec cites by reference, never restates).

### 0.1 This spec is the single authority for

| Constant / contract | Canonical value / location |
|---|---|
| Tile metrics | `TILE_W=128, TILE_H=64` (§2.1) — the Build Order's M1 "64×32" is superseded and must be patched to reference §2.1 |
| Wall geometry | `WALL_H=192`, section canvas 64×224 @1x / 128×448 @2x, one section per tile edge (§2.5) — Presentation §3/§4.2's 160px/128-wide values are superseded |
| Door placement rule | Front edge (§3.2, decision logged in §0.3) |
| Depth bands & sort keys | §5 — `FX_WORLD=9000`, `entityDepth = BAND.ENTITY + key*16 + bias`. Build Order's `key*10`/`FX=8000` superseded |
| Movement model | 4-connected, no diagonals, anywhere in the game (§4.1). Build Order M2's "diagonal with corner-cut prevention" is superseded; Raids' melee "Chebyshev adjacency matching the shared A*'s corner-cut rules" must be restated as *8-neighbor attack range, not pathing* — the shared A* has no corner-cut rules to match |
| Actor speeds | `src/engine/move/speed.ts` (§6.3) — the ONE speed module. All four rival formulas (old engine `0.44·baseSpeed`, service `baseSpeed·0.6`, raids `baseSpeed·0.56`, service customer `2.0/2.6` vs engine `1.1`) are replaced by this module; Service §8.5 round-trip math and Raid TTK tables must be regenerated from it |
| Camera clamps & input thresholds | §8 (`ZOOM_MIN=0.4, ZOOM_MAX=2.0`, default-fit floor `0.75`, tap-vs-pan `8px`) |
| Grid/walker event names & payloads | §9.1 — engine events are registered verbatim in the shared events registry (Build Order appendix `events.d.ts`); consumers may add events, never rename these |
| Engine module contracts | `src/engine/contracts.ts` (§9.3) — the *real* signatures. Service/staff/raid specs must import these names (`walkable(t: Tile)`, `findPath(...): PathResult`, `door(): Tile`, `placements()`), not their previously-invented `src/iso/` variants |
| Starter layout | `src/engine/grid/starterLayout.ts` → committed `starterLayout.json` (§10.2), CI-validated against service-loop invariants |
| Layout save shape + layout sanitizer | §10.3 / §10.5 |

**Enforcement:** all numeric constants above are exported from **`src/engine/IsoConfig.ts`** (one file). A CI test asserts `Tools/artconfig.json` deep-equals the relevant `IsoConfig` exports (AC-21), and a docs lint greps sibling specs for hard-coded restatements of `128|64|192|224` tile/wall literals outside a `IsoConfig §ref` citation (advisory, part of the cross-spec `canon.md` check the reconciliation pass introduces).

### 0.2 This spec defers to

| Concern | Owner |
|---|---|
| Save version integers & migration ordering | **Build Order's save ledger** (`docs/spec/save-ledger.md`). This spec no longer claims "save v2" — see §10.3. Brains→toxin mapping, version numbering: ledger only |
| Expansion **pricing, level gates, purchase UX** | Progression spec, reading the single `src/data/expansion.json` this spec's geometry conforms to (§3.4) |
| Tuning values (starting cash/toxin, spawn intervals, streaks) | `src/sim/tuning.ts` canon file (simulation-core spec). The engine ships zero economy numbers |
| Rating, XP, dish data, time-scale for energy/serving | Rating canon / Progression / simulation-core. The engine has **no dependency** on any of them |
| Offline settlement & live-catchup routing | The unified **OfflineEngine** spec (simulation-core). The engine states only its contract: §6.4 |
| Character art production strategy | Presentation spec (paper-doll rig). §11's character row is amended accordingly |
| Zombie stat derivation (Speed 1–12 etc.) | Infection/staff spec `StaffStats.ts`. The engine consumes the stat, owns the stat→tiles/sec mapping |

### 0.3 Decisions logged in this revision

1. **Door on a front edge** (`tx = W−1` or `ty = H−1`). The research is *silent* on door placement (verified: no door/entrance/entry mention in the layout dimension). Two reviewers ruled in opposite directions, each claiming fidelity. Decision: **front edge**, because (a) the engine's spawn/walk-in math, starter layout, and AC suite are derived from it; (b) an open-front diorama with customers entering toward the camera reads correctly at every zoom and never hides the arrival moment behind furniture; (c) it keeps the two back walls fully available as the wall-decor surface the research *does* attest ("wall decor hangs on those walls"). Presentation's "door as NE back-wall piece" paragraph is deleted; the door asset is a front-edge **door mat + frame** per §11. If period screenshots later surface showing a back-wall door, flipping is a contained change: `setDoor` validation, starter door tile, spawn normal, door art anchor — all listed in §3.2. **Owner-visible decision; recorded in the project decision log.**
2. **Square-room deviation, logged:** the research says the cafe "is always a SQUARE room" *and* that the cap grew to 17×16 — internally near-square at the endpoint. We start at 7×8 (near-square, sized to the current slice) and end at the researched 17×16; intermediate tiers are true squares. Deviation magnitude: two endpoint tiers differ from perfect squares by one row.
3. **Storage-only removal is an engine-level contract** (research commonly-missed list: "Removed items go to an UNLIMITED Storage tab, not sold for a refund"). The engine has no sell path and never will; §7's former `sellValue` hook is deleted. The 0-cash soft-lock this hardens is solved by the service loop's Union-Rep pity grant, *not* by reintroducing selling (see Review notes #3).
4. **Exterior/outdoor decor** (researched Special-tab content) is **deferred, not forgotten**: the v1 engine room model is interior-only. The layout schema reserves an optional `exterior` field (unused, absent by default) so a future "front apron" strip of off-room decor tiles beyond the front edges can land without a schema break. Logged as a deviation until then.

---

## 1. Design goals & fidelity notes

### Goals

1. **One authoritative coordinate system.** Every subsystem — rendering, picking, placement, pathfinding, depth — imports the same `IsoMath`/`IsoConfig`. No second projection ever.
2. **CafeGrid as single source of truth** for room shape, floor skins, wall skins, wall decor, furniture placements, walkability, and the door. Views render it; they never own state.
3. **Authentic Zombie Cafe behavior:** square-ish tile room in a diorama view showing the floor grid AND two back walls; floors painted per-tile; walls per-section; furniture snaps to tiles with real footprints; servers route via A* and **freeze motionless when the path is blocked**; slow shambling locomotion; prerequisite-locked expansion to 17×16; non-destructive removal to Storage.
4. **Pure-TS engine, test-first.** `src/engine/` has zero Phaser imports (charter mandate, CLAUDE.md:44-45,61), runs under vitest in Node in <1s, and is deterministic (fixed neighbor order, stable heap tie-breaks, seeded RNG). Determinism + dt-injection is also the project's **test-time acceleration mechanism** (§6.1): tests and Playwright harnesses step the sim with synthetic dt/clock values; there is no global time-scale constant to delete because the engine never had one.
5. **Performance for the endgame room:** 17×16 = 272 floor tiles + 33 wall sections + dozens of furniture + 12+ walkers at 60fps on mid-range mobile. Static layers bake to RenderTextures; per-frame work touches only moving entities. (How this is *verified* changed in rev 2 — see AC-19/AC-20.)

### Fidelity vs the original (what we match / what we modernize)

| Aspect | Original (research) | This spec |
|---|---|---|
| Room shape | Single square room, tile grid, prerequisite-locked expansion; later cap 17×16 (~272 tiles) | 7×8 start → 17×16 max via `src/data/expansion.json` (§3.4); endpoint near-square deviation logged (§0.3.2) |
| View | Iso/oblique diorama: floor grid + two back walls visible | Identical: 2:1 diamond projection, two back-wall planes (§2) |
| Floors / walls | Bought & painted per single TILE / per wall SECTION; pure cosmetic | Identical: `setFloorSkin(tile)`, `setWallSkin(side, index)` (§3.2) |
| Wall decor | Hangs on the two back walls, separate purchase axis | Wall-decor slots on wall sections, no floor occupancy (§3.2) |
| Server pathing | "Need a clear walking path to every table/counter/sink or they stand motionless" | A* + `blocked` state + auto-resume on grid change (§4) |
| Movement | "Moves as slowly as the shuffling undead"; tap-to-dispatch | Per-tile 4-dir walkers, one speed module (§6.3), dispatch API (§6) |
| Removal | Items go to unlimited Storage, never destroyed | `remove()` returns item to storage; **no sell path exists at engine level** (§7) |
| Camera | Fixed-ish 2011 phone view | **Modernized:** drag-pan + pinch/wheel zoom, clamped to room; DPR-aware (§8). Usability-only change, allowed by Pillar 1 |
| Placement UX | Drag-place, 2011 touch | **Modernized:** ghost preview with validity tint **plus check/cross glyphs** (color-independent), confirm/cancel, rotate (§7) |
| Door | Not attested in research | Front edge, decision logged (§0.3.1) |

**Non-goals of this spec:** dish economy, infection costs, energy, star rating, store UI content, offline settlement policy (all separate specs that *consume* this engine). Rev 2 removes the old claim that `DEMO_TIME_SCALE` is "orthogonal and untouched": that constant (config.ts:18) is **deleted by the simulation-core spec**; the engine never reads it, and never may. Engine locomotion runs on injected real dt only.

---

## 2. Coordinate system (`src/engine/iso/IsoMath.ts` + `src/engine/IsoConfig.ts`)

### 2.1 Constants (logical pixels at zoom 1.0) — THE canon

```ts
// src/engine/IsoConfig.ts — the single place these numbers exist in the repo.
// Tools/artconfig.json is generated from / CI-checked against these exports (AC-21).
export const TILE_W = 128;         // full diamond width
export const TILE_H = 64;          // full diamond height (2:1)
export const HALF_W = 64;
export const HALF_H = 32;
export const WALL_H = 192;         // back-wall height above the floor line (3 "tile heights")
export const WALL_SECTION_W = 64;  // one tile edge projects to exactly 64px horizontally
export const WALL_SECTION_H = 224; // 32 base rise + 192 wall height
export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 2.0;
export const DEFAULT_FIT_ZOOM_FLOOR = 0.75;
export const TAP_VS_PAN_PX = 8;
export const CAMERA_MARGIN_PX = 96;
```

The Build Order M1 tuning table and Presentation's `Tools/artconfig.json` **reference these by key**; any restated literal is a review-blocking defect. The Presentation spec's `WALL_H=160` / 128-wide section canvases are superseded: a section spans one tile edge, and one tile edge projects to exactly 64 horizontal px in the 128×64 system — a 128-wide section is geometrically wrong (it would span two edges). Presentation must re-derive its wall-asset canvases (64×224 @1x, 128×448 @2x) and any roomBounds/camera worked examples from `IsoConfig` **before any wall art is generated**.

### 2.2 Spaces and conventions

- **Tile space** `(fx, fy)` — continuous floats. **Integer coordinates are diamond CENTERS**: tile `(tx, ty)` occupies the unit square `[tx−0.5, tx+0.5] × [ty−0.5, ty+0.5]` in tile space, which projects to its screen diamond. Picking is a `Math.round`; sub-tile walker interpolation is trivial.
- **World space** `(wx, wy)` — logical pixels. Origin = **center of tile (0,0)**. +X screen-right, +Y screen-down.
- **Screen space** — Phaser's camera output. The engine never touches it; the view uses `pointer.worldX/worldY` (Phaser's exact camera inverse) then calls `worldToTile`. Zero drift at any zoom by construction.
- **Axis orientation:** `+tx` runs toward screen **lower-right (SE)**; `+ty` toward screen **lower-left (SW)**. Tile (0,0) is the **back corner** where the two walls meet. Row `ty=0` runs along the right back wall; column `tx=0` along the left back wall. Front (screen-bottom) corner is tile `(W−1, H−1)`.

### 2.3 Exact transforms

```ts
// tile -> world (works for continuous fx, fy)
export function tileToWorld(fx: number, fy: number): Vec2 {
  return { x: (fx - fy) * HALF_W, y: (fx + fy) * HALF_H };
}

// world -> continuous tile coords (exact algebraic inverse)
export function worldToTileF(wx: number, wy: number): Vec2 {
  return { x: wx / TILE_W + wy / TILE_H, y: wy / TILE_H - wx / TILE_W };
}

// world -> integer tile (diamond picking). round(), NOT floor(), because
// integers are centers: the diamond is exactly the rounding cell.
export function worldToTile(wx: number, wy: number): Tile {
  const f = worldToTileF(wx, wy);
  return { tx: Math.round(f.x), ty: Math.round(f.y) };
}
```

Derived corner positions of tile `(tx,ty)` (center `C = tileToWorld(tx,ty)`):
top `C + (0, −32)`, right `C + (+64, 0)`, bottom `C + (0, +32)`, left `C + (−64, 0)`.

### 2.4 Room geometry (W×H room)

```ts
export function roomBounds(w: number, h: number): AABB {
  return {                                     // world-space AABB incl. walls
    minX: -HALF_W * (h + 1) + HALF_W,          // = -64*h  (left corner of tile (0,h-1))
    maxX:  HALF_W * (w + 1) - HALF_W,          // = +64*w  (right corner of (w-1,0))
    minY: -HALF_H - WALL_H,                    // = -224   (top of walls above tile (0,0))
    maxY:  HALF_H * (w + h) - HALF_H + HALF_H, // = 32*(w+h) (bottom corner of (w-1,h-1))
  };
}
```
17×16 endgame room ⇒ world extent 2112 × 1280 px. (Presentation's world-size math already assumed 17×16 — confirmed consistent.)

### 2.5 Wall section placement math — THE wall canon

One wall **section per tile edge** along the two back edges.

- **Right wall** (behind row `ty=0`), sections `k = 0..W−1`. Section k's base runs from tile (k,0)'s **top corner** `(64k, 32k−32)` down-right to its **right corner** `(64k+64, 32k)`. Sprite canvas **64×224 @1x** (parallelogram: 64 wide, 32 base rise + 192 wall height). Placed with its canvas **top-left at world `(64k, 32k − 224)`**.
- **Left wall** (behind column `tx=0`), sections `m = 0..H−1`. Base runs from tile (0,m)'s top corner `(−64m, 32m−32)` down-left to its left corner `(−64m−64, 32m)`. Canvas 64×224 @1x, **top-left at `(−64(m+1), 32m − 224)`**. Left sections are the horizontal mirror of right sections (`flipX` one authored asset).

`IsoMath` exports `rightWallSectionTopLeft(k)`, `leftWallSectionTopLeft(m)` returning those points. These equations are the derivation the review upheld; Presentation adopts them verbatim (§0.1).

### 2.6 Directions & facing

```ts
export type Dir = 'SE' | 'SW' | 'NW' | 'NE';         // +tx, +ty, -tx, -ty
export const DIR_DELTA: Record<Dir, Tile> = {
  SE: {tx:+1, ty:0}, SW: {tx:0, ty:+1}, NW: {tx:-1, ty:0}, NE: {tx:0, ty:-1},
};
```
The engine only ever emits `Dir`; the view maps it to whatever the Presentation spec's paper-doll rig provides (2 authored facings + `flipX`, per §11). Until rig art lands: SE = base texture, SW = `flipX`, NE/NW = back placeholder.

---

## 3. Room model & occupancy grid (`src/engine/grid/CafeGrid.ts`)

### 3.1 Cell state

```ts
export interface Cell {
  floorId: string;              // furniture.json floor_* id ('floor_default' fallback)
  occupantId: PlacementId | null;  // furniture placement covering this cell
}
export type PlacementId = string; // 'p_' + monotonic counter, stable across save/load.
// The counter itself IS persisted (LayoutSchema.idCounter, §10.3) so ids never
// collide after load. Serialization hashing excludes it (AC-4).
```

`walkable(t)` is **derived**: in-bounds ∧ `occupantId === null`. Characters never occupy cells (they overlap each other, as in the original); only furniture blocks.

### 3.2 What lives where (by furniture.json `typeLabel`)

| typeLabel (count) | Domain | Occupies floor cells? | Notes |
|---|---|---|---|
| `stove` 61, `counter` 19, `sink` 13, `fridge` 12, `table` 54, `decor` 182, `pot` 28 | floor placement | **yes — blocking** | footprint from `size {x,y}` (517 1×1, 54 2×2, 19 2×1, 12 1×2) |
| `chair` 56 | floor placement | **yes — blocking**, but registers a **Seat** | seat is *usable* only when orthogonally adjacent to a `table` footprint (original: table+chair pairs cap throughput) |
| `floor` 20 | per-tile skin | no | `setFloorSkin(tile, id)` — pure cosmetic |
| `wall` 50 | per-section skin | no | `setWallSkin('left'|'right', index, id)` |
| `wallDecor` 107 | wall-decor slot | no | `{ itemId, side, index, span }`, span = `size.x` contiguous sections on one wall; sections must be inside the wall length and not double-booked by another wallDecor |

**Interaction cells:** every interactive placement exposes `interactionCells(id): Tile[]` = the walkable 4-neighbors of its footprint perimeter. A station is *reachable* by an actor iff A* finds a path to ≥1 interaction cell. Seats additionally expose the chair cell itself as the customer's sit target (path uses the `allowNonWalkableGoal` flag, §4.3).

**Door:** exactly one door tile on a **front edge** (`tx = W−1` or `ty = H−1`). Default `(⌊W/2⌋, H−1)`. The door cell can never be occupied (`canPlace` rejects it). Characters spawn/despawn at the door with a visual walk-in from `door + outwardNormal × 1.2` tiles (off-grid, render-only — pathfinding always starts on the door tile). *Flip-to-back-wall change surface, if ever needed:* `setDoor` edge validation, default door formula, spawn normal sign, starter layout door tile, door art anchor (§11) — nothing else.

**Deliberately authentic:** placement validation does **NOT** enforce path connectivity. Walling off a table is legal; servers then freeze (research: they "stand motionless"). Layout is gameplay, not decoration.

### 3.3 Public API

```ts
export class CafeGrid {
  readonly w: number; readonly h: number;
  version: number;                        // ++ on ANY mutation; walkers watch this
  readonly events: Emitter<GridEvents>;   // typed, dependency-free (engine/events.ts)

  constructor(layout: LayoutSchema);      // or CafeGrid.starter() for the default room

  // queries
  inBounds(t: Tile): boolean;
  walkable(t: Tile): boolean;
  cellAt(t: Tile): Readonly<Cell>;
  placementAt(t: Tile): Placement | null;
  placements(): ReadonlyMap<PlacementId, Placement>;
  interactionCells(id: PlacementId): Tile[];
  seats(): Seat[];                        // derived: chairs adjacent to tables
  door(): Tile;

  // sim-state guard (rev 2): the gameplay layer registers a veto callback that the
  // grid consults before remove()/moveItem()/PlacementSession lift. The ENGINE defines
  // the hook; the service-loop spec defines the matrix (stove COOKING/READY -> blocked
  // with reason code; counter holding servings -> blocked; chair with seated customer
  // -> blocked; sink mid-bus-trip target -> task released). Reasons are machine codes,
  // not display strings (i18n: the engine ships zero user-facing text).
  setRemovalGuard(guard: (id: PlacementId) => RemovalCheck): void;
  canRemove(id: PlacementId): RemovalCheck;   // consults the guard; default allow

  // mutation — every mutator bumps version and emits a GridEvent
  canPlace(item: FootprintItem, anchor: Tile, rot: Rot): PlaceCheck;  // Rot = 0 | 1 (90°: swaps w/h)
  place(item: FootprintItem, anchor: Tile, rot: Rot): PlacementId;    // throws EngineError on invalid
  remove(id: PlacementId): Placement;      // non-destructive; caller returns it to Storage.
                                           // Storage is the ONLY destination — no sell path (§0.3.3)
  moveItem(id: PlacementId, anchor: Tile, rot: Rot): boolean;  // ID-PRESERVING (§7 uses this, never remove+place)
  setFloorSkin(t: Tile, floorId: string): void;
  setWallSkin(side: WallSide, index: number, wallId: string): void;
  placeWallDecor(itemId: string, side: WallSide, index: number, span: number): WallDecorId;
  removeWallDecor(id: WallDecorId): void;
  setDoor(t: Tile): void;                  // must be on a front edge + unoccupied
  expand(newW: number, newH: number): void; // §3.4

  // persistence
  serialize(): LayoutSchema;
  static deserialize(l: LayoutSchema): CafeGrid;   // sanitizing — §10.5
}

export interface Placement { id: PlacementId; itemId: string; anchor: Tile; rot: Rot;
                             footprint: { w: number; h: number }; }   // rot-resolved
export interface Seat { chairId: PlacementId; tile: Tile; tableId: PlacementId; facing: Dir; }
export type PlaceCheck = { ok: true } | { ok: false; reason: 'oob'|'occupied'|'door'|'character' };
export type RemovalCheck = { ok: true } | { ok: false; reason: string /* machine code, e.g. 'stove-cooking' */ };
```

`canPlace` also returns `'character'`-invalid when a walker currently stands on a covered cell (red ghost; self-resolves as they move — chosen over a displacement system for determinism and simplicity). Footprints cover `[ax, ax+w) × [ay, ay+h)` from the **min-corner anchor**, exactly the legacy `GridManager.CanPlace` contract (GridManager.cs:46-55) with the projection replaced.

**seatId stability:** `seatId ≡ chair PlacementId`. Because `moveItem` and PlacementSession-move (§7) preserve ids, every downstream reference — `SavedStove.stoveId`, counter batches, dirty-plate seatIds, bus-task claims — survives a furniture nudge. Only `remove()` (to Storage) retires an id, and the removal guard (§3.3) prevents that while sim state is attached.

### 3.4 Expansion: geometry here, ladder data in ONE file

Square-step, prerequisite-locked, state-preserving. The **ladder itself lives in `src/data/expansion.json`** — the single expansion table in the repo. This spec fixes its *geometry column* (dims below, research-anchored); the Progression spec owns its *cost/gate columns* (with dual Cash-or-Toxin pricing on Toxin tiers per Pillar 3 — Toxin is earned-only) and deletes its former legacy-Unity price list. The Build Order references the file. Engine ACs parameterize on the file's first step and max dims (AC-7), so a ladder retune can never desync the tests.

| Tier | Room | Tiles | Research anchor |
|---|---|---|---|
| 0 | 7×8 (start) | 56 | — (near-square start; deviation logged §0.3.2) |
| 1 | 8×8 | 64 | "$3,500 to reach '8 squares'" |
| 2 | 9×9 | 81 | "$25,000 or 10 vials for 9" |
| 3 | 10×10 | 100 | "$75,000 or 30 vials for 10" |
| 4 | 11×11 | 121 | "40 vials for 11" |
| 5 | 12×12 | 144 | "50 vials for 12" |
| 6–9 | 13×13 … 16×16 | 169–256 | extrapolated (Progression prices, dual-currency) |
| 10 | 17×16 (max) | 272 | "Later versions grew the cap to a 17x16 footprint (~272 tiles)" |

The max room is **17×16** (this spec's roomBounds worked examples, ACs, and Presentation's 2112px world-size math all assume it); Progression's 16×17 variant is superseded.

**`expand()` semantics — atomic, ordered (rev 2, closes the door-relocation/cache-invalidation gap):**

1. All state changes apply **synchronously inside one call**: re-allocate cells, copy old state at identical indices, fill new floor cells with `floor_default`, append `wall_default` sections, then re-validate the door — kept if still on a front edge, else relocated to the new default `(⌊W/2⌋, H−1)`.
2. `version` increments **once**; exactly **one** `{ type:'expanded', oldDims, newDims, doorMoved: boolean }` event fires, **after** the grid is fully consistent. Listeners always observe the post-expansion grid; there is no intermediate state.
3. **Consumer contract (normative for other specs):** on `expanded`, (a) derived caches (`seats()`, `interactionCells` memos) are already coherent — they are computed from grid state, never stored stale; any consumer-side cache (SeatIndex, reachable-from-door flags) must be rebuilt in its `expanded` handler; (b) TaskQueue claims keyed by PlacementId remain valid (ids survive expansion — placements don't move); (c) in-flight walker paths re-plan automatically via the version watch (§4.5) — the same mechanism as any other mutation, no special case; (d) if `doorMoved`, spawn/despawn logic must re-read `door()` — the event flag exists so consumers need not diff. Handler ordering: listeners run synchronously in subscription order; **no listener may mutate the grid re-entrantly during `expanded`** (dev-mode assertion).

**No scene restart** — RoomView re-bakes on the event.

---

## 4. Pathfinding (`src/engine/path/Pathfinder.ts`)

### 4.1 Model — 4-connected, deliberately, everywhere

**4-connected (von Neumann), not 8 — and this is the game-wide movement canon (§0.1).** Rationale: (a) authentic grid shuffle — the original's walkers read as 4-direction tile steppers; (b) exactly matches the 2-facing + flip character rig; (c) eliminates corner-cutting rules entirely. Diagonal travel emerges as a staircase, softened visually by corner rounding (§6.3), never by the logical path. Raid *attack range* may be defined as 8-neighbor by the Raids spec — that is a range predicate, not pathing, and the Raids spec must say so in those words.

### 4.2 Cost model & determinism

- Step cost **1.0** per move.
- **Turn penalty +0.08** added to `g` when the step direction differs from the previous step's direction ⇒ optimal paths have *minimum turns*, producing the long straight shamble runs the original shows. Manhattan heuristic remains **admissible** (penalties only add cost), so results are optimal w.r.t. the penalized metric.
- Heuristic: `h = |dx| + |dy|`. Tie-break: lower `h`, then insertion order (stable binary heap with monotonic sequence numbers).
- Fixed neighbor expansion order: `SE(+1,0), SW(0,+1), NW(−1,0), NE(0,−1)`.
- Same grid + same query ⇒ **byte-identical path**, every run, every platform.

### 4.3 API

```ts
export interface WalkSource { readonly w: number; readonly h: number;
                              walkable(t: Tile): boolean; }   // CafeGrid satisfies this

export interface PathQuery { from: Tile; to: Tile; allowNonWalkableGoal?: boolean; }
export type PathResult =
  | { status: 'ok'; path: Tile[] }        // path[0] = from, last = to, 4-adjacent steps
  | { status: 'blocked' }                  // no route exists
  | { status: 'invalid' };                 // from/to out of bounds

export function findPath(g: WalkSource, q: PathQuery): PathResult;
```

These exact names and shapes are re-exported from `src/engine/contracts.ts` (§9.3); consumer specs must not paraphrase them (`isWalkable(x,y)` / `Tile[]|null` variants are superseded).

`allowNonWalkableGoal: true` treats the goal cell as walkable regardless of occupancy — required for customers sitting **on** chair cells and bussing to counter cells. All intermediate steps still require walkability.

### 4.4 Scale & budget

Worst case 17×16 = 272 nodes: full A* < 0.05ms in Node. No async, no hierarchical anything. A grid-change re-plan storm across 20 walkers must complete within the relative CI budget (AC-18).

### 4.5 Dynamic re-plan & the authentic freeze

- Walkers cache `plannedVersion = grid.version`. Before **each tile step commit**, and whenever `grid.events` fires a mutation, a walker with `plannedVersion !== grid.version` re-plans its remaining route from its current (or next-center) tile.
- Re-plan `blocked` ⇒ walker finishes its in-flight step to the next tile **center** (never stops inside furniture — `canPlace` guarantees no cell under a walker gets occupied), enters state `'blocked'`, emits `{ type:'blocked' }`. The view renders the freeze + a "?!" emote.
- Every subsequent grid change retries automatically; success emits `{ type:'resumed' }` and walking continues. This is the original's exact failure/recovery loop and makes layout a live gameplay constraint.

---

## 5. Depth sorting (`src/engine/depth.ts`) — THE depth canon

One convention. **All** magic constants die (`CafeScene.ts:51` −1000 bg, `Stove.ts:60` 9000 bubble, `Hud.ts:20/72` 5000/6000). The Build Order's `key*10` / `FX=8000` variants are superseded; it references this module.

### 5.1 Bands

```ts
export const BAND = {
  FLOOR: 0,            // baked floor RT — single object, depth 0
  FLOOR_OVERLAY: 500,   // edit-mode grid lines, footprint validity diamonds
  WALL: 1000,           // wall sections: 1000 + index; wallDecor: hostSectionDepth + 0.5
  ENTITY: 2000,         // furniture + characters, sorted (below)
  FX_WORLD: 9000,       // world-space fx not parented to an entity (flying coins)
} as const;             // HUD: separate scrollFactor(0) container at depth 10000
```
Walls always render behind every floor entity (band order) — a character hugging the back wall correctly occludes wall decor.

### 5.2 Entity sort key

```ts
export function furnitureSortKey(p: Placement): number {      // front-corner tile sum
  return (p.anchor.tx + p.footprint.w - 1) + (p.anchor.ty + p.footprint.h - 1);
}
export function characterSortKey(fx: number, fy: number): number { return fx + fy; } // continuous
export function entityDepth(key: number, isCharacter: boolean): number {
  return BAND.ENTITY + key * 16 + (isCharacter ? 8 : 0);
}
```
- Max key (17+16)×16 + bias < 560 above band base — comfortably inside the band.
- The `+8` character bias resolves the classic equal-sum tie (character standing beside a 2×2 stove at the same anti-diagonal): the character — footprint area 1, physically in front of the near face — draws on top. With the catalog capped at 2×2 footprints this scalar scheme is exact for all real cases; no topological sort needed.
- Characters update depth only while moving (dirty flag); static furniture depth is computed once at place/move.
- Carried plates, emote bubbles, shadows are **children of the character container** and inherit its depth (internal child order: shadow < body < carried item < bubble). Nothing gameplay-ish ever renders above the HUD again.

---

## 6. Movement controller (`src/engine/move/Walker.ts`)

### 6.1 State machine & timebase

```ts
export type WalkerState = 'idle' | 'moving' | 'blocked';

export class Walker {
  readonly id: string;
  pos: Vec2;                    // continuous TILE-space (fx, fy)
  facing: Dir;                  // last step direction (spawn default 'SW')
  state: WalkerState;
  tilesPerSec: number;

  constructor(grid: CafeGrid, id: string, start: Tile, tilesPerSec: number, seed: number);
  requestMove(target: Tile, opts?: { allowNonWalkableGoal?: boolean }): PathResult;
  stop(): void;                                  // finish current step, go idle
  tick(dtSec: number): WalkerEvent[];            // pure; caller supplies dt (see below)
  currentTile(): Tile;                           // round(pos)
  renderPos(): Vec2;                             // corner-rounded visual pos (§6.3), tile-space
}
export type WalkerEvent =
  | { type: 'step'; tile: Tile; dir: Dir }
  | { type: 'arrived'; tile: Tile }
  | { type: 'blocked'; at: Tile }
  | { type: 'resumed' };
```

**Timebase (rev 2 — the harness contract):** `tick` receives seconds from its caller. In production the sim loop passes real elapsed seconds; in tests and CI harnesses the caller passes synthetic dt (large steps, fixed steps, or an injected `Clock` — this dt-injection *is* the project's test-time acceleration mechanism, replacing the deleted `DEMO_TIME_SCALE`; nothing scaled is reachable in production builds because no scale constant exists in the engine at all). Locomotion is presentation-speed and is never multiplied by any foreground/activity time scale — those scales (owned by simulation-core) apply to energy/daydream/serving-throughput systems, not to walking.

### 6.2 Stepping rules

- One committed tile step at a time. Before each commit: validate next tile walkable and `plannedVersion` current (§4.5).
- Constant velocity in tile space along the path; arrival snap when within ε = 0.01 tiles of the final center, then exact-set `pos = target center`, emit `arrived`, state `idle`.
- Per-segment speed noise ±10%, from `mulberry32(seed)` (`engine/rng.ts`) — deterministic per walker id.

### 6.3 One speed module (`src/engine/move/speed.ts`) — THE speed canon

Replaces all four rival formulas found in review (old engine `0.44·baseSpeed`, Service `baseSpeed·0.6` + customers `2.0/2.6`, Raids `baseSpeed·0.56` + flee `2.2`, Staff `0.45+0.09·Speed`). The Staff spec's formula wins — it is the only one that makes the researched Speed 1–12 stat load-bearing — and it **lives here**, in the engine, so every consumer imports one function:

```ts
// Zombie staff shamble. speedStat: the derived Speed stat (1–12) from the
// infection/staff spec's StaffStats.ts (that spec owns the derivation;
// this module owns stat -> tiles/sec). Default stat before StaffStats lands: 7.
export function zombieTilesPerSec(speedStat: number): number {
  return clamp(0.45 + 0.09 * speedStat, 0.5, 1.55);   // 0.54 @1 … 1.53 @12
}
export const CUSTOMER_SPEED = 2.0;     // humans stride; zombies shuffle — the contrast is the point
export const CUSTOMER_ANGRY_SPEED = 2.6;
export const RAIDER_FLEE_SPEED = 2.2;  // consumed by the Raids spec
```

- Default-stat zombie: `zombieTilesPerSec(7) ≈ 1.08` t/s — a 7×8 room crossing takes ~9s. Deliberately, recognizably slow.
- **Consumer obligations:** Service §8.5 round-trip/throughput math and the Raids TTK tables must be *regenerated* from this module's outputs; their local formulas are deleted. Golden test AC-13b locks three stat points.
- **Shamble dressing (view-facing, engine-computed):** corner rounding — `renderPos()` blends a quadratic curve within radius 0.35 tiles of interior waypoints (logical path stays pure 4-dir); bob `y −= |sin(phase)| × 3px`, phase advances `2π × 1.6 × (tilesPerSec/1.1)`/s (step-synced); sway `±2.5° × sin(phase/2)`. **Reduced-motion:** when the settings spec's `reducedMotion` flag is on, the view suppresses bob/sway (and any screenshake it hosts); `renderPos()` corner rounding stays (it removes motion artifacts rather than adding motion).
- **Dispatch:** tap-zombie-then-tap-destination is a gameplay-layer UX; the engine contract it needs is exactly `requestMove` + `interactionCells` + the event stream. Who owns the tap when a zombie is selected is defined in §8.6.

### 6.4 Live-catchup contract (rev 2 — interface to the OfflineEngine)

The engine is pure and will faithfully simulate any dt you feed it — including a 60-second GC/throttle gap, which would replay minutes in one frame. Policy for that lives in the simulation-core spec's **OfflineEngine** (single clamped elapsed-window authority, ordered subsystem settlers). The engine's normative contract: **callers must not pass `dtSec > MAX_LIVE_CATCHUP` (exported constant, 5s) to `Walker.tick`** — accumulated time beyond it must be routed through offline settlement (which despawns live customers and is rating-neutral) before live ticking resumes. Dev builds assert on violation; the constant lives in `IsoConfig`.

---

## 7. Placement session (`src/engine/place/PlacementSession.ts`)

Pure state machine; `PlacementView` renders it.

```ts
export type SessionMode =
  | { kind: 'new'; itemId: string }            // from store/storage
  | { kind: 'move'; placementId: PlacementId } // lift an existing item
  | { kind: 'paint-floor'; floorId: string }   // per-tile painting
  | { kind: 'paint-wall'; wallId: string };    // per-section painting

export class PlacementSession {
  constructor(grid: CafeGrid, catalog: FootprintCatalog, mode: SessionMode);
  hover(t: Tile): void;                    // ghost anchor = clamp(t) to grid
  hoverWall(side: WallSide, index: number): void;   // for wall modes
  rotate(): void;                          // only if w !== h; Rot 0 <-> 1
  valid(): PlaceCheck;                     // live validity for tint
  confirm(): ConfirmResult;               // mutates grid on success
  cancel(): void;                          // 'move' mode: ghost discarded, item never left its cells
  ghost(): { anchor: Tile; footprint: {w,h}; rot: Rot } | null;
}
```

Behavior spec:
- **Ghost preview** follows pointer via `worldToTile`; renders at its would-be `entityDepth`, alpha 0.6, tint `0x7ee081` (PALETTE.toxic) when valid / `0xc0392b` (PALETTE.blood) when invalid, **plus a ✓/✕ glyph on the ghost** so validity is never color-only (accessibility — colorblind-safe by default, no setting needed), plus per-cell validity diamonds on `BAND.FLOOR_OVERLAY` (green/red 0.35 alpha with subtle hatch on invalid).
- **Input model:** desktop — ghost tracks cursor, click confirms when valid, Esc/right-click cancels, R rotates. Mobile — drag moves the ghost (relative drag, not finger-under-sprite), floating ✓/✕/⟳ buttons confirm/cancel/rotate; ✓ disabled while invalid. Button hit targets use the UI kit's canonical touch-target constant (this spec stops restating 44 vs 48 — one constant, UI kit owns it). No blind tap-to-place on touch.
- **Move is ID-PRESERVING (rev 2 — fixes the dangling-reference blocker):** lifting a placed item does **not** remove it. The session records `{originalAnchor, originalRot}`, shows the item at 50% alpha in place, and drives a ghost; `confirm()` calls **`grid.moveItem(id, …)`** — the placement keeps its id, so a mid-cook stove nudged one tile keeps its cook state, seatIds stay valid, and counter batches survive. `cancel()` just discards the ghost — the grid was never mutated. `remove+place` is reserved exclusively for the store-to-Storage flow.
- **Lift/store gating:** entering `move` mode and the "store" action both consult `grid.canRemove(id)` (§3.3). A vetoed lift shows the guard's reason code (rendered as a toast by the UI layer — the engine emits the code only).
- **To Storage:** a "store" action while lifted returns the item to the storage list (save schema §10.3) — non-destructive per the original. **There is no sell path — engine-level contract, `Storage is the only destination` (§0.3.3).** The former `sellValue` hook is deleted; the 0-cash soft-lock is handled by the service loop's pity mechanic, not by selling.
- Edit mode also toggles the tile-grid overlay (subtle 1px diamond outlines, alpha 0.15) — modern usability, off during normal play.

---

## 8. Camera, scaling & input arbitration (`src/view/CameraController.ts` + `src/view/InputModeStack.ts` + `src/main.ts` changes)

- **Scale mode:** replace fixed 960×600 FIT with `Phaser.Scale.RESIZE`. Canvas = client size × `DPR` (capped at 2), game `zoom = 1/DPR` ⇒ crisp on retina, correct CSS-pixel input.
- **Pan:** pointer-down + move; **`TAP_VS_PAN_PX` (8px, IsoConfig)** discriminates tap (pick/interact) from drag (pan). Fling on release: velocity from the last 3 pointer samples, decay ×0.92/frame, stop under 20 px/s.
- **Zoom:** wheel ×1.1 per notch centered on cursor; pinch continuous centered on midpoint. Clamp: `minZoom = max(fitZoom(room AABB + 40px pad), ZOOM_MIN=0.4)`, `maxZoom = ZOOM_MAX = 2.0`. Default on boot: fit-room, clamped to ≥ `DEFAULT_FIT_ZOOM_FLOOR = 0.75`. These four constants live **only** in `IsoConfig` (§2.1); the 0.5–1.5 and 0.5–2.0 variants elsewhere are superseded.
- **Bounds:** hard-clamp camera view to `roomBounds(w,h)` inflated by `CAMERA_MARGIN_PX = 96`; recomputed on `expanded` events and window resize.
- **HUD:** `Hud.layer.setScrollFactor(0)` (one line at Hud.ts:20) + reposition on `Scale.Events.RESIZE`. The 17×16 endgame room must be comfortably navigable on a 375×667 phone and a 4K desktop.

### 8.6 Input-mode arbitration (rev 2 — closes the "every system claims the pointer" gap)

`src/view/InputModeStack.ts` is the one pointer arbiter. Modes are a stack; a pointer event is offered to the top mode first; camera pan/zoom is the permanent bottom layer (drag ≥ 8px always pans unless a modal blocks it).

| Priority (top→bottom) | Mode | Tap means | Pushed by | Popped by |
|---|---|---|---|---|
| 1 | **Modal panel** (store, cookbook, settings, raid results) | UI hit only; world input blocked | opening the panel | close/Esc |
| 2 | **PlacementSession** (§7) | move ghost / confirm | edit-mode place/lift | confirm/cancel/Esc |
| 3 | **Dispatch selection** (a zombie is selected) | tap walkable tile → `requestMove`; tap station → move to its interaction cell; **tap a customer → opens the infect card** (infection wins over floor-move on a customer — the customer's body is an interaction target, not floor; tap empty floor beside them to walk there); tap another zombie → reselect; tap nothing → deselect | tapping a zombie | dispatch issued / deselect / Esc |
| 4 | **Default play** | tap stove → stove panel; tap customer → infect card; tap zombie → push Dispatch selection | — | — |
| always | **Camera** | drag ≥ 8px pans, pinch/wheel zooms (blocked only under a full-screen modal) | — | — |

Rules: pushing a mode never cancels a lower mode's *state* (a selected zombie survives opening and closing the store); Esc pops exactly one mode; entering edit mode while a zombie is selected pops the selection (edit and dispatch are mutually exclusive by design). Raid-scene input defines its own stack instance with the same arbiter class. This table is normative for the Service Loop, Infection, and Raids specs — they reference it, they don't redefine tap semantics.

---

## 9. Phaser integration & purity rules

### 9.1 Purity enforcement & canonical events

- `src/engine/**` imports nothing outside `src/engine/`. ESLint `no-restricted-imports` bans `phaser` (and `../view`, `../scenes`, `../ui`) inside `src/engine`; a vitest meta-test greps engine sources for `from 'phaser'` as a second lock (AC-17). Engine's `Emitter` in `engine/events.ts` is a ~30-line typed, dependency-free emitter (payload-typed map — the pattern the shared EventBus adopts).
- **The same ESLint boundary must cover ALL simulation code**: the lint config declares the no-Phaser zone as `src/engine/**` **and `src/sim/**`**, and the Raids spec's `RaidSim` moves under `src/sim/raid/` so the rule actually applies to it (review finding adopted).
- **Event-name canon:** the engine's `GridEvents` and `WalkerEvent` names/payloads defined in this spec are registered verbatim in the shared events registry (`events.d.ts`, Build Order appendix). System specs may **add** events there; they may never rename or redefine an engine event. (The `plate-delivered`/`serving-delivered`/`dish-collected` reconciliation is the registry's job for *gameplay* events; no engine event is affected.)
- **No shipped stub adapters (rev 2):** the Build Order sequences this engine (M1–M2) before every consumer (M5+). Consumer specs keep the `WalkSource`/`ICafeGrid`-style *interfaces* for decoupling but must **delete their StubGrid / tween-placeholder workstreams**; sim unit tests use a ~10-line in-test fake, never a shipped adapter file.

### 9.2 Scene graph strategy

| Layer | Representation | Rebuild trigger |
|---|---|---|
| Floor (≤272 tiles) | **one `RenderTexture`**, depth `BAND.FLOOR` — 1 draw call | `floor-skin-changed`, `expanded` (re-bake ≤ 2ms) |
| Walls (≤33 sections) | one `RenderTexture` for skins, depth `BAND.WALL`; **wallDecor as individual Images** above it (`hostDepth + 0.5`) | `wall-skin-changed`, `expanded` |
| Furniture | **one Container per placement** (sprite + optional fx children), depth from `furnitureSortKey` — set once on place/move | grid events |
| Characters | one Container per walker (shadow ellipse + body rig + carried-item slot + bubble slot), depth from `characterSortKey` every frame **while moving only** | walker events |
| Edit overlay | Graphics on `BAND.FLOOR_OVERLAY` | session hover |
| HUD | existing container, `scrollFactor(0)`, depth 10000 | — |

View classes subscribe to `grid.events` / consume `walker.tick()` events; they hold **zero** authoritative state. Interim placeholder art (until the art batch lands): boot-time `Graphics.generateTexture` diamonds/panels from `PALETTE` (floorTile/floorTileAlt checker, wall + darker baseboard) so the engine milestone is never art-blocked.

### 9.3 File plan (public API per module)

```
src/engine/
  IsoConfig.ts        ALL canonical numeric constants (§2.1) — the constants canon    (~40 loc)
  contracts.ts        re-exports the REAL public signatures consumers import:
                      Tile, Dir, PathResult, findPath, WalkSource, CafeGrid surface,
                      Walker surface, speed module — the anti-drift contract file     (~40)
  types.ts            Tile, Vec2, Rot, Dir, DIR_DELTA, AABB, EngineError              (~60)
  events.ts           Emitter<EventMap> — typed on/off/emit, no deps                  (~40)
  rng.ts              mulberry32(seed): () => number                                  (~15)
  depth.ts            BAND, furnitureSortKey, characterSortKey, entityDepth           (~40)
  iso/IsoMath.ts      transforms, corner helpers, wallSectionTopLeft L/R, roomBounds  (~90)
  grid/CafeGrid.ts    §3 API incl. removal guard, atomic expand, sanitizing load      (~360)
  grid/starterLayout.ts  CafeGrid.starter() default room (§10.2)                      (~60)
  path/BinaryHeap.ts  stable min-heap with insertion-order tie-break                  (~60)
  path/Pathfinder.ts  findPath (§4)                                                   (~120)
  move/Walker.ts      §6 state machine + corner rounding + renderPos                  (~180)
  move/speed.ts       zombieTilesPerSec + customer/flee constants (§6.3)              (~20)
  place/PlacementSession.ts  §7 state machine (id-preserving move)                    (~150)
  *.test.ts colocated: IsoMath, CafeGrid, Pathfinder, Walker, PlacementSession,
  depth, speed goldens, sanitizer, purity meta-test        (target ≥90% engine coverage)

src/view/               (Phaser adapters — thin, no game rules)
  RoomView.ts         floor/wall RTs, wallDecor images, door mat, overlay
  FurnitureView.ts    placement containers, depth assignment
  CharacterView.ts    walker containers, facing/flip, bob/sway (reduced-motion aware), emotes
  PlacementView.ts    ghost + validity tint + glyphs + mobile confirm buttons
  CameraController.ts §8
  InputModeStack.ts   §8.6
  placeholderArt.ts   Graphics-generated interim textures
```

The engine ships **zero user-facing strings** — every reason/veto/event is a machine code; display text lives in the UI layer's centralized strings module (i18n decision: English-only for now, strings centralized — this spec is already compliant by construction).

---

## 10. Migration plan (from painted backdrop to engine-driven)

### 10.1 Milestones (each independently shippable, `npm run build` + tests green)

- **M1 — Engine core (no visual change).** Land `src/engine/` complete with tests + ESLint boundary rule + the `IsoConfig ↔ Tools/artconfig.json` CI equality check (**lands now, not at the art milestone**). Game still renders the old scene. Exit: all engine ACs pass in CI.
- **M2 — Engine-driven room.** `RoomView` + placeholder art replaces `cafe_bg` as the play surface (`CafeScene.buildRoom/drawTable`, CafeScene.ts:50-67, deleted). Stoves/tables/chairs/counter/sink/door become grid placements from the starter layout (§10.2); `Stove`'s cook state machine (Stove.ts:8-121) is **kept** and re-hosted on a `FurnitureView` container (its anchoring/depth/9000-bubble replaced; bubble becomes a child). Layout fields land in the save at **the version the save ledger assigns to this milestone** (§10.3). CameraController + InputModeStack + `Hud.setScrollFactor(0)` land here. Exit: recognizable diorama room — floor grid + two back walls — at any zoom.
- **M3 — Pathfinding walkers.** `Customer.walkTo` (Customer.ts:41-52) is deleted; customers become Walkers: door → seat (via `allowNonWalkableGoal`) → eat → door → despawn. Waiters get Walker bodies + engine-level dispatch (`requestMove` to `interactionCells`), replacing the pinned bob tween (CafeScene.ts:79-86). Freeze-when-blocked visible in play. Exit: no straight-line tween movement remains anywhere.
- **M4 — Placement & edit mode.** PlacementSession + PlacementView + storage; id-preserving move/rotate/store for every placement; floor/wall painting modes wired to the 20 floor + 50 wall skins (temporarily via debug picker until the store UI spec lands). Removal-guard hook wired (guards themselves arrive with the service loop). Exit: player can rearrange the cafe and it persists.
- **M5 — Art swap.** Real tile/wall/furniture/character art per §11 replaces placeholders via an atlas manifest; `cafe_bg.jpg` is retired from the scene — it survives only as `index.html` splash/marketing art. Exit: zero placeholder textures in the play surface.

*(These are engine-internal milestones; the master Build Order maps them onto its M1–M5 lane and owns cross-system sequencing.)*

### 10.2 Starter layout (rev 2 — now satisfies the service loop on day one)

The previous starter (3 stoves / 4 tables / 4 chairs, **no counter, no sink**) could never earn a coin under the service rules (dishes must reach a counter; plates must reach a sink) — review blocker, fixed. The starter is now a **committed `starterLayout.json`** owned by this spec but **CI-validated against service-loop invariants** (AC-22): ≥1 stove, ≥1 counter, ≥1 sink, ≥1 seat, door present, every station reachable from the door, all aisles ≥1 tile.

Room 7×8. Door `(3,7)` (front edge). Against the left wall (`tx=0`), facing SE: **stoves** (1×1) at `(0,1)`, `(0,3)`; **counter** (1×1) at `(0,5)`. **Sink** (1×1) at `(6,1)` against the right wall, facing SW. **Tables** (1×1) at `(2,2)`, `(4,2)`; **chairs** (1×1) at `(2,3)`, `(4,3)` (SW-adjacent) and `(5,2)` (SE-adjacent to the table at `(4,2)`) ⇒ **3 seats**. Floors `floor_01`, walls `wall_01`. Progression's first-two-hours walkthrough must be regenerated from this layout + `src/sim/tuning.ts` constants (its 2-stove/2-table assumption now matches; its cash numbers come from tuning.ts, not from this spec).

### 10.3 Layout save shape (`SaveManager.ts`) — version numbers stripped (rev 2)

This spec **no longer claims a save version integer**. The Build Order's **save ledger** (`docs/spec/save-ledger.md`) is the only authority that assigns version numbers; this spec defines the *field additions* that land at whatever version the ledger assigns to milestone M2 ("layout fields"). The layout shape carries its **own** independent revision so grid-schema evolution never collides with global save numbering:

```ts
interface LayoutSchema {
  layoutRev: 1;                            // layout-local revision, independent of SAVE_VERSION
  w: number; h: number; expansionTier: number;
  door: { x: number; y: number };
  floors: string[];                        // row-major w*h floor ids
  wallsRight: string[]; wallsLeft: string[];
  wallDecor: { id: string; itemId: string; side: 'left'|'right'; index: number; span: number }[];
  placements: { id: string; itemId: string; x: number; y: number; rot: 0|1 }[];
  storage: { itemId: string; count: number }[];
  idCounter: number;                       // PERSISTED — ids must never collide after load (§3.1)
  exterior?: never;                        // reserved (§0.3.4); absent in v1
}
// SaveData gains { layout: LayoutSchema } at the ledger-assigned version.
```

Migration (ledger-owned slot): keep all pre-existing fields verbatim (currency renames etc. belong to the ledger's M0 migration, not this one); inject the starter layout. Fixture: a committed pre-layout save migrates cleanly (AC-15). Multi-tab writer election, storage-failure UX (quota, disabled localStorage, Safari ITP), and export/import are the **save-system spec's** scope; this spec's only save-layer obligations are the shape above and the sanitizer below.

### 10.4 The Higgsfield backdrop

`public/art/cafe_bg.jpg` is **retired as the play surface** at M2 and deleted from `PreloadScene`'s gameplay path at M5. It is genuinely on-style, so it is kept for: the `index.html` splash screen, README/Pages marketing, and as the **style reference** for the modular art batch (palette, lighting direction ≈ upper-left, line weight, grime level). It can never occlude characters, so it can never be world art. (Usage-rights logging for it and all generated art: licensing spec, `public/art/CREDITS.md` — out of engine scope, noted for completeness.)

### 10.5 Sanitizing load (rev 2 — corrupt-but-parseable layouts must not brick the game)

`CafeGrid.deserialize` **never throws on bad data**; it repairs and reports:

- Placement out of bounds / overlapping / unknown `itemId` → **evicted to `storage`** (never deleted), with a machine-readable repair record.
- Door off-edge or occupied → relocated to default `(⌊W/2⌋, H−1)`.
- Floors/walls arrays wrong length → truncated/padded with `floor_default`/`wall_default`.
- WallDecor out of range / double-booked → evicted to storage.
- `idCounter` lower than the max id present → raised past it.

Returns `{ grid, repairs: RepairRecord[] }`; a non-empty `repairs` surfaces one UI toast ("Some furniture was moved to Storage after an update") and logs details. This is the defined behavior for the "corrupted-but-parseable layout after a bad migration" failure mode; unparseable-blob and quota failures are the save-system spec's UX (offer download-broken-save before any wipe — referenced, not restated).

---

## 11. Art requirements (modular room art batch)

All source art authored at **2× (retina)**, displayed at 1× logical sizes; packed to atlases with a JSON manifest carrying per-item anchors. Anchor = the pixel that aligns to the item's world anchor point. **Every canvas dimension below derives from `IsoConfig` and is CI-checked via the artconfig equality test (AC-21).**

| Asset class | Canvas @2x (display @1x) | Anchor convention | Count needed |
|---|---|---|---|
| Floor tile | 256×128 (128×64) | diamond center = canvas center (0.5, 0.5) | 20 skins (`floor_01..20`) + `floor_default` + edit-overlay diamond |
| Wall section (left authored; right = flipX) | **128×448 (64×224)** — §2.5 geometry, supersedes Presentation's 256×448/128-wide | canvas top-left = `leftWallSectionTopLeft` point; baseboard occupies bottom 24px @2x | 50 skins (`wall_01..50`) + `wall_default` |
| Door mat + frame (front-edge, §0.3.1) | 256×128 mat + 256×256 frame | mat: diamond center; frame: bottom-center on door tile center | 1 |
| Furniture 1×1 | 256×420 max (128×210) | manifest `anchorPx` = projected footprint-base center | per-item; footprint base diamond = 256×128 @2x |
| Furniture 2×1 / 1×2 | 384×480 max | same | base parallelogram 384×192 @2x |
| Furniture 2×2 | 512×600 max (256×300) | same | base diamond 512×256 @2x |
| Wall decor | span×128 wide × ≤300 tall @2x | manifest `anchorPx` = top-left of host section(s) + documented offset | 107 items (batched) |
| Characters | **Paper-doll rig parts per the Presentation spec** (6-part rig, 2 authored facings + `flipX`, frames only for one-shot gags) — the engine only emits `Dir` (§2.6) and imposes: feet anchor ≈(0.5, 0.93) with exact `anchorPx` in manifest; display height ≈150px @1x (~2.3 tile-heights). Presentation's escalation hatch (hand-keyed walk frames for the Chef + 2 hero zombies) is the quality fallback | per Presentation §6 — the former "4 dirs × 8 frames per character" row is superseded (rev 2): at 105 occupations the frame-sheet bill was ~10× and the Presentation spec's scaling argument is correct |

Furniture is authored **facing SW** (front-left); `rot=1` renders flipX. Every furniture export must fill its footprint base parallelogram exactly — the manifest's `footprint` + `anchorPx` are validated by a CI test that projects the footprint and asserts the base fits the canvas. Manifest ids must exist in the (licensing-renamed) catalog — CI-checked by the Presentation spec's manifest test.

---

## 12. Risks & mitigations

1. **Scalar depth sort has theoretical failure cases** for large/concave footprints. Mitigated: catalog caps at 2×2; character bias handles the equal-sum case; if a future >2×2 item lands, split its art into per-column slices (documented escape hatch) rather than adopting topological sorting.
2. **4-dir staircase could read robotic.** Mitigated by corner rounding (0.35-tile radius), per-segment speed noise, bob/sway; validated by eye at M3 with a tunable-constants debug panel before sign-off.
3. **RESIZE + DPR changes input math globally.** Mitigated: picking uses Phaser's own `worldX/worldY` (no hand-rolled inverse); AC-2/AC-16 lock it; M2 ships behind a one-flag revert to FIT for one release.
4. **Art batch slips.** Placeholder procedural textures make M2–M4 fully playable; art is isolated to M5.
5. **Save migration bugs eat layouts.** Fixture saves committed to the repo + round-trip AC-15 + the §10.5 sanitizer (repair-to-storage, never wipe); the save-system spec adds download-before-wipe.
6. **Perf regression on mobile at 17×16.** RT baking + moving-only depth updates; AC-18/AC-19 use *relative* CI budgets (shared runners have 2–5× timing variance — absolute-ms ACs would flap); real-device verification is a **manual per-milestone checklist** (one iPhone + one mid-range Android, recorded in the milestone PR) plus a CPU-throttled (4×) chromium perf smoke as the CI proxy. The former "60fps on Snapdragon 730" AC is retired as a CI assertion and moved to that checklist.
7. **Constants drift re-emerges post-reconciliation.** Mitigated structurally: `IsoConfig` + `contracts.ts` + the artconfig equality test + the sibling-spec literal grep (§0.1) make drift a CI failure, not a code review hope.

---

## 13. Acceptance criteria (mechanically testable)

**Coordinate math**
- AC-1: For 10,000 seeded-random continuous points inside the 17×16 room AABB, `|tileToWorld(worldToTileF(p)) − p| < 1e-9` (pure math), and via a mock camera at zooms {0.5, 1.0, 1.37, 2.0} the full screen→tile→screen round-trip error is **< 0.5px**.
- AC-2: `worldToTile(center of t) === t` for every tile in a 17×16 room; points 1px inside each diamond edge midpoint resolve to the correct tile; points 1px outside resolve to the neighbor.
- AC-3: `rightWallSectionTopLeft(k)` / `leftWallSectionTopLeft(m)` satisfy the base-edge equations of §2.5 for all indices in a 17×16 room (corner-point identity check).

**Grid & placement**
- AC-4: `canPlace` rejects: any footprint cell out of bounds, any overlap with an existing placement (all four footprint shapes tested), and the door tile. `place` then `remove` restores a grid whose **canonical placement-form hash** (placements + floors + walls + door, **excluding `idCounter`**) is identical; a separate assertion verifies `idCounter` strictly increases and is round-tripped by serialize/deserialize.
- AC-5: A 2×2 item at (2,2) makes exactly cells (2,2),(3,2),(2,3),(3,3) non-walkable and nothing else.
- AC-6: `seats()` returns a seat for a chair orthogonally adjacent to a table footprint and none for an isolated chair; removing the table removes the seat; `moveItem` on the chair preserves its `PlacementId` (and thus its seatId).
- AC-7: **Parameterized on `src/data/expansion.json`:** expanding along the ladder's actual first step (currently 7×8 → 8×8) preserves every placement, floor skin, wall skin; new cells read `floor_default`/`wall_default`; `version` increments exactly once; exactly one `expanded` event fires after the grid is fully consistent, with a correct `doorMoved` flag; old-cell walkability unchanged. A second case expands to the ladder's max dims (17×16) and asserts `roomBounds` matches the documented world extent.
- AC-8 (removal guard): with a registered guard vetoing id X, `canRemove(X)` returns the veto code, `remove(X)` throws, and PlacementSession refuses to enter `move` mode for X; with no guard, all removals default-allow.

**Pathfinding**
- AC-9: Property test — 1,000 seeded random layouts (random footprints at 25% density): every returned path starts at `from`, ends at `to`, each consecutive pair is 4-adjacent, and **no step lands on an occupied cell** (a 2×2 stove is never crossed).
- AC-10: On an empty grid, path length = Manhattan distance + 1 nodes, and (0,0)→(5,5) contains exactly **one** direction change (turn-penalty minimality).
- AC-11: Fully enclosing a target yields `{status:'blocked'}`; a walker en route enters `'blocked'` standing exactly on a tile center, and removing one enclosing wall emits `'resumed'` with a fresh valid path — without any external re-trigger. Identical queries return identical paths across 100 repeated runs (determinism).

**Depth**
- AC-12: With a 2×2 stove anchored (2,2): character at (1,1) ⇒ `depth(char) < depth(stove)`; at (4,4) ⇒ greater; at (4,2) (equal key 6) ⇒ character on top via the +8 bias. Character depth is strictly monotonic in `fy` along any SW walk.
- AC-13: No `setDepth` call sites remain in `src/` outside `depth.ts`-derived values and the HUD constant (grep-enforced test).

**Walker & speed**
- AC-14: After `arrived`, `walker.pos` equals the destination center within 1e-6 tiles and state is `'idle'`; total travel time for a 10-tile straight run at `zombieTilesPerSec(7)` matches distance/speed ± the ±10% seeded noise bound.
- AC-14b (speed goldens): `zombieTilesPerSec(1) = 0.54`, `zombieTilesPerSec(7) = 1.08`, `zombieTilesPerSec(12) = 1.53` (±1e-9); `CUSTOMER_SPEED=2.0`, `CUSTOMER_ANGRY_SPEED=2.6`, `RAIDER_FLEE_SPEED=2.2` are exported and are the only speed constants matched by a repo-wide grep outside `src/engine/move/speed.ts`.
- AC-15: Placing furniture on the remaining path triggers re-plan before the next step commit; the walker never occupies a newly-blocked cell. Dev-mode `tick(dt > MAX_LIVE_CATCHUP)` asserts (production: clamps and warns once).

**Persistence & sanitizer**
- AC-16: `serialize → deserialize → serialize` is byte-identical for the starter layout and for a randomized 17×16 layout; a committed pre-layout save fixture migrates at the ledger-assigned version with all prior fields preserved and the starter layout injected.
- AC-17 (sanitizer): a corrupted fixture (OOB placement, overlapping pair, unknown itemId, off-edge door, short floors array, stale idCounter) deserializes without throwing; evicted items appear in `storage`; the door is on a front edge; `repairs` enumerates every fix; re-serializing yields a valid layout that round-trips cleanly.

**Starter-layout invariants**
- AC-18: CI test on `starterLayout.json`: ≥1 stove, ≥1 counter, ≥1 sink, ≥1 seat, door on a front edge, and `findPath(door → ≥1 interaction cell)` succeeds for every station and seat.

**Camera & input**
- AC-19 (view/e2e via Playwright boot smoke, chromium **and WebKit** projects): after scripted pan+zoom abuse, the camera viewport remains within room AABB + 96px and zoom within `[ZOOM_MIN, ZOOM_MAX]`; a pointer displacement of <8px delivers a tap to the tile under the cursor, ≥8px pans without triggering interaction; with a zombie selected, a scripted tap on a customer opens the infect card (not a floor move) per §8.6.

**Purity, canon & performance**
- AC-20: ESLint fails on `import ... from 'phaser'` inside `src/engine/` **and `src/sim/`** (rule-level test), and the meta-test greps engine sources clean; the entire engine test suite runs in Node with no `window`/DOM shims in <1s.
- AC-21 (constants canon): `Tools/artconfig.json` deep-equals the corresponding `IsoConfig` exports; the test lands at M1, before any art generation.
- AC-22 (relative perf budgets — replaces flaky absolute-ms assertions): in the same CI process, a calibration loop (fixed arithmetic workload) is timed; then (a) 20-walker full re-plan on a 17×16 grid at 25% density must cost < K₁× calibration, (b) single worst-case `findPath` < K₂× calibration, (c) 272-tile floor re-bake < K₃× calibration, with generous absolute ceilings at 3× target as a backstop (initial K values committed with the benchmark, tuned once on the actual runner). Real-device 60fps verification is the manual per-milestone device checklist (§12.6), not a CI assertion.
- AC-23: In the running game (Playwright + `game.renderer` stats hook): the floor layer contributes exactly 1 draw call; a CPU-throttled (4×) chromium perf smoke completes the boot-and-walk scenario without a frame >100ms after warmup.
- AC-24: Boot smoke (chromium + WebKit): game boots to the engine-driven room, a customer walks door→seat→door along tile centers (positions sampled and asserted on-grid) — driven by injected synthetic dt through the harness clock (the §6.1 mechanism; no time-scale constant exists to leak into production), and no `cafe_bg` texture is present in the texture manager after M5.

---

## 14. Review notes (critiques not applied as written, and why)

1. **"Door belongs in the back wall (fidelity)" vs "front edge wins (fidelity)"** — the two reviewers issued *opposite* rulings, both claiming the original. Verified: the research file contains **no attestation of door placement** (its only "door"-adjacent content is the store taxonomy). Since neither ruling can cite the source of truth, this is a design decision, not a fidelity fix; it is decided (front edge) and logged with rationale and a bounded flip-surface in §0.3.1/§3.2. The Presentation spec's NE-wall door paragraph is deleted per the front-edge ruling.
2. **"Engine AC-7 tests expand(7×8→8×8), a step Progression's ladder never performs"** — true against Progression's *legacy-Unity* ladder, which this revision deletes in favor of the research-anchored table (whose first step **is** 7×8→8×8, per "$3,500 to reach '8 squares'"). The AC is additionally parameterized on `expansion.json` (AC-7) so it can never desync from a future retune. The critique's premise (two ladders) was valid; its specific AC fix became moot once the research ladder won.
3. **"Alternatively allow selling furniture from Storage at 50%" (soft-lock fix, option B)** — rejected at the engine level. The research is explicit and the same review's fidelity critic demanded the opposite ("storage-only, never sold" as the engine contract). The soft-lock is real but is solved by the service loop's Union-Rep pity grant (option A of the same critique), which is on-pillar friction removal without breaking a documented original behavior. The engine now states the no-sell contract normatively (§0.3.3, §7).
4. **"Progression owns `expansion.json`" vs "adopt the Iso table verbatim"** — merged rather than picking one: there is exactly one file (`src/data/expansion.json`); this spec owns its geometry column (research-anchored dims, 17×16 max), Progression owns costs/gates (dual-currency per Pillar 3). Both critics' underlying demand — one table — is satisfied.
5. **"Adopt one canonical rating scale (recommend service's 0–1000)"** — out of this spec's jurisdiction and noted only because the engine-engineer critic bundled it: the engine has zero rating dependencies. The rating canon decision (the fidelity critic and completeness critic both recommend Progression's 0–100 S+D+B, against the engine critic's 0–1000) belongs to the rating-canon reconciliation, and nothing in this spec constrains it.
6. **"Make daydream auto-resume noticeably long" (modernization-stack bundle)** — staff-spec scope; the engine's only contribution is that dispatch remains a per-tap engine call (`requestMove`), so re-tasking friction is fully tunable above the engine. No engine change.
7. **The old spec's "DEMO_TIME_SCALE is orthaogonal and untouched" line** — the review didn't flag it directly at this spec, but the cross-cutting time-model resolution deletes that constant; the sentence is removed and replaced by the §6.1 dt-injection harness contract so this spec can't be cited to keep the knob alive.

### Missing-items coverage map (engine-relevant subset)

| Missing item | Where addressed |
|---|---|
| Cross-spec constants registry | §0.1, `IsoConfig.ts`, AC-21 (this spec's half; `src/sim/tuning.ts` is the economy half, simulation-core spec) |
| Unified offline-settlement engine | §6.4 contract (`MAX_LIVE_CATCHUP`, routing obligation); OfflineEngine itself: simulation-core spec |
| Input-mode arbitration | §8.6 (normative mode-stack table) |
| Test-time acceleration replacing DEMO_TIME_SCALE | §6.1 + AC-24 (dt/clock injection; no scale constant exists in production) |
| Corrupted-but-parseable layout / degradation UX | §10.5 sanitizer + AC-17 (quota/disabled-storage/blob-corruption UX: save-system spec) |
| Expansion × door relocation × cache invalidation ordering | §3.4 atomic-expand contract |
| Browser matrix / non-chromium testing | AC-19/AC-24 add WebKit Playwright projects for engine smokes (full matrix: engineering-infra spec) |
| Mobile-perf AC method | §12.6 + AC-22/AC-23 (relative CI budgets + throttled proxy + manual device checklist) |
| Settings (reduced motion) | §6.3 reduced-motion behavior for bob/sway (settings spec owns the flag) |
| i18n decision | §9.3 — engine ships zero strings, machine codes only |
| Outdoor/exterior decor | §0.3.4 — explicit deferral, schema slot reserved |
| Not engine-relevant (Magic Fridge, serum barrel, Toxin-upgraded stoves, friend-recipe substitute, seasonal cafes, original dish names, licensing/LICENSE, telemetry, return hooks, settings spec, empty states, pity mechanic, deploy hygiene, multi-tab locks) | Delegated with pointers where the engine touches them (§0.2, §7, §10.3, §10.4); ownership: service-loop / progression / raids / save-system / engineering-infra / licensing specs per the reconciliation pass |


## Acceptance criteria

- [ ] AC-1: 10,000 seeded points in the 17x16 room round-trip tileToWorld(worldToTileF(p)) within 1e-9, and screen-to-tile-to-screen via mock camera at zooms {0.5, 1.0, 1.37, 2.0} errs < 0.5px
- [ ] AC-2: worldToTile(center of t) === t for every tile in a 17x16 room; points 1px inside each diamond edge midpoint resolve correctly, 1px outside resolve to the neighbor
- [ ] AC-3: rightWallSectionTopLeft/leftWallSectionTopLeft satisfy the section base-edge corner equations for all indices in a 17x16 room
- [ ] AC-4: canPlace rejects OOB/overlap (all four footprint shapes)/door-tile; place-then-remove restores an identical canonical placement-form hash (idCounter excluded); idCounter strictly increases and round-trips through serialize/deserialize
- [ ] AC-5: a 2x2 item at (2,2) blocks exactly cells (2,2),(3,2),(2,3),(3,3)
- [ ] AC-6: seats() derives seats only for table-adjacent chairs; removing the table removes the seat; moveItem preserves the chair's PlacementId (seatId stability)
- [ ] AC-7: parameterized on src/data/expansion.json — first ladder step (7x8 to 8x8) preserves all placements/skins, version increments once, exactly one 'expanded' event fires post-consistency with correct doorMoved flag; max-dims case (17x16) matches documented roomBounds world extent
- [ ] AC-8: a registered removal guard vetoing an id makes canRemove return the veto code, remove throw, and PlacementSession refuse move mode; default is allow
- [ ] AC-9: property test over 1,000 seeded 25%-density layouts — every path starts at from, ends at to, steps are 4-adjacent, and no step lands on an occupied cell
- [ ] AC-10: empty-grid path length = Manhattan distance + 1; (0,0)->(5,5) contains exactly one direction change (turn-penalty minimality)
- [ ] AC-11: enclosed target yields blocked; en-route walker freezes exactly on a tile center; removing one wall emits 'resumed' with a valid path with no external re-trigger; identical queries are byte-identical across 100 runs
- [ ] AC-12: 2x2 stove at (2,2): character at (1,1) below, (4,4) above, (4,2) equal-key resolved on top via +8 bias; character depth strictly monotonic in fy along a SW walk
- [ ] AC-13: grep-enforced — no setDepth call sites in src/ outside depth.ts-derived values and the HUD constant
- [ ] AC-14: arrival snaps pos to destination center within 1e-6 and state idle; 10-tile straight run at zombieTilesPerSec(7) matches distance/speed within the +-10% seeded noise bound
- [ ] AC-14b: speed goldens — zombieTilesPerSec(1)=0.54, (7)=1.08, (12)=1.53; CUSTOMER_SPEED=2.0, CUSTOMER_ANGRY_SPEED=2.6, RAIDER_FLEE_SPEED=2.2 exported, and no other speed constants match a repo-wide grep outside src/engine/move/speed.ts
- [ ] AC-15: furniture placed on the remaining path triggers re-plan before the next step commit; walker never occupies a newly-blocked cell; dev-mode tick(dt > MAX_LIVE_CATCHUP) asserts, production clamps and warns once
- [ ] AC-16: serialize/deserialize/serialize is byte-identical for the starter layout and a randomized 17x16 layout; committed pre-layout save fixture migrates at the ledger-assigned version with prior fields preserved and starter layout injected
- [ ] AC-17: corrupted fixture (OOB placement, overlap, unknown itemId, off-edge door, short floors array, stale idCounter) deserializes without throwing; evicted items land in storage; repairs enumerates every fix; result re-serializes to a valid round-tripping layout
- [ ] AC-18: starterLayout.json CI invariants — >=1 stove, >=1 counter, >=1 sink, >=1 seat, door on a front edge, and findPath(door -> interaction cell) succeeds for every station and seat
- [ ] AC-19: Playwright boot smoke on chromium AND WebKit — camera stays within room AABB + 96px and zoom within [0.4, 2.0] after scripted abuse; <8px pointer displacement taps the tile under the cursor, >=8px pans without interaction; tap-on-customer with a zombie selected opens the infect card per the input-mode stack
- [ ] AC-20: ESLint bans phaser imports inside src/engine/ AND src/sim/ (rule-level test) plus grep meta-test; full engine suite runs in Node with no DOM shims in <1s
- [ ] AC-21: Tools/artconfig.json deep-equals the corresponding IsoConfig exports; test lands at M1 before any art generation
- [ ] AC-22: relative CI perf budgets against an in-process calibration loop — 20-walker re-plan storm, single worst-case findPath, and 272-tile floor re-bake each under committed K-multiples with 3x-target absolute ceilings; real-device 60fps moved to the manual per-milestone device checklist
- [ ] AC-23: floor layer contributes exactly 1 draw call (renderer stats hook); CPU-throttled (4x) chromium perf smoke completes boot-and-walk with no frame >100ms after warmup
- [ ] AC-24: boot smoke (chromium + WebKit) — engine-driven room boots, a customer walks door->seat->door on tile centers driven by injected synthetic dt (harness clock, no time-scale constant in production), and no cafe_bg texture remains in the texture manager after M5
