// Central tuning constants for Undead Diner (tap-the-world isometric café).
export const CFG = {
  // Chunky iso tiles sized so the whole café fits the (portrait) design canvas.
  tileW: 66,
  tileH: 33,
  gridCols: 9,
  gridRows: 8,
  designW: 600,
  designH: 680,
  charScale: 0.74,

  startUsableCols: 7,
  startUsableRows: 6,

  startMoney: 700,
  startToxin: 20,
  startFlesh: 5,

  spawnIntervalBase: 4.5,
  spawnIntervalMin: 1.6,
  customerPatience: 32,
  eatTime: 4,
  customerSpeed: 1.7,
  maxCustomers: 8,

  zombieSpeed: 2.1,
  zombieMaxEnergy: 100,
  serveCost: 6,
  cleanCost: 5,
  cookCost: 4,
  energyRegen: 8,
  tiredThreshold: 25,
  fleshFeed: 60,

  infectCost: 8,
  fleshPerToxin: 3,
  toxinPerAdd: 5,
  refundRate: 0.6,

  ratingDropAngry: 0.18,
  ratingDropDirty: 0.04,
  ratingGainServe: 0.05,
  ratingMax: 5,
  ratingMin: 0.5,

  raidCooldown: 30,
  autosave: 10
};

export type StationType = 'stove' | 'grill' | 'oven';
