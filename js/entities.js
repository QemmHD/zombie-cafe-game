/*
 * entities.js — Game objects in isometric tile-space (wx, wy = tile floats).
 */
(function (ZC) {
  'use strict';
  var CONFIG = ZC.CONFIG, util = ZC.util;

  function Table(col, row) {
    this.kind = 'table';
    this.col = col; this.row = row;
    this.wx = col + 0.5; this.wy = row + 0.5;
    this.id = util.id();
    this.customer = null;
  }
  Table.prototype.seat = function () { return { wx: this.wx, wy: this.wy + 0.45 }; };
  Table.prototype.isFree = function () { return this.customer === null; };
  ZC.Table = Table;

  function Stove(col, row, applianceType) {
    this.kind = 'stove';
    this.applianceType = applianceType || 'stove';
    this.col = col; this.row = row;
    this.wx = col + 0.5; this.wy = row + 0.5;
    this.id = util.id();
    var meta = ZC.APPLIANCES[this.applianceType] || ZC.APPLIANCES.stove;
    this.recipeId = ZC.defaultRecipeFor(meta.station);
    this.cooking = false;
    this.timer = 0;
    this.auto = true;
    this.tendedBy = null;
  }
  Stove.prototype.recipe = function () { return ZC.recipeById(this.recipeId); };
  Stove.prototype.station = function () { return (ZC.APPLIANCES[this.applianceType] || ZC.APPLIANCES.stove).station; };
  ZC.Stove = Stove;

  function Decor(col, row, itemId) {
    this.kind = 'decor';
    this.itemId = itemId;
    this.col = col; this.row = row;
    this.wx = col + 0.5; this.wy = row + 0.5;
    this.id = util.id();
    var item = ZC.shopById(itemId);
    this.appeal = item ? item.appeal : 0;
  }
  ZC.Decor = Decor;

  // states: idle, toPickup, toServe, returning, resting, raiding
  function Zombie(wx, wy) {
    this.kind = 'zombie';
    this.id = util.id();
    this.wx = wx; this.wy = wy;
    this.homeX = wx; this.homeY = wy;
    this.facing = 1;
    this.phase = Math.random() * 6;
    this.energy = CONFIG.zombieMaxEnergy;
    this.state = 'idle';
    this.task = null;
    this.carrying = null;
  }
  Zombie.prototype.isAvailable = function () { return this.state === 'idle' && this.energy > 5; };
  ZC.Zombie = Zombie;

  // states: entering, waiting, eating, leaving
  function Customer(wx, wy) {
    this.kind = 'customer';
    this.id = util.id();
    this.wx = wx; this.wy = wy;
    this.facing = -1;
    this.phase = Math.random() * 6;
    this.color = util.pick(ZC.CUSTOMER_COLORS);
    this.hair = util.pick(['#4a3728', '#2c1810', '#1a1a1a', '#8d6e63', '#d4a017']);
    this.state = 'entering';
    this.table = null;
    this.patience = CONFIG.customerPatience;
    this.eatTimer = 0;
    this.served = false;
    this.assignedZombie = null;
  }
  ZC.Customer = Customer;

})(window.ZC || (window.ZC = {}));
