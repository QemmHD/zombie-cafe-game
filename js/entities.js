/*
 * entities.js — Game objects: Table, Stove, Decor, Zombie, Customer.
 */
(function (ZC) {
  'use strict';
  var CONFIG = ZC.CONFIG, util = ZC.util;

  /* -------------------------------- Furniture ------------------------------ */
  function Table(col, row) {
    this.kind = 'table';
    this.col = col; this.row = row;
    this.x = col * CONFIG.tile + CONFIG.tile / 2;
    this.y = row * CONFIG.tile + CONFIG.tile / 2;
    this.id = util.id();
    this.customer = null;        // seated customer
  }
  Table.prototype.seatPos = function () { return { x: this.x, y: this.y + 16 }; };
  Table.prototype.isFree = function () { return this.customer === null; };
  ZC.Table = Table;

  function Stove(col, row) {
    this.kind = 'stove';
    this.col = col; this.row = row;
    this.x = col * CONFIG.tile + CONFIG.tile / 2;
    this.y = row * CONFIG.tile + CONFIG.tile / 2;
    this.id = util.id();
    this.recipeId = 'coffee';    // active recipe (auto-cooked)
    this.cooking = false;
    this.timer = 0;
    this.auto = true;
  }
  Stove.prototype.recipe = function () { return ZC.recipeById(this.recipeId); };
  ZC.Stove = Stove;

  function Decor(col, row, itemId) {
    this.kind = 'decor';
    this.itemId = itemId;
    this.col = col; this.row = row;
    this.x = col * CONFIG.tile + CONFIG.tile / 2;
    this.y = row * CONFIG.tile + CONFIG.tile / 2;
    this.id = util.id();
    var item = ZC.shopById(itemId);
    this.appeal = item ? item.appeal : 0;
  }
  ZC.Decor = Decor;

  /* --------------------------------- Zombie -------------------------------- */
  // states: idle, toPickup, toServe, returning, resting
  function Zombie(x, y) {
    this.kind = 'zombie';
    this.id = util.id();
    this.x = x; this.y = y;
    this.facing = 1;
    this.phase = Math.random() * 6;
    this.energy = CONFIG.zombieMaxEnergy;
    this.state = 'idle';
    this.task = null;            // { table, portion }
    this.carrying = null;        // portion being carried
    this.homeX = x; this.homeY = y;
  }
  Zombie.prototype.isAvailable = function () {
    return this.state === 'idle' && this.energy > 5;
  };
  ZC.Zombie = Zombie;

  /* -------------------------------- Customer ------------------------------- */
  // states: entering, waiting, eating, leaving, infecting
  function Customer(spawnX, spawnY) {
    this.kind = 'customer';
    this.id = util.id();
    this.x = spawnX; this.y = spawnY;
    this.facing = 1;
    this.phase = Math.random() * 6;
    this.color = util.pick(ZC.CUSTOMER_COLORS);
    this.hair = util.pick(['#4a3728', '#2c1810', '#1a1a1a', '#8d6e63', '#d4a017']);
    this.state = 'entering';
    this.table = null;
    this.patience = CONFIG.customerPatience;
    this.eatTimer = 0;
    this.served = false;
    this.assignedZombie = null;  // zombie en route with food
  }
  ZC.Customer = Customer;

})(window.ZC || (window.ZC = {}));
