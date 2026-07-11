import { describe, it, expect } from 'vitest';
import { BAND, characterSortKey, entityDepth, furnitureSortKey } from './depth';
import type { Placement } from './grid/CafeGrid';

const place = (tx: number, ty: number, w: number, h: number): Placement => ({
  id: 'p_1',
  itemId: 'x',
  kind: 'stove',
  anchor: { tx, ty },
  rot: 0,
  footprint: { w, h },
});

describe('depth canon', () => {
  it('bands are ordered floor < overlay < wall < entity < fx', () => {
    expect(BAND.FLOOR).toBeLessThan(BAND.FLOOR_OVERLAY);
    expect(BAND.FLOOR_OVERLAY).toBeLessThan(BAND.WALL);
    expect(BAND.WALL).toBeLessThan(BAND.ENTITY);
    expect(BAND.ENTITY).toBeLessThan(BAND.FX_WORLD);
  });

  it('furniture sorts by front-corner tile sum', () => {
    expect(furnitureSortKey(place(1, 1, 2, 2))).toBe(4); // front corner (2,2)
    expect(furnitureSortKey(place(3, 0, 1, 1))).toBe(3);
  });

  it('a character in front of a 2x2 stove draws in front; behind draws behind', () => {
    const stove = entityDepth(furnitureSortKey(place(1, 1, 2, 2)), false); // key 4
    const inFront = entityDepth(characterSortKey(2, 3.2), true); // key 5.2
    const behind = entityDepth(characterSortKey(1, 0.4), true); // key 1.4
    expect(inFront).toBeGreaterThan(stove);
    expect(behind).toBeLessThan(stove);
  });

  it('the +8 character bias wins the classic equal-sum tie', () => {
    const stove = entityDepth(furnitureSortKey(place(1, 1, 2, 2)), false); // key 4
    const beside = entityDepth(characterSortKey(3, 1), true); // key 4 too
    expect(beside).toBe(stove + 8);
  });

  it('the 17x16 endgame stays comfortably inside the entity band', () => {
    const maxKey = 16 + 15; // front corner of the far tile
    expect(entityDepth(maxKey, true)).toBeLessThan(BAND.FX_WORLD);
  });
});
