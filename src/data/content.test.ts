import { describe, it, expect } from 'vitest';
import { DISHES, ZOMBIES, FURNITURE, getDish, getZombie, dishesForLevel, commonZombies } from './content';

// Data-catalog integrity: the 1,052 ported entries are the game's balance backbone.
// These invariants must hold for every regeneration of src/data/*.json.

describe('dish catalog', () => {
  it('has the full ported set', () => {
    expect(DISHES.length).toBe(320);
  });

  it('every dish has a positive cook time and coin reward', () => {
    for (const d of DISHES) {
      expect(d.cookTimeSeconds, d.dishId).toBeGreaterThan(0);
      expect(d.coinReward, d.dishId).toBeGreaterThan(0);
      expect(d.cafeLevelRequired, d.dishId).toBeGreaterThanOrEqual(1);
    }
  });

  it('has unique ids and lookup works', () => {
    const ids = new Set(DISHES.map((d) => d.dishId));
    expect(ids.size).toBe(DISHES.length);
    expect(getDish('dish_brainburger')?.displayName).toBe('Brain Burger');
  });

  it('level 1 offers starter dishes, sorted fastest-first', () => {
    const starters = dishesForLevel(1);
    expect(starters.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < starters.length; i++) {
      expect(starters[i].cookTimeSeconds).toBeGreaterThanOrEqual(starters[i - 1].cookTimeSeconds);
    }
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
