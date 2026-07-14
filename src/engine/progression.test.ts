import { describe, it, expect } from 'vitest';
import { applyXP, cookStartXP, perServingXP, xpToNext } from './progression';

describe('progression', () => {
  it('curve grows monotonically and starts near the documented scale', () => {
    expect(xpToNext(1)).toBeGreaterThanOrEqual(80);
    expect(xpToNext(1)).toBeLessThanOrEqual(120);
    for (let l = 1; l < 60; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });

  it('a dish pays exactly its XP across cook start + all servings', () => {
    const dishXP = 90;
    const servings = 12;
    const total = cookStartXP(dishXP) + perServingXP(dishXP, servings) * servings;
    expect(total).toBeCloseTo(dishXP, 6);
  });

  it('applyXP consumes thresholds and can multi-level', () => {
    const r = applyXP(1, 0, xpToNext(1) + xpToNext(2) + 5);
    expect(r.level).toBe(3);
    expect(r.levels).toBe(2);
    expect(r.xp).toBe(5);
  });

  it('applyXP respects the cap', () => {
    const r = applyXP(99, 0, 10_000);
    expect(r.level).toBe(99);
    expect(r.levels).toBe(0);
  });
});
