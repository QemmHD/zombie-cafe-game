// Types mirror the ported JSON catalogs in src/data/*.json
// (produced by Tools/export_content_json.py from the Unity ScriptableObjects).

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Dish {
  dishId: string;
  displayName: string;
  cookTimeSeconds: number; // real idle-scale time (30s … 28800s)
  coinReward: number;
  brainReward: number;
  cafeLevelRequired: number;
}

export interface Zombie {
  zombieId: string;
  displayName: string;
  rarity: number;
  rarityLabel: Rarity;
  baseHP: number;
  baseAttack: number;
  baseSpeed: number;
  cookSpeedMult: number;   // <1 = cooks faster
  infectionChance: number; // base chance to infect a served customer
}

export interface Furniture {
  furnitureId: string;
  displayName: string;
  furnitureType: number;
  typeLabel: string;
  size?: { x: number; y: number };
  buyCost: number;
  sellValue?: number;
  cafeLevelRequired: number;
  cookSpeedBonus?: number;
  happinessBonus?: number;
}

// A zombie the player owns (roster instance), separate from its static catalog data.
export interface ZombieInstance {
  zombieId: string;
  level: number;
  xp: number;
  assignment: 'idle' | 'kitchen' | 'raiding' | 'meatlocker';
}
