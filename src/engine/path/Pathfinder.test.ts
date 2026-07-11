import { describe, it, expect } from 'vitest';
import { findPath, type WalkSource } from './Pathfinder';
import type { Tile } from '../types';

/** Grid stub: '.' walkable, '#' blocked. Rows are ty, columns tx. */
function gridOf(rows: string[]): WalkSource {
  return {
    w: rows[0].length,
    h: rows.length,
    walkable: (t: Tile) =>
      t.tx >= 0 && t.ty >= 0 && t.ty < rows.length && t.tx < rows[0].length && rows[t.ty][t.tx] !== '#',
  };
}

describe('findPath', () => {
  it('finds a straight path with 4-adjacent steps only', () => {
    const g = gridOf(['....', '....', '....']);
    const r = findPath(g, { from: { tx: 0, ty: 0 }, to: { tx: 3, ty: 0 } });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.path).toEqual([
      { tx: 0, ty: 0 },
      { tx: 1, ty: 0 },
      { tx: 2, ty: 0 },
      { tx: 3, ty: 0 },
    ]);
  });

  it('never routes through a 2x2 footprint (spec AC)', () => {
    const g = gridOf(['.....', '.##..', '.##..', '.....']);
    const r = findPath(g, { from: { tx: 0, ty: 1 }, to: { tx: 4, ty: 2 } });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    for (const t of r.path) expect(g.walkable(t)).toBe(true);
  });

  it('reports blocked when the goal is walled off', () => {
    const g = gridOf(['..#.', '..#.', '..#.']);
    expect(findPath(g, { from: { tx: 0, ty: 0 }, to: { tx: 3, ty: 1 } }).status).toBe('blocked');
  });

  it('reports invalid for out-of-bounds endpoints', () => {
    const g = gridOf(['...']);
    expect(findPath(g, { from: { tx: -1, ty: 0 }, to: { tx: 2, ty: 0 } }).status).toBe('invalid');
    expect(findPath(g, { from: { tx: 0, ty: 0 }, to: { tx: 5, ty: 0 } }).status).toBe('invalid');
  });

  it('allowNonWalkableGoal reaches a chair cell; intermediate steps stay walkable', () => {
    const g = gridOf(['....', '..#.', '....']);
    const to = { tx: 2, ty: 1 }; // the chair
    expect(findPath(g, { from: { tx: 0, ty: 0 }, to }).status).toBe('blocked');
    const r = findPath(g, { from: { tx: 0, ty: 0 }, to, allowNonWalkableGoal: true });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    for (const t of r.path.slice(0, -1)) expect(g.walkable(t)).toBe(true);
    expect(r.path[r.path.length - 1]).toEqual(to);
  });

  it('turn penalty produces minimum-turn staircases (one corner, not zigzag)', () => {
    const g = gridOf(['....', '....', '....', '....']);
    const r = findPath(g, { from: { tx: 0, ty: 0 }, to: { tx: 3, ty: 3 } });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    let turns = 0;
    for (let i = 2; i < r.path.length; i++) {
      const d1 = { x: r.path[i - 1].tx - r.path[i - 2].tx, y: r.path[i - 1].ty - r.path[i - 2].ty };
      const d2 = { x: r.path[i].tx - r.path[i - 1].tx, y: r.path[i].ty - r.path[i - 1].ty };
      if (d1.x !== d2.x || d1.y !== d2.y) turns++;
    }
    expect(turns).toBe(1); // straight run, single corner, straight run
    expect(r.path.length).toBe(7); // still shortest length (6 steps)
  });

  it('is byte-identical across repeated runs (determinism contract)', () => {
    const g = gridOf(['.......', '.##.#..', '.#..#..', '.#.##..', '.......']);
    const q = { from: { tx: 0, ty: 4 }, to: { tx: 6, ty: 0 } };
    const first = JSON.stringify(findPath(g, q));
    for (let i = 0; i < 50; i++) expect(JSON.stringify(findPath(g, q))).toBe(first);
  });

  it('from === to returns the single-tile path', () => {
    const g = gridOf(['..']);
    const r = findPath(g, { from: { tx: 1, ty: 0 }, to: { tx: 1, ty: 0 } });
    expect(r).toEqual({ status: 'ok', path: [{ tx: 1, ty: 0 }] });
  });

  it('solves the 17x16 worst case fast (budget sanity)', () => {
    const rows = Array.from({ length: 16 }, () => '.'.repeat(17));
    const g = gridOf(rows);
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) findPath(g, { from: { tx: 0, ty: 0 }, to: { tx: 16, ty: 15 } });
    expect(performance.now() - t0).toBeLessThan(200); // 200 solves well under 1ms each
  });
});
