/*
 * data.js — Static game data & tuning constants.
 * Original fan recreation of the "Zombie Cafe" management loop — isometric
 * diner, zombie staff, cooking, infecting and raids. All-original art & data.
 */
(function (ZC) {
  'use strict';

  ZC.CONFIG = {
    // Isometric grid
    cols: 9,
    rows: 8,
    tileW: 58,        // iso tile width  (screen)
    tileH: 29,        // iso tile height (screen)  -> 2:1 iso
    wallH: 74,        // back wall height
    margin: 30,

    // Starting resources
    startCoins: 450,
    startToxin: 18,
    startFlesh: 5,

    // Zombie cap
    baseMaxZombies: 4,

    // Spawning  (slower, gradual real-time build-up)
    spawnIntervalBase: 5.4,
    spawnIntervalMin: 1.5,
    maxCustomers: 16,

    // Customer behaviour
    customerPatience: 34,
    eatTime: 4.5,
    customerSpeed: 1.7,        // tiles / second

    // Zombie behaviour
    zombieSpeed: 2.5,          // tiles / second
    zombieMaxEnergy: 100,
    serveEnergyCost: 10,
    energyDrainIdle: 0.35,
    energyDrainTending: 1.2,   // tending a stove costs energy
    tendSpeedMultiplier: 2.2,  // a tended stove cooks this much faster
    energyRegenRest: 8,
    fleshFeedAmount: 60,

    // Economy
    infectCost: 8,
    fleshPerToxin: 3,
    raidDuration: 24,
    raidCooldown: 32,

    // Modern extras
    refundRate: 0.6,        // selling furniture refunds this fraction
    vipBaseChance: 0.06,    // chance a customer is a VIP (scales with appeal)
    offlineCapMin: 480,     // max minutes of "while you were away" earnings

    autosaveInterval: 12
  };

  ZC.CONFIG.maxZombies = function (level, tables) {
    return ZC.CONFIG.baseMaxZombies + Math.floor(tables / 2) + Math.floor(level / 2);
  };

  // Dishes. Higher tiers cost more & cook slower but pay far more.
  // station: which appliance type cooks it (kettle = stove/drinks, grill = hot food, oven = baked)
  ZC.RECIPES = [
    { id: 'coffee', name: 'Bone Brew Coffee', cost: 15,  cookTime: 8,  servings: 3, price: 18,  unlockLevel: 1, station: 'stove', color: '#6f4e37', icon: '☕' },
    { id: 'fries',  name: 'Finger Fries',     cost: 40,  cookTime: 13, servings: 4, price: 26,  unlockLevel: 1, station: 'grill', color: '#e0a93b', icon: '🍟' },
    { id: 'burger', name: 'Brain Burger',     cost: 95,  cookTime: 20, servings: 4, price: 56,  unlockLevel: 2, station: 'grill', color: '#b5651d', icon: '🍔' },
    { id: 'soup',   name: 'Eyeball Soup',     cost: 150, cookTime: 26, servings: 5, price: 80,  unlockLevel: 3, station: 'stove', color: '#7bbf5a', icon: '🍲' },
    { id: 'pizza',  name: 'Zombie Pizza',     cost: 280, cookTime: 34, servings: 6, price: 128, unlockLevel: 4, station: 'oven',  color: '#d23b2e', icon: '🍕' },
    { id: 'cake',   name: 'Graveyard Cake',   cost: 520, cookTime: 44, servings: 6, price: 232, unlockLevel: 6, station: 'oven',  color: '#9b59b6', icon: '🍰' }
  ];

  ZC.recipeById = function (id) {
    for (var i = 0; i < ZC.RECIPES.length; i++) if (ZC.RECIPES[i].id === id) return ZC.RECIPES[i];
    return null;
  };

  ZC.SHOP = [
    { id: 'table', name: 'Table',        cost: 120, type: 'table',  appeal: 0,  desc: 'Seats one customer.' },
    { id: 'stove', name: 'Stove',        cost: 320, type: 'stove',  appeal: 0,  desc: 'Cooks dishes automatically. Tap it to choose the recipe.' },
    { id: 'plant', name: 'Spooky Plant', cost: 80,  type: 'decor',  appeal: 6,  desc: 'Raises appeal — customers arrive faster.' },
    { id: 'lamp',  name: 'Gore Lamp',    cost: 140, type: 'decor',  appeal: 11, desc: 'Raises appeal — customers arrive faster.' },
    { id: 'rug',   name: 'Bloody Rug',   cost: 220, type: 'decor',  appeal: 18, desc: 'Raises appeal — customers arrive faster.' },
    { id: 'juke',  name: 'Creepy Jukebox', cost: 420, type: 'decor', appeal: 30, desc: 'Big appeal boost — packs the place out.' }
  ];

  ZC.shopById = function (id) {
    for (var i = 0; i < ZC.SHOP.length; i++) if (ZC.SHOP[i].id === id) return ZC.SHOP[i];
    return null;
  };

  ZC.xpForLevel = function (level) { return Math.floor(120 * Math.pow(level, 1.45)); };

  // Goals — each has a target and a one-time reward. progress(G) returns a count.
  ZC.QUESTS = [
    { id: 'serve25',  name: 'Serve 25 customers',     target: 25,  reward: { coins: 200 }, progress: function (G) { return G.stats.served; } },
    { id: 'level3',   name: 'Reach level 3',          target: 3,   reward: { toxin: 10 }, progress: function (G) { return G.level; } },
    { id: 'tables6',  name: 'Own 6 tables',           target: 6,   reward: { coins: 300 }, progress: function (G) { return G.tables.length; } },
    { id: 'infect3',  name: 'Infect 3 customers',     target: 3,   reward: { toxin: 15 }, progress: function (G) { return G.stats.infected; } },
    { id: 'zombies5', name: 'Raise 5 zombies',        target: 5,   reward: { toxin: 20 }, progress: function (G) { return G.zombies.length; } },
    { id: 'raids3',   name: 'Complete 3 city raids',  target: 3,   reward: { flesh: 8 }, progress: function (G) { return G.stats.raids; } },
    { id: 'juke',     name: 'Install a Creepy Jukebox', target: 1, reward: { coins: 250 }, progress: function (G) { return G.decor.some(function (d) { return d.itemId === 'juke'; }) ? 1 : 0; } },
    { id: 'serve150', name: 'Serve 150 customers',    target: 150, reward: { toxin: 30 }, progress: function (G) { return G.stats.served; } }
  ];
  ZC.questById = function (id) { for (var i = 0; i < ZC.QUESTS.length; i++) if (ZC.QUESTS[i].id === id) return ZC.QUESTS[i]; return null; };

  ZC.CUSTOMER_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#1abc9c', '#e67e22', '#9b59b6', '#2980b9', '#16a085'];

})(window.ZC || (window.ZC = {}));
