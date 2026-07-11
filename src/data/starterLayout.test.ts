import { describe, it, expect } from 'vitest';
import { CafeGrid, findPath, type LayoutSchema } from '../engine/contracts';
import { itemCatalog } from './catalog';
import starterLayout from './starterLayout.json';

// Canon AC-22: the committed starter layout must always satisfy the
// service-loop invariants. This test exists because a hand-authored layout
// once sealed the kitchen off from the door — A* was right, the layout wrong.

describe('starter layout (canon AC-22)', () => {
  const { grid, repairs } = CafeGrid.deserialize(starterLayout as LayoutSchema, itemCatalog);

  it('loads without repairs (a repair means the committed file is invalid)', () => {
    expect(repairs).toEqual([]);
  });

  it('has the required stations and at least 3 seats', () => {
    const kinds = [...grid.placements().values()].map((p) => p.kind);
    expect(kinds.filter((k) => k === 'stove').length).toBeGreaterThanOrEqual(1);
    expect(kinds.filter((k) => k === 'counter').length).toBeGreaterThanOrEqual(1);
    expect(kinds.filter((k) => k === 'sink').length).toBeGreaterThanOrEqual(1);
    expect(grid.seats().length).toBeGreaterThanOrEqual(3);
  });

  it('every station is reachable from the door', () => {
    const door = grid.door();
    for (const p of grid.placements().values()) {
      if (!['stove', 'counter', 'sink'].includes(p.kind)) continue;
      const cells = grid.interactionCells(p.id);
      expect(cells.length, `${p.itemId} has no interaction cells`).toBeGreaterThan(0);
      const reachable = cells.some((c) => findPath(grid, { from: door, to: c }).status === 'ok');
      expect(reachable, `${p.itemId}@(${p.anchor.tx},${p.anchor.ty}) unreachable from door`).toBe(true);
    }
  });

  it('every seat is reachable from the door (goal-on-chair pathing)', () => {
    const door = grid.door();
    for (const seat of grid.seats()) {
      const r = findPath(grid, { from: door, to: seat.tile, allowNonWalkableGoal: true });
      expect(r.status, `seat ${seat.chairId} unreachable`).toBe('ok');
    }
  });

  it('the door tile is open and on a front edge', () => {
    const d = grid.door();
    expect(grid.walkable(d)).toBe(true);
    expect(d.tx === grid.w - 1 || d.ty === grid.h - 1).toBe(true);
  });
});
