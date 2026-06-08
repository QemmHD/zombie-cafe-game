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
    startCoins: 600,
    startToxin: 25,
    startFlesh: 6,

    // Zombie cap
    baseMaxZombies: 4,

    // Spawning
    spawnIntervalBase: 4.6,
    spawnIntervalMin: 1.3,
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
    energyRegenRest: 8,
    fleshFeedAmount: 60,

    // Economy
    infectCost: 8,
    fleshPerToxin: 3,
    raidDuration: 24,
    raidCooldown: 32,

    autosaveInterval: 12
  };

  ZC.CONFIG.maxZombies = function (level, tables) {
    return ZC.CONFIG.baseMaxZombies + Math.floor(tables / 2) + Math.floor(level / 2);
  };

  // Dishes. Higher tiers cost more & cook slower but pay far more.
  ZC.RECIPES = [
    { id: 'coffee', name: 'Bone Brew Coffee', cost: 15,  cookTime: 6,  servings: 3, price: 18,  unlockLevel: 1, color: '#6f4e37', icon: '☕' },
    { id: 'fries',  name: 'Finger Fries',     cost: 40,  cookTime: 10, servings: 4, price: 26,  unlockLevel: 1, color: '#e0a93b', icon: '🍟' },
    { id: 'burger', name: 'Brain Burger',     cost: 95,  cookTime: 16, servings: 4, price: 58,  unlockLevel: 2, color: '#b5651d', icon: '🍔' },
    { id: 'soup',   name: 'Eyeball Soup',     cost: 150, cookTime: 21, servings: 5, price: 82,  unlockLevel: 3, color: '#7bbf5a', icon: '🍲' },
    { id: 'pizza',  name: 'Zombie Pizza',     cost: 280, cookTime: 28, servings: 6, price: 132, unlockLevel: 4, color: '#d23b2e', icon: '🍕' },
    { id: 'cake',   name: 'Graveyard Cake',   cost: 520, cookTime: 36, servings: 6, price: 240, unlockLevel: 6, color: '#9b59b6', icon: '🍰' }
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

  ZC.CUSTOMER_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#1abc9c', '#e67e22', '#9b59b6', '#2980b9', '#16a085'];

})(window.ZC || (window.ZC = {}));
