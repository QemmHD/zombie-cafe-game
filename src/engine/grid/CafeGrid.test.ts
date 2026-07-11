import { describe, it, expect } from 'vitest';
import { CafeGrid, starterLayout, FLOOR_DEFAULT, type FootprintItem, type ItemCatalog } from './CafeGrid';

const ITEMS: Record<string, FootprintItem> = {
  stove_01: { itemId: 'stove_01', kind: 'stove', w: 2, h: 2 },
  table_01: { itemId: 'table_01', kind: 'table', w: 1, h: 1 },
  chair_01: { itemId: 'chair_01', kind: 'chair', w: 1, h: 1 },
  decor_01: { itemId: 'decor_01', kind: 'decor', w: 1, h: 1 },
};
const catalog: ItemCatalog = (id) => ITEMS[id] ?? null;

describe('CafeGrid placement', () => {
  it('starter room is 7x8 with the door on the front edge', () => {
    const g = CafeGrid.starter(catalog);
    expect([g.w, g.h]).toEqual([7, 8]);
    expect(g.door()).toEqual({ tx: 3, ty: 0 });
    expect(g.walkable({ tx: 0, ty: 0 })).toBe(true);
  });

  it('a 2x2 stove consumes exactly its footprint', () => {
    const g = CafeGrid.starter(catalog);
    const id = g.place(ITEMS.stove_01, { tx: 1, ty: 1 }, 0);
    for (const [tx, ty] of [[1, 1], [2, 1], [1, 2], [2, 2]] as const) {
      expect(g.walkable({ tx, ty })).toBe(false);
      expect(g.placementAt({ tx, ty })?.id).toBe(id);
    }
    expect(g.walkable({ tx: 3, ty: 1 })).toBe(true);
    expect(g.walkable({ tx: 0, ty: 0 })).toBe(true);
  });

  it('rot=1 swaps the footprint', () => {
    const g = CafeGrid.starter(catalog);
    const wide: FootprintItem = { itemId: 'counter', kind: 'counter', w: 2, h: 1 };
    g.place(wide, { tx: 1, ty: 1 }, 1);
    expect(g.walkable({ tx: 1, ty: 1 })).toBe(false);
    expect(g.walkable({ tx: 1, ty: 2 })).toBe(false);
    expect(g.walkable({ tx: 2, ty: 1 })).toBe(true);
  });

  it('rejects overlap, out-of-bounds, and the door tile', () => {
    const g = CafeGrid.starter(catalog);
    g.place(ITEMS.decor_01, { tx: 2, ty: 2 }, 0);
    expect(g.canPlace(ITEMS.decor_01, { tx: 2, ty: 2 }, 0)).toEqual({ ok: false, reason: 'occupied' });
    expect(g.canPlace(ITEMS.stove_01, { tx: 6, ty: 6 }, 0)).toEqual({ ok: false, reason: 'oob' });
    expect(g.canPlace(ITEMS.decor_01, g.door(), 0)).toEqual({ ok: false, reason: 'door' });
  });

  it('canPlace flags cells under live characters', () => {
    const g = CafeGrid.starter(catalog);
    g.setCharacterProbe((t) => t.tx === 4 && t.ty === 4);
    expect(g.canPlace(ITEMS.decor_01, { tx: 4, ty: 4 }, 0)).toEqual({ ok: false, reason: 'character' });
    expect(g.canPlace(ITEMS.decor_01, { tx: 5, ty: 4 }, 0)).toEqual({ ok: true });
  });

  it('remove is non-destructive: item lands in storage', () => {
    const g = CafeGrid.starter(catalog);
    const id = g.place(ITEMS.decor_01, { tx: 2, ty: 2 }, 0);
    g.remove(id);
    expect(g.walkable({ tx: 2, ty: 2 })).toBe(true);
    expect(g.storageContents().get('decor_01')).toBe(1);
  });

  it('removal guard vetoes removal with a machine reason', () => {
    const g = CafeGrid.starter(catalog);
    const id = g.place(ITEMS.stove_01, { tx: 1, ty: 1 }, 0);
    g.setRemovalGuard((pid) => (pid === id ? { ok: false, reason: 'stove-cooking' } : { ok: true }));
    expect(g.canRemove(id)).toEqual({ ok: false, reason: 'stove-cooking' });
    expect(() => g.remove(id)).toThrow(/stove-cooking/);
  });

  it('moveItem preserves the placement id (seat/stove references survive)', () => {
    const g = CafeGrid.starter(catalog);
    const id = g.place(ITEMS.table_01, { tx: 2, ty: 2 }, 0);
    expect(g.moveItem(id, { tx: 4, ty: 4 }, 0)).toBe(true);
    expect(g.placementAt({ tx: 4, ty: 4 })?.id).toBe(id);
    expect(g.walkable({ tx: 2, ty: 2 })).toBe(true);
    // Moving onto itself (overlap with own footprint) is legal
    expect(g.moveItem(id, { tx: 4, ty: 4 }, 0)).toBe(true);
  });

  it('version bumps on every mutation (walkers watch this)', () => {
    const g = CafeGrid.starter(catalog);
    const v0 = g.version;
    const id = g.place(ITEMS.decor_01, { tx: 1, ty: 1 }, 0);
    g.moveItem(id, { tx: 2, ty: 1 }, 0);
    g.setFloorSkin({ tx: 0, ty: 0 }, 'floor_marble');
    g.remove(id);
    expect(g.version).toBe(v0 + 4);
  });
});

