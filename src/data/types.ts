// Types mirror the ported JSON catalogs in src/data/*.json
// (produced by Tools/export_content_json.py from the Unity ScriptableObjects).

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// One of the original's 216 recipes (decoded foodData table, spec 93 App. A).
export interface Dish {
  dishId: string;
  displayName: string;
  cafeLevelRequired: number;
  cookTimeSeconds: number; // authentic idle-scale time (120s … 72h)
  price: number; // paid up-front when the cook starts (M5 economy)
  servings: number; // plates produced per cook
  perServing: number; // coins per plate served
  coinReward: number; // gross income = servings * perServing
  xp: number; // cafe XP per completed dish
  imageId: number; // original art index (future dish-art mapping)
  stoveTag: number; // required stove tag; 0 = any stove
  cookbook: number; // cookbook the recipe belongs to
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
