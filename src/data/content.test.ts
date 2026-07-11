import { describe, it, expect } from 'vitest';
import { DISHES, ZOMBIES, FURNITURE, getDish, getZombie, dishesForLevel, commonZombies } from './content';

// Data-catalog integrity: the 1,052 ported entries are the game's balance backbone.
// These invariants must hold for every regeneration of src/data/*.json.

describe('dish catalog (authentic 216-recipe table, spec 93 Appendix A)', () => {
  it('has the complete original recipe set', () => {
    expect(DISHES.length).toBe(216);
  });

  it('every dish has a positive cook time and gross income = servings * perServing', () => {
    for (const d of DISHES) {
      expect(d.cookTimeSeconds, d.dishId).toBeGreaterThan(0);
      expect(d.coinReward, d.dishId).toBe(d.servings * d.perServing);
      expect(d.coinReward, d.dishId).toBeGreaterThan(0);
      expect(d.cafeLevelRequired, d.dishId).toBeGreaterThanOrEqual(1);
    }
  });

  it('has unique ids and lookup works', () => {
    const ids = new Set(DISHES.map((d) => d.dishId));
    expect(ids.size).toBe(DISHES.length);
    expect(getDish('dish_mystery_meat')?.displayName).toBe('Mystery Meat');
  });

  it('level 1 offers the two original starters, fastest first', () => {
    const starters = dishesForLevel(1);
    expect(starters.map((d) => d.displayName)).toEqual(['Mystery Meat', 'Hobo Delight']);
    expect(starters[0].cookTimeSeconds).toBe(120);
  });

  it('unlocks span the original level curve (2-minute snack to 72-hour feast)', () => {
    expect(Math.min(...DISHES.map((d) => d.cookTimeSeconds))).toBe(120);
    expect(Math.max(...DISHES.map((d) => d.cookTimeSeconds))).toBe(259200);
    expect(Math.max(...DISHES.map((d) => d.cafeLevelRequired))).toBe(83);
  });
});

describe('zombie catalog', () => {
  it('has the full ported set with valid rarities', () => {
    expect(ZOMBIES.length).toBe(105);
    for (const z of ZOMBIES) {
      expect(z.rarity, z.zombieId).toBeGreaterThanOrEqual(0);
      expect(z.rarity, z.zombieId).toBeLessThanOrEqual(4);
      expect(z.baseHP, z.zombieId).toBeGreaterThan(0);
      expect(z.infectionChance, z.zombieId).toBeGreaterThan(0);
      expect(z.infectionChance, z.zombieId).toBeLessThanOrEqual(1);
    }
  });

  it('common tier exists for starter infections', () => {
    expect(commonZombies().length).toBeGreaterThanOrEqual(20);
    expect(getZombie('zombie_rotten')?.rarityLabel).toBe('common');
  });
});

describe('furniture catalog', () => {
  it('has the full ported set with priced items', () => {
    expect(FURNITURE.length).toBe(602);
    for (const f of FURNITURE) {
      expect(f.buyCost, f.furnitureId).toBeGreaterThanOrEqual(0);
    }
  });
});
