/*
 * data.js — Static game data & tuning constants.
 * Original fan recreation of the "Zombie Cafe" management loop — isometric
 * diner, zombie staff, cooking, infecting and raids. All-original art & data.
 */
(function (ZC) {
  'use strict';

  ZC.CONFIG = {
    // Isometric grid (a bigger venue to grow into)
    cols: 11,
    rows: 9,
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

    // Cafe expansion (start small, renovate outward)
    startUsableCols: 6,
    startUsableRows: 5,

    autosaveInterval: 12
  };

  // Expansion cost for the next renovation given current expansion level.
  ZC.CONFIG.expandCost = function (level) {
    return { coins: Math.round(400 * Math.pow(level + 1, 1.3)), toxin: 5 * (level + 1) };
  };

  ZC.CONFIG.maxZombies = function (level, tables) {
    return ZC.CONFIG.baseMaxZombies + Math.floor(tables / 2) + Math.floor(level / 2);
  };

  // Dishes. Higher tiers cost more & cook slower but pay far more.
  // station: which appliance type cooks it (stove = drinks/soups, grill = hot food, oven = baked)
  ZC.RECIPES = [
    { id: 'coffee', name: 'Bone Brew Coffee', cost: 15,  cookTime: 8,  servings: 3, price: 18,  unlockLevel: 1, station: 'stove', color: '#6f4e37', icon: '☕' },
    { id: 'tea',    name: 'Mortuary Tea',     cost: 24,  cookTime: 9,  servings: 3, price: 24,  unlockLevel: 1, station: 'stove', color: '#8d6e63', icon: '🍵' },
    { id: 'fries',  name: 'Finger Fries',     cost: 40,  cookTime: 13, servings: 4, price: 26,  unlockLevel: 1, station: 'grill', color: '#e0a93b', icon: '🍟' },
    { id: 'burger', name: 'Brain Burger',     cost: 95,  cookTime: 20, servings: 4, price: 56,  unlockLevel: 2, station: 'grill', color: '#b5651d', icon: '🍔' },
    { id: 'soup',   name: 'Eyeball Soup',     cost: 150, cookTime: 26, servings: 5, price: 80,  unlockLevel: 3, station: 'stove', color: '#7bbf5a', icon: '🍲' },
    { id: 'wings',  name: 'Bat Wings',        cost: 130, cookTime: 19, servings: 4, price: 72,  unlockLevel: 3, station: 'grill', color: '#7e3b1d', icon: '🍗' },
    { id: 'pizza',  name: 'Zombie Pizza',     cost: 280, cookTime: 34, servings: 6, price: 128, unlockLevel: 4, station: 'oven',  color: '#d23b2e', icon: '🍕' },
    { id: 'donut',  name: 'Voodoo Donuts',    cost: 210, cookTime: 24, servings: 5, price: 104, unlockLevel: 5, station: 'oven',  color: '#e91e63', icon: '🍩' },
    { id: 'cake',   name: 'Graveyard Cake',   cost: 520, cookTime: 44, servings: 6, price: 232, unlockLevel: 6, station: 'oven',  color: '#9b59b6', icon: '🍰' }
  ];

  // Recipe mastery: selling more of a dish permanently boosts its batch & price.
  ZC.MASTERY_THRESHOLDS = [30, 100, 250];
  ZC.masteryTier = function (count) {
    var t = 0;
    for (var i = 0; i < ZC.MASTERY_THRESHOLDS.length; i++) if ((count || 0) >= ZC.MASTERY_THRESHOLDS[i]) t = i + 1;
    return t;
  };

  // Floor & wall style themes (first of each is free).
  ZC.FLOOR_THEMES = [
    { id: 'wood',   name: 'Classic Wood',  cost: 0,    a: '#5a4636', b: '#4b3a2d' },
    { id: 'checker',name: 'Diner Checker', cost: 600,  a: '#d9d2c5', b: '#37414e' },
    { id: 'crypt',  name: 'Crypt Stone',   cost: 1200, a: '#5b6470', b: '#48505a' },
    { id: 'blood',  name: 'Crimson Tile',  cost: 2400, a: '#7b241c', b: '#561a14' }
  ];
  ZC.WALL_THEMES = [
    { id: 'dusk',   name: 'Dusk Purple',  cost: 0,    left: '#3b3140', right: '#473a4a' },
    { id: 'mossy',  name: 'Mossy Stone',  cost: 700,  left: '#33402f', right: '#3e4d38' },
    { id: 'midnight',name: 'Midnight Blue',cost: 1500, left: '#1e2742', right: '#27325a' },
    { id: 'bone',   name: 'Bone White',   cost: 3000, left: '#5c5648', right: '#6b6555' }
  ];
  ZC.floorTheme = function (id) { for (var i = 0; i < ZC.FLOOR_THEMES.length; i++) if (ZC.FLOOR_THEMES[i].id === id) return ZC.FLOOR_THEMES[i]; return ZC.FLOOR_THEMES[0]; };
  ZC.wallTheme = function (id) { for (var i = 0; i < ZC.WALL_THEMES.length; i++) if (ZC.WALL_THEMES[i].id === id) return ZC.WALL_THEMES[i]; return ZC.WALL_THEMES[0]; };

  ZC.recipeById = function (id) {
    for (var i = 0; i < ZC.RECIPES.length; i++) if (ZC.RECIPES[i].id === id) return ZC.RECIPES[i];
    return null;
  };

  // Appliance types and the recipe station each one cooks.
  ZC.APPLIANCES = {
    stove: { name: 'Stove', station: 'stove', icon: '🍳', color: '#9aa4ad', dark: '#6c757d', light: '#828c95' },
    grill: { name: 'Grill', station: 'grill', icon: '🔥', color: '#5d4037', dark: '#3e2723', light: '#4e342e' },
    oven:  { name: 'Oven',  station: 'oven',  icon: '🥧', color: '#b9722e', dark: '#7e4a16', light: '#9c5e22' }
  };
  ZC.defaultRecipeFor = function (station) {
    for (var i = 0; i < ZC.RECIPES.length; i++) if (ZC.RECIPES[i].station === station) return ZC.RECIPES[i].id;
    return ZC.RECIPES[0].id;
  };

  ZC.SHOP = [
    { id: 'table', name: 'Table',        cost: 120, type: 'table',  appeal: 0,  desc: 'Seats one customer.' },
    { id: 'stove', name: 'Stove',        cost: 320, type: 'appliance', applianceType: 'stove', appeal: 0, desc: 'Cooks drinks & soups. Tap it to choose the recipe.' },
    { id: 'grill', name: 'Grill',        cost: 480, type: 'appliance', applianceType: 'grill', appeal: 0, desc: 'Cooks hot food: fries & burgers.' },
    { id: 'oven',  name: 'Oven',         cost: 760, type: 'appliance', applianceType: 'oven',  appeal: 0, desc: 'Bakes pizza & cake.' },
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
    { id: 'grill1',   name: 'Build a Grill',          target: 1,   reward: { coins: 300 }, progress: function (G) { return G.stoves.some(function (s) { return s.applianceType === 'grill'; }) ? 1 : 0; } },
    { id: 'oven1',    name: 'Build an Oven',          target: 1,   reward: { coins: 500 }, progress: function (G) { return G.stoves.some(function (s) { return s.applianceType === 'oven'; }) ? 1 : 0; } },
    { id: 'expand2',  name: 'Renovate twice',         target: 2,   reward: { toxin: 12 }, progress: function (G) { return G.expansion; } },
    { id: 'level6',   name: 'Reach level 6',          target: 6,   reward: { toxin: 25 }, progress: function (G) { return G.level; } },
    { id: 'serve150', name: 'Serve 150 customers',    target: 150, reward: { toxin: 30 }, progress: function (G) { return G.stats.served; } },
    { id: 'tables10', name: 'Own 10 tables',          target: 10,  reward: { coins: 1200 }, progress: function (G) { return G.tables.length; } },
    { id: 'serve500', name: 'Serve 500 customers',    target: 500, reward: { toxin: 60 }, progress: function (G) { return G.stats.served; } }
  ];
  ZC.questById = function (id) { for (var i = 0; i < ZC.QUESTS.length; i++) if (ZC.QUESTS[i].id === id) return ZC.QUESTS[i]; return null; };

  // Achievements auto-unlock (no claiming) and grant a one-time reward.
  ZC.ACHIEVEMENTS = [
    { id: 'first_serve', name: 'First Customer',   desc: 'Serve your first customer',     reward: { toxin: 2 },  done: function (G) { return G.stats.served >= 1; } },
    { id: 'first_zombie',name: 'Fresh Recruit',    desc: 'Infect your first customer',    reward: { toxin: 3 },  done: function (G) { return G.stats.infected >= 1; } },
    { id: 'raider',      name: 'City Raider',      desc: 'Complete a raid',               reward: { flesh: 4 },  done: function (G) { return G.stats.raids >= 1; } },
    { id: 'horde',       name: 'Undead Horde',     desc: 'Have 8 zombies at once',        reward: { toxin: 10 }, done: function (G) { return G.zombies.length >= 8; } },
    { id: 'rich',        name: 'Blood Money',      desc: 'Hold 5,000 coins',              reward: { toxin: 8 },  done: function (G) { return G.coins >= 5000; } },
    { id: 'master',      name: 'Master Chef',      desc: 'Master any recipe (tier 3)',    reward: { toxin: 15 }, done: function (G) { return Object.keys(G.mastery || {}).some(function (k) { return ZC.masteryTier(G.mastery[k]) >= 3; }); } },
    { id: 'mogul',       name: 'Cafe Mogul',       desc: 'Reach level 10',                reward: { toxin: 30 }, done: function (G) { return G.level >= 10; } },
    { id: 'franchise',   name: 'Franchise Owner',  desc: 'Prestige your cafe once',       reward: { toxin: 50 }, done: function (G) { return G.prestige >= 1; } }
  ];

  // Random limited-time events.
  ZC.EVENTS = [
    { id: 'happy', name: 'Happy Hour', icon: '🍹', desc: 'Customers pay 1.5×!', payMult: 1.5 },
    { id: 'rush',  name: 'Hungry Crowd', icon: '🏃', desc: 'Customers arrive twice as fast!', spawnMult: 0.5 },
    { id: 'toxic', name: 'Toxin Spill', icon: '🧪', desc: 'Infecting is half price!', infectMult: 0.5 }
  ];
  ZC.CONFIG.eventInterval = 110;   // seconds between event rolls
  ZC.CONFIG.eventDuration = 30;    // seconds an event lasts
  ZC.CONFIG.eventChance = 0.6;     // chance an interval spawns an event

  // Daily bonus & prestige
  ZC.CONFIG.dailyBase = 250;       // coins, grows with streak
  ZC.CONFIG.prestigeLevelReq = 10; // level needed to franchise
  ZC.CONFIG.prestigeBonus = 0.12;  // permanent earnings per prestige

  ZC.CUSTOMER_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#1abc9c', '#e67e22', '#9b59b6', '#2980b9', '#16a085'];

  // Customer archetypes: each orders a specific dish and has its own patience/pay.
  ZC.CUSTOMER_TYPES = {
    normal: { patience: 1.0,  pay: 1.0,  scale: 1.0 },
    kid:    { patience: 1.35, pay: 0.8,  scale: 0.82 },
    biker:  { patience: 0.7,  pay: 1.35, scale: 1.12 },
    vip:    { patience: 1.0,  pay: 2.0,  scale: 1.0, vip: true }
  };
  // Weighted pick of a customer type (vip weight scales with appeal).
  ZC.pickCustomerType = function (appeal) {
    var weights = { normal: 60, kid: 18, biker: 12, vip: Math.min(22, 6 + appeal * 0.4) };
    var total = 0, k; for (k in weights) total += weights[k];
    var r = Math.random() * total;
    for (k in weights) { if (r < weights[k]) return k; r -= weights[k]; }
    return 'normal';
  };

  ZC.ZOMBIE_NAMES = ['Mortimer', 'Greta', 'Vlad', 'Lurch', 'Patches', 'Gus', 'Morticia', 'Igor',
    'Shamble', 'Rotty', 'Cleaver', 'Dredge', 'Maul', 'Bones', 'Hazel', 'Stitch', 'Gnash', 'Drool', 'Crumble', 'Festus'];

})(window.ZC || (window.ZC = {}));
