/*
 * data.js — Static game data & tuning constants.
 * A fan recreation of the classic "Zombie Cafe" management loop, built from
 * scratch with original art and data (no proprietary assets).
 */
(function (ZC) {
  'use strict';

  ZC.CONFIG = {
    tile: 48,
    cols: 16,
    rows: 11,

    // Starting resources
    startCoins: 600,
    startToxin: 25,
    startFlesh: 6,

    // Spawning
    spawnIntervalBase: 4.8,   // seconds between customers at appeal 0
    spawnIntervalMin: 1.4,    // fastest spawn no matter the appeal
    maxCustomers: 24,

    // Customer behaviour
    customerPatience: 32,     // seconds a customer waits for food
    eatTime: 4.5,             // seconds spent eating
    customerSpeed: 70,        // px / second

    // Zombie behaviour
    zombieSpeed: 95,          // px / second
    zombieMaxEnergy: 100,
    serveEnergyCost: 11,      // energy spent per completed serve
    energyDrainIdle: 0.4,     // slow drain so flesh matters
    energyRegenRest: 9,       // energy / second while resting
    fleshFeedAmount: 60,      // energy restored per flesh fed

    // Economy
    infectCost: 8,            // toxin to infect a seated customer
    fleshPerToxin: 3,         // buy flesh: 1 toxin -> N flesh
    raidDuration: 25,         // seconds
    raidCooldown: 35,         // seconds

    // Misc
    autosaveInterval: 12      // seconds
  };

  // Dishes the cafe can cook. Higher tiers cost more & cook slower but pay far more.
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

  // Buildable items
  ZC.SHOP = [
    { id: 'table', name: 'Table',        cost: 120, type: 'table',  appeal: 0,  desc: 'Seats one customer.' },
    { id: 'stove', name: 'Stove',        cost: 320, type: 'stove',  appeal: 0,  desc: 'Cooks dishes. Auto-cooks its set recipe.' },
    { id: 'plant', name: 'Spooky Plant', cost: 80,  type: 'decor',  appeal: 6,  desc: 'Raises appeal (faster customers).' },
    { id: 'lamp',  name: 'Gore Lamp',    cost: 140, type: 'decor',  appeal: 11, desc: 'Raises appeal (faster customers).' },
    { id: 'rug',   name: 'Bloody Rug',   cost: 220, type: 'decor',  appeal: 18, desc: 'Raises appeal (faster customers).' }
  ];

  ZC.shopById = function (id) {
    for (var i = 0; i < ZC.SHOP.length; i++) if (ZC.SHOP[i].id === id) return ZC.SHOP[i];
    return null;
  };

  // XP required to reach the NEXT level from the given level.
  ZC.xpForLevel = function (level) {
    return Math.floor(120 * Math.pow(level, 1.45));
  };

  // Shirt colours for variety of human customers
  ZC.CUSTOMER_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#1abc9c', '#e67e22', '#9b59b6', '#34495e', '#16a085'];

})(window.ZC || (window.ZC = {}));