describe('seats', () => {
  it('derives seats only from chairs orthogonally adjacent to tables', () => {
    const g = CafeGrid.starter(catalog);
    const tableId = g.place(ITEMS.table_01, { tx: 3, ty: 3 }, 0);
    const chairId = g.place(ITEMS.chair_01, { tx: 3, ty: 4 }, 0); // south of table
    g.place(ITEMS.chair_01, { tx: 0, ty: 0 }, 0); // orphan chair, no table
    const seats = g.seats();
    expect(seats).toHaveLength(1);
    expect(seats[0]).toMatchObject({ chairId, tableId, tile: { tx: 3, ty: 4 }, facing: 'NE' });
  });
});

describe('interaction cells', () => {
  it('returns the walkable perimeter neighbors of a footprint', () => {
    const g = CafeGrid.starter(catalog);
    const id = g.place(ITEMS.stove_01, { tx: 1, ty: 1 }, 0); // covers (1..2, 1..2)
    const cells = g.interactionCells(id);
    // 2x2 footprint has 8 orthogonal perimeter neighbors, all walkable here
    expect(cells).toHaveLength(8);
    for (const c of cells) expect(g.walkable(c)).toBe(true);
    // Block one neighbor; it drops out
    g.place(ITEMS.decor_01, { tx: 3, ty: 1 }, 0);
    expect(g.interactionCells(id)).toHaveLength(7);
  });
});

describe('expansion', () => {
  it('preserves placements and floor skins; pads with defaults; keeps door on front edge', () => {
    const g = CafeGrid.starter(catalog);
    const id = g.place(ITEMS.stove_01, { tx: 1, ty: 1 }, 0);
    g.setFloorSkin({ tx: 0, ty: 0 }, 'floor_marble');
    g.expand(8, 9);
    expect([g.w, g.h]).toEqual([8, 9]);
    expect(g.placementAt({ tx: 1, ty: 1 })?.id).toBe(id);
    expect(g.cellAt({ tx: 0, ty: 0 }).floorId).toBe('floor_marble');
    expect(g.cellAt({ tx: 7, ty: 8 }).floorId).toBe(FLOOR_DEFAULT);
    const d = g.door();
    expect(d.tx === 0 || d.ty === 0).toBe(true);
    expect(g.expansionTier).toBe(1);
    expect(() => g.expand(7, 8)).toThrow(/shrink/);
  });
});

describe('persistence', () => {
  it('serialize -> constructor round-trips the full layout', () => {
    const g = CafeGrid.starter(catalog);
    g.place(ITEMS.stove_01, { tx: 1, ty: 1 }, 0);
    g.place(ITEMS.chair_01, { tx: 4, ty: 4 }, 0);
    g.setFloorSkin({ tx: 2, ty: 5 }, 'floor_checker');
    g.setWallSkin('right', 2, 'wall_brick');
    g.placeWallDecor('walldecor_01', 'left', 1, 2);
    g.addToStorage('decor_01', 3);
    const l = g.serialize();
    const g2 = new CafeGrid(l, catalog);
    expect(g2.serialize()).toEqual(l);
    expect(g2.seats()).toEqual(g.seats());
  });

  it('deserialize sanitizes: oob/overlap/unknown placements evict to storage, never throw', () => {
    const l = starterLayout();
    l.placements = [
      { id: 'p_1', itemId: 'stove_01', x: 6, y: 6, rot: 0 }, // 2x2 out of a 7x8 room -> oob
      { id: 'p_2', itemId: 'ghost_item', x: 1, y: 1, rot: 0 }, // unknown item
      { id: 'p_3', itemId: 'decor_01', x: 2, y: 2, rot: 0 }, // fine
      { id: 'p_4', itemId: 'decor_01', x: 2, y: 2, rot: 0 }, // overlaps p_3
    ];
    l.idCounter = 0; // lower than max id present -> must be raised
    const { grid, repairs } = CafeGrid.deserialize(l, catalog);
    expect(grid.placements().size).toBe(1);
    expect(grid.storageContents().get('stove_01')).toBe(1);
    expect(grid.storageContents().get('ghost_item')).toBe(1);
    expect(grid.storageContents().get('decor_01')).toBe(1);
    const kinds = repairs.map((r) => r.kind);
    expect(kinds.filter((k) => k === 'placement-evicted')).toHaveLength(3);
    expect(kinds).toContain('idCounter-raised');
    // New ids never collide with the survivor
    const nid = grid.place(ITEMS.decor_01, { tx: 5, ty: 5 }, 0);
    expect(nid).not.toBe('p_3');
  });

  it('deserialize repairs bad door and wrong-length arrays', () => {
    const l = starterLayout();
    l.door = { x: 2, y: 2 }; // not a back edge
    l.floors = ['floor_default']; // wrong length
    l.wallsRight = []; // wrong length
    const { grid, repairs } = CafeGrid.deserialize(l, catalog);
    expect(grid.door()).toEqual({ tx: 3, ty: 0 });
    expect(repairs.map((r) => r.kind)).toEqual(
      expect.arrayContaining(['door-relocated', 'floors-resized', 'walls-resized']),
    );
  });
});
