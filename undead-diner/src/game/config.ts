// Central tuning constants for Undead Diner.
export const CFG = {
  tileW: 64,
  tileH: 32,
  gridCols: 12,
  gridRows: 12,

  startUsableCols: 7,
  startUsableRows: 6,

  startMoney: 700,
  startToxin: 20,
  startFlesh: 5,

  // customers
  spawnIntervalBase: 4.2,    // seconds, faster as rating rises
  spawnIntervalMin: 1.2,
  customerPatience: 30,      // seconds seated, waiting for food
  eatTime: 4,
  customerSpeed: 1.8,        // tiles/sec

  // zombies
  zombieSpeed: 2.2,
  zombieMaxEnergy: 100,
  serveCost: 6,
  cleanCost: 5,
  cookCost: 4,
  energyRegen: 7,            // per sec while resting
  tiredThreshold: 25,        // below this, slows down
  fleshFeed: 60,

  // economy
  infectCost: 8,
  fleshPerToxin: 3,
  toxinPerAdd: 5,            // "+ " button gives this (free, demo)
  refundRate: 0.6,

  // rating
  ratingDropAngry: 0.18,
  ratingDropDirty: 0.04,
  ratingGainServe: 0.05,
  ratingMax: 5,
  ratingMin: 0.5,

  // raid
  raidCooldown: 30,

  autosave: 10,
  maxCustomers: 14
};

export type StationType = 'stove' | 'grill' | 'oven';
