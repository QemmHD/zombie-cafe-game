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

  it('character/furniture depth ties are arithmetically impossible (canon rev 3)', () => {
    // Sweep a character across a full 2x2-stove pass at 1/64-tile sampling:
    // furniture depths are ≡0 (mod 16), characters ≡8 — never equal.
    const stove = entityDepth(furnitureSortKey(place(1, 1, 2, 2)), false);
    for (let sum = 3; sum <= 5; sum += 1 / 64) {
      const c = entityDepth(characterSortKey(sum, 0), true);
      expect(c).not.toBe(stove);
      expect(c % 16).toBe(8);
    }
    expect(stove % 16).toBe(0);
    // Exactly one flip per pass, at fractional sum 0.5 of the stove's key
    expect(entityDepth(characterSortKey(3.49, 0), true)).toBeLessThan(stove);
    expect(entityDepth(characterSortKey(3.5, 0), true)).toBeGreaterThan(stove);
  });

  it('the 17x16 endgame stays comfortably inside the entity band', () => {
    const maxKey = 16 + 15; // front corner of the far tile
    expect(entityDepth(maxKey, true)).toBeLessThan(BAND.FX_WORLD);
  });
});
