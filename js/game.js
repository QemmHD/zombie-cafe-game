/*
 * game.js — Core controller: world state, update loop, rendering, economy,
 * spawning, dispatch logic, and save/load.
 */
(function (ZC) {
  'use strict';
  var CONFIG = ZC.CONFIG, util = ZC.util, S = ZC.sprites;

  var Game = ZC.Game = {
    canvas: null,
    ctx: null,

    // resources
    coins: 0, toxin: 0, flesh: 0,
    xp: 0, level: 1,

    // entities
    tables: [], stoves: [], decor: [],
    zombies: [], customers: [],
    readyFood: [],          // [{recipeId, price}]
    floaters: [],           // floating text

    // timers
    spawnTimer: 0,
    autosaveTimer: 0,
    raid: { active: false, timer: 0, cooldown: 0, count: 0 },

    // input/build mode
    mode: 'none',           // 'none' | 'build:<shopId>' | 'infect'
    paused: false,

    stats: { served: 0, infected: 0, raids: 0 },

    init: function (canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      canvas.width = CONFIG.cols * CONFIG.tile;
      canvas.height = CONFIG.rows * CONFIG.tile;
      this.entranceX = (CONFIG.cols / 2) * CONFIG.tile;
      this.entranceY = (CONFIG.rows - 0.4) * CONFIG.tile;
      this.kitchenX = (CONFIG.cols / 2) * CONFIG.tile;
      this.kitchenY = 1.4 * CONFIG.tile;

      if (!this.load()) this.newGame();
      this.bindCanvas();
    },

    newGame: function () {
      this.coins = CONFIG.startCoins;
      this.toxin = CONFIG.startToxin;
      this.flesh = CONFIG.startFlesh;
      this.xp = 0; this.level = 1;
      this.tables = []; this.stoves = []; this.decor = [];
      this.zombies = []; this.customers = []; this.readyFood = [];
      this.stats = { served: 0, infected: 0, raids: 0 };

      // Starter layout: 2 tables, 1 stove, 2 zombies
      this.tables.push(new ZC.Table(6, 5));
      this.tables.push(new ZC.Table(9, 5));
      this.tables.push(new ZC.Table(6, 7));
      var st = new ZC.Stove(7, 1); st.recipeId = 'coffee';
      this.stoves.push(st);
      this.spawnZombie(this.kitchenX - 30, this.kitchenY + 40);
      this.spawnZombie(this.kitchenX + 30, this.kitchenY + 40);
    },

    /* ------------------------------ Economy ------------------------------- */
    addCoins: function (n) { this.coins += n; if (ZC.ui) ZC.ui.updateHUD(); },
    addToxin: function (n) { this.toxin += n; if (ZC.ui) ZC.ui.updateHUD(); },
    addFlesh: function (n) { this.flesh += n; if (ZC.ui) ZC.ui.updateHUD(); },

    addXP: function (n) {
      this.xp += n;
      var need = ZC.xpForLevel(this.level);
      while (this.xp >= need) {
        this.xp -= need;
        this.level++;
        this.toxin += 5;                       // level reward
        this.floater(this.entranceX, this.entranceY - 60, 'LEVEL ' + this.level + '!', '#f1c40f');
        if (ZC.ui) ZC.ui.toast('Level up! Reached level ' + this.level + ' (+5 toxin)');
        need = ZC.xpForLevel(this.level);
      }
      if (ZC.ui) ZC.ui.updateHUD();
    },

    appeal: function () {
      var a = 0;
      for (var i = 0; i < this.decor.length; i++) a += this.decor[i].appeal;
      return a;
    },

    floater: function (x, y, text, color) {
      this.floaters.push({ x: x, y: y, text: text, color: color || '#fff', life: 1.4, max: 1.4 });
    },

    spawnZombie: function (x, y) {
      var z = new ZC.Zombie(x, y);
      this.zombies.push(z);
      return z;
    },

    /* ------------------------------ Building ------------------------------ */
    tileOccupied: function (col, row) {
      var all = this.tables.concat(this.stoves, this.decor);
      for (var i = 0; i < all.length; i++)
        if (all[i].col === col && all[i].row === row) return true;
      return false;
    },

    canPlace: function (col, row) {
      if (col < 0 || row < 0 || col >= CONFIG.cols || row >= CONFIG.rows) return false;
      if (row < 1 || row > CONFIG.rows - 2) return false;   // keep kitchen wall & entrance clear
      if (this.tileOccupied(col, row)) return false;
      return true;
    },

    placeItem: function (shopId, col, row) {
      var item = ZC.shopById(shopId);
      if (!item || this.coins < item.cost || !this.canPlace(col, row)) return false;
      this.coins -= item.cost;
      if (item.type === 'table') this.tables.push(new ZC.Table(col, row));
      else if (item.type === 'stove') this.stoves.push(new ZC.Stove(col, row));
      else this.decor.push(new ZC.Decor(col, row, shopId));
      this.floater(col * CONFIG.tile + 24, row * CONFIG.tile, '-' + item.cost, '#e74c3c');
      if (ZC.ui) ZC.ui.updateHUD();
      return true;
    },

    /* ------------------------------ Update -------------------------------- */
    update: function (dt) {
      if (this.paused) return;
      this.updateSpawning(dt);
      this.updateStoves(dt);
      this.updateCustomers(dt);
      this.dispatchZombies();
      this.updateZombies(dt);
      this.updateRaid(dt);
      this.updateFloaters(dt);

      this.autosaveTimer += dt;
      if (this.autosaveTimer >= CONFIG.autosaveInterval) { this.autosaveTimer = 0; this.save(); }
    },

    updateSpawning: function (dt) {
      if (this.tables.length === 0) return;
      if (this.customers.length >= CONFIG.maxCustomers) return;
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        var interval = CONFIG.spawnIntervalBase - this.appeal() * 0.05;
        interval = util.clamp(interval, CONFIG.spawnIntervalMin, CONFIG.spawnIntervalBase);
        this.spawnTimer = interval * util.rand(0.7, 1.3);
        // only spawn if there's a free table
        if (this.freeTable()) this.spawnCustomer();
      }
    },

    freeTable: function () {
      for (var i = 0; i < this.tables.length; i++) if (this.tables[i].isFree()) return this.tables[i];
      return null;
    },

    spawnCustomer: function () {
      var c = new ZC.Customer(this.entranceX, this.entranceY);
      var t = this.freeTable();
      if (!t) return;
      t.customer = c;          // reserve immediately
      c.table = t;
      this.customers.push(c);
    },

    updateStoves: function (dt) {
      for (var i = 0; i < this.stoves.length; i++) {
        var st = this.stoves[i];
        var rec = st.recipe();
        if (!rec) continue;
        if (st.cooking) {
          st.timer -= dt;
          if (st.timer <= 0) {
            st.cooking = false;
            for (var s = 0; s < rec.servings; s++) this.readyFood.push({ recipeId: rec.id, price: rec.price });
            this.floater(st.x, st.y - 30, '+' + rec.servings + ' ' + rec.icon, '#2ecc71');
          }
        } else if (st.auto) {
          // start cooking if affordable, recipe unlocked, and stock is low
          if (rec.unlockLevel <= this.level && this.coins >= rec.cost && this.readyFood.length < this.tables.length + 2) {
            this.coins -= rec.cost;
            st.cooking = true;
            st.timer = rec.cookTime;
            if (ZC.ui) ZC.ui.updateHUD();
          }
        }
      }
    },

    updateCustomers: function (dt) {
      for (var i = this.customers.length - 1; i >= 0; i--) {
        var c = this.customers[i];
        c.phase += dt * 8;
        if (c.state === 'entering') {
          var seat = c.table.seatPos();
          if (ZC.moveToward(c, seat.x, seat.y, CONFIG.customerSpeed, dt)) c.state = 'waiting';
        } else if (c.state === 'waiting') {
          c.patience -= dt;
          if (c.patience <= 0) {
            // leave angry
            this.releaseCustomer(c, false);
          }
        } else if (c.state === 'eating') {
          c.eatTimer -= dt;
          if (c.eatTimer <= 0) {
            this.releaseCustomer(c, true);
          }
        } else if (c.state === 'leaving') {
          if (ZC.moveToward(c, this.entranceX, this.entranceY + 30, CONFIG.customerSpeed, dt)) {
            this.customers.splice(i, 1);
          }
        }
      }
    },

    // pay=true => they ate & paid. Frees table, sets to leaving.
    releaseCustomer: function (c, payed) {
      if (c.table) { c.table.customer = null; c.table = null; }
      // free assigned zombie's task if any
      if (c.assignedZombie) {
        var z = c.assignedZombie;
        if (z.carrying) { this.readyFood.push(z.carrying); z.carrying = null; }
        z.task = null; z.state = 'returning';
        c.assignedZombie = null;
      }
      c.state = 'leaving';
      if (!payed) {
        this.floater(c.x, c.y - 30, '😠', '#e74c3c');
      }
    },

    /* ----------------------- Zombie dispatch & update --------------------- */
    dispatchZombies: function () {
      if (this.readyFood.length === 0) return;
      for (var i = 0; i < this.zombies.length; i++) {
        var z = this.zombies[i];
        if (!z.isAvailable()) continue;
        // find a waiting, unassigned customer that is seated
        var target = null;
        for (var j = 0; j < this.customers.length; j++) {
          var c = this.customers[j];
          if (c.state === 'waiting' && !c.served && !c.assignedZombie) { target = c; break; }
        }
        if (!target) break;
        if (this.readyFood.length === 0) break;
        var portion = this.readyFood.shift();
        target.assignedZombie = z;
        z.task = { customer: target, portion: portion };
        z.state = 'toPickup';
      }
    },

    updateZombies: function (dt) {
      for (var i = 0; i < this.zombies.length; i++) {
        var z = this.zombies[i];
        z.phase += dt * 9;

        if (z.state === 'resting') {
          z.energy += CONFIG.energyRegenRest * dt;
          if (z.energy >= CONFIG.zombieMaxEnergy * 0.5) {
            z.energy = util.clamp(z.energy, 0, CONFIG.zombieMaxEnergy);
            z.state = 'idle';
          }
          continue;
        }

        // idle energy drain
        z.energy -= CONFIG.energyDrainIdle * dt;
        if (z.energy <= 0) { z.energy = 0; this.abortTask(z); z.state = 'resting'; continue; }

        if (z.state === 'idle') {
          // drift toward home/kitchen
          ZC.moveToward(z, z.homeX, z.homeY, CONFIG.zombieSpeed * 0.5, dt);
        } else if (z.state === 'toPickup') {
          var task = z.task;
          if (!task || !this.customerValid(task.customer)) { this.abortTask(z); continue; }
          if (ZC.moveToward(z, this.kitchenX, this.kitchenY + 24, CONFIG.zombieSpeed, dt)) {
            z.carrying = task.portion;
            z.state = 'toServe';
          }
        } else if (z.state === 'toServe') {
          var t = z.task;
          if (!t || !this.customerValid(t.customer)) { this.abortTask(z); continue; }
          var c = t.customer;
          var sp = c.table.seatPos();
          if (ZC.moveToward(z, sp.x - 22, sp.y, CONFIG.zombieSpeed, dt)) {
            // serve!
            this.serveCustomer(z, c);
          }
        } else if (z.state === 'returning') {
          if (ZC.moveToward(z, z.homeX, z.homeY, CONFIG.zombieSpeed, dt)) z.state = 'idle';
        }
      }
    },

    customerValid: function (c) {
      return c && c.state === 'waiting' && this.customers.indexOf(c) !== -1;
    },

    abortTask: function (z) {
      if (z.carrying) { this.readyFood.push(z.carrying); z.carrying = null; }
      if (z.task && z.task.customer && z.task.customer.assignedZombie === z) {
        z.task.customer.assignedZombie = null;
      }
      z.task = null;
      if (z.state !== 'resting') z.state = 'returning';
    },

    serveCustomer: function (z, c) {
      var portion = z.carrying || (z.task && z.task.portion);
      var pay = portion ? portion.price : 10;
      z.carrying = null;
      z.task = null;
      z.energy -= CONFIG.serveEnergyCost;
      z.state = 'returning';

      c.served = true;
      c.assignedZombie = null;
      c.state = 'eating';
      c.eatTimer = CONFIG.eatTime;

      this.addCoins(pay);
      this.addXP(Math.max(3, Math.round(pay / 4)));
      this.stats.served++;
      this.floater(c.x, c.y - 34, '+' + pay, '#f1c40f');
    },

    /* ------------------------------ Infect -------------------------------- */
    infectCustomer: function (c) {
      if (this.toxin < CONFIG.infectCost) {
        if (ZC.ui) ZC.ui.toast('Not enough toxin to infect (need ' + CONFIG.infectCost + ')');
        return false;
      }
      if (c.state !== 'waiting' && c.state !== 'eating') return false;
      this.toxin -= CONFIG.infectCost;
      // remove customer, free table, spawn zombie at their spot
      if (c.table) { c.table.customer = null; }
      if (c.assignedZombie) this.abortTask(c.assignedZombie);
      var idx = this.customers.indexOf(c);
      if (idx !== -1) this.customers.splice(idx, 1);
      var z = this.spawnZombie(c.x, c.y);
      z.energy = CONFIG.zombieMaxEnergy;
      z.state = 'returning';
      this.stats.infected++;
      this.floater(c.x, c.y - 34, 'INFECTED!', '#9b59b6');
      if (ZC.ui) { ZC.ui.updateHUD(); ZC.ui.toast('Customer infected — you have a new zombie!'); }
      return true;
    },

    /* ------------------------- Flesh / feeding ---------------------------- */
    feedZombie: function (z) {
      if (this.flesh < 1) { if (ZC.ui) ZC.ui.toast('No flesh! Raid the city or buy some.'); return false; }
      this.flesh--;
      z.energy = util.clamp(z.energy + CONFIG.fleshFeedAmount, 0, CONFIG.zombieMaxEnergy);
      if (z.state === 'resting' && z.energy > CONFIG.zombieMaxEnergy * 0.3) z.state = 'idle';
      this.floater(z.x, z.y - 34, '+energy', '#2ecc71');
      if (ZC.ui) ZC.ui.updateHUD();
      return true;
    },

    buyFlesh: function () {
      if (this.toxin < 1) { if (ZC.ui) ZC.ui.toast('Not enough toxin.'); return false; }
      this.toxin--;
      this.flesh += CONFIG.fleshPerToxin;
      if (ZC.ui) { ZC.ui.updateHUD(); ZC.ui.toast('Bought ' + CONFIG.fleshPerToxin + ' flesh.'); }
      return true;
    },

    /* ------------------------------ Raids --------------------------------- */
    startRaid: function () {
      if (this.raid.active) { if (ZC.ui) ZC.ui.toast('A raid is already underway.'); return false; }
      if (this.raid.cooldown > 0) { if (ZC.ui) ZC.ui.toast('Raid on cooldown (' + Math.ceil(this.raid.cooldown) + 's).'); return false; }
      var available = [];
      for (var i = 0; i < this.zombies.length; i++) if (this.zombies[i].isAvailable()) available.push(this.zombies[i]);
      if (available.length === 0) { if (ZC.ui) ZC.ui.toast('No rested zombies free to raid!'); return false; }
      var count = Math.min(3, available.length);
      for (var k = 0; k < count; k++) { available[k].state = 'raiding'; available[k].energy -= 20; }
      this.raid.active = true;
      this.raid.timer = CONFIG.raidDuration;
      this.raid.count = count;
      if (ZC.ui) ZC.ui.toast('Sent ' + count + ' zombies to scavenge the city...');
      return true;
    },

    updateRaid: function (dt) {
      if (this.raid.cooldown > 0) this.raid.cooldown -= dt;
      if (!this.raid.active) return;
      this.raid.timer -= dt;
      if (this.raid.timer <= 0) {
        var count = this.raid.count;
        var coins = Math.round(util.rand(40, 90) * count);
        var flesh = Math.round(util.rand(2, 4) * count);
        var toxin = Math.round(util.rand(1, 3) * count);
        this.addCoins(coins); this.addFlesh(flesh); this.addToxin(toxin);
        // bring zombies back
        for (var i = 0; i < this.zombies.length; i++) {
          if (this.zombies[i].state === 'raiding') {
            this.zombies[i].state = 'returning';
            this.zombies[i].x = this.kitchenX; this.zombies[i].y = this.kitchenY + 30;
          }
        }
        this.raid.active = false;
        this.raid.cooldown = CONFIG.raidCooldown;
        this.raid.count = 0;
        this.stats.raids++;
        if (ZC.ui) ZC.ui.toast('Raid returned! +' + coins + ' coins, +' + flesh + ' flesh, +' + toxin + ' toxin');
      }
    },

    updateFloaters: function (dt) {
      for (var i = this.floaters.length - 1; i >= 0; i--) {
        var f = this.floaters[i];
        f.life -= dt;
        f.y -= 22 * dt;
        if (f.life <= 0) this.floaters.splice(i, 1);
      }
    },

    /* ------------------------------ Render -------------------------------- */
    render: function () {
      var ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
      // floor
      this.drawFloor(ctx, W, H);

      // build-mode tile highlight
      if (this.mode.indexOf('build:') === 0 && this.hoverTile) {
        var t = CONFIG.tile, ht = this.hoverTile;
        ctx.fillStyle = this.canPlace(ht.col, ht.row) ? 'rgba(46,204,113,0.35)' : 'rgba(231,76,60,0.35)';
        ctx.fillRect(ht.col * t, ht.row * t, t, t);
      }

      // sort drawables by y for depth
      var drawables = [];
      var i;
      for (i = 0; i < this.decor.length; i++) drawables.push(this.decor[i]);
      for (i = 0; i < this.tables.length; i++) drawables.push(this.tables[i]);
      for (i = 0; i < this.stoves.length; i++) drawables.push(this.stoves[i]);
      for (i = 0; i < this.customers.length; i++) drawables.push(this.customers[i]);
      for (i = 0; i < this.zombies.length; i++) if (this.zombies[i].state !== 'raiding') drawables.push(this.zombies[i]);
      drawables.sort(function (a, b) { return a.y - b.y; });

      for (i = 0; i < drawables.length; i++) this.drawEntity(ctx, drawables[i]);

      // floaters
      for (i = 0; i < this.floaters.length; i++) {
        var f = this.floaters[i];
        S.floater(ctx, f.x, f.y, f.text, f.color, util.clamp(f.life / f.max, 0, 1));
      }

      // raid banner
      if (this.raid.active) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(W / 2 - 130, 8, 260, 28);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('🧟 Raiding the city... ' + Math.ceil(this.raid.timer) + 's', W / 2, 26);
      }
    },

    drawFloor: function (ctx, W, H) {
      var t = CONFIG.tile;
      for (var r = 0; r < CONFIG.rows; r++) {
        for (var c = 0; c < CONFIG.cols; c++) {
          var kitchen = r < 1;
          ctx.fillStyle = kitchen ? '#3b3f4a' : ((r + c) % 2 === 0 ? '#46505e' : '#414a57');
          ctx.fillRect(c * t, r * t, t, t);
        }
      }
      // kitchen counter line
      ctx.fillStyle = '#2c2f38';
      ctx.fillRect(0, t - 6, W, 6);
      // entrance mat
      ctx.fillStyle = '#7b241c';
      ctx.fillRect(this.entranceX - t / 2, H - t * 0.7, t, t * 0.7);
      ctx.fillStyle = '#fff'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('ENTRANCE', this.entranceX, H - 6);
      ctx.fillStyle = '#bdc3c7'; ctx.textAlign = 'left';
      ctx.fillText('🍳 KITCHEN', 6, 16);
    },

    drawEntity: function (ctx, e) {
      if (e.kind === 'table') {
        S.table(ctx, e.x, e.y, !e.isFree());
      } else if (e.kind === 'stove') {
        var rec = e.recipe();
        S.stove(ctx, e.x, e.y, { cooking: e.cooking, progress: e.cooking ? 1 - e.timer / rec.cookTime : 0, icon: rec ? rec.icon : '' });
      } else if (e.kind === 'decor') {
        S.decor(ctx, e.x, e.y, e.itemId);
      } else if (e.kind === 'customer') {
        S.customer(ctx, e.x, e.y, { color: e.color, hair: e.hair, phase: e.state === 'entering' || e.state === 'leaving' ? e.phase : 0 });
        if (e.state === 'waiting') {
          S.bubble(ctx, e.x, e.y, util.clamp(e.patience / CONFIG.customerPatience, 0, 1), '🍴');
        } else if (e.state === 'eating') {
          S.bubble(ctx, e.x, e.y, 1, '😋');
        }
      } else if (e.kind === 'zombie') {
        var moving = e.state === 'toPickup' || e.state === 'toServe' || e.state === 'returning';
        var carryRec = e.carrying ? ZC.recipeById(e.carrying.recipeId) : null;
        S.zombie(ctx, e.x, e.y, {
          phase: moving ? e.phase : 0,
          facing: e.facing,
          carrying: !!e.carrying,
          carryColor: carryRec ? carryRec.color : null,
          resting: e.state === 'resting',
          showEnergy: true,
          energy: e.energy
        });
        if (e.state === 'resting') {
          ctx.font = '12px serif'; ctx.textAlign = 'center';
          ctx.fillText('💤', e.x + 14, e.y - 26);
        }
      }
    },

    /* ----------------------------- Picking -------------------------------- */
    bindCanvas: function () {
      var self = this;
      var canvas = this.canvas;

      function toCanvas(ev) {
        var rect = canvas.getBoundingClientRect();
        var sx = canvas.width / rect.width, sy = canvas.height / rect.height;
        var px = ev.clientX !== undefined ? ev.clientX : (ev.touches && ev.touches[0].clientX);
        var py = ev.clientY !== undefined ? ev.clientY : (ev.touches && ev.touches[0].clientY);
        return { x: (px - rect.left) * sx, y: (py - rect.top) * sy };
      }

      canvas.addEventListener('mousemove', function (ev) {
        var p = toCanvas(ev);
        self.hoverTile = { col: Math.floor(p.x / CONFIG.tile), row: Math.floor(p.y / CONFIG.tile) };
      });

      canvas.addEventListener('click', function (ev) {
        var p = toCanvas(ev);
        self.handleClick(p.x, p.y);
      });

      // touch
      canvas.addEventListener('touchstart', function (ev) {
        ev.preventDefault();
        var p = toCanvas(ev);
        self.hoverTile = { col: Math.floor(p.x / CONFIG.tile), row: Math.floor(p.y / CONFIG.tile) };
        self.handleClick(p.x, p.y);
      }, { passive: false });
    },

    handleClick: function (x, y) {
      var col = Math.floor(x / CONFIG.tile), row = Math.floor(y / CONFIG.tile);

      // Build mode
      if (this.mode.indexOf('build:') === 0) {
        var shopId = this.mode.split(':')[1];
        this.placeItem(shopId, col, row);
        return;
      }

      // Infect mode: click a seated customer
      if (this.mode === 'infect') {
        var c = this.pickCustomer(x, y);
        if (c) this.infectCustomer(c);
        return;
      }

      // Default: click stove -> open recipe menu; click resting zombie -> feed
      var st = this.pickStove(x, y);
      if (st) { if (ZC.ui) ZC.ui.openStoveMenu(st); return; }

      var z = this.pickZombie(x, y);
      if (z) {
        if (z.state === 'resting' || z.energy < CONFIG.zombieMaxEnergy) this.feedZombie(z);
        return;
      }
    },

    pickStove: function (x, y) {
      for (var i = 0; i < this.stoves.length; i++) {
        var s = this.stoves[i];
        if (Math.abs(x - s.x) < 22 && Math.abs(y - s.y) < 22) return s;
      }
      return null;
    },
    pickZombie: function (x, y) {
      var best = null, bd = 26;
      for (var i = 0; i < this.zombies.length; i++) {
        var z = this.zombies[i];
        if (z.state === 'raiding') continue;
        var d = util.dist(x, y, z.x, z.y - 8);
        if (d < bd) { bd = d; best = z; }
      }
      return best;
    },
    pickCustomer: function (x, y) {
      var best = null, bd = 26;
      for (var i = 0; i < this.customers.length; i++) {
        var c = this.customers[i];
        var d = util.dist(x, y, c.x, c.y - 8);
        if (d < bd) { bd = d; best = c; }
      }
      return best;
    },

    /* ------------------------------ Save ---------------------------------- */
    save: function () {
      try {
        var data = {
          v: 1,
          coins: this.coins, toxin: this.toxin, flesh: this.flesh, xp: this.xp, level: this.level,
          stats: this.stats,
          tables: this.tables.map(function (t) { return { c: t.col, r: t.row }; }),
          stoves: this.stoves.map(function (s) { return { c: s.col, r: s.row, recipe: s.recipeId, auto: s.auto }; }),
          decor: this.decor.map(function (d) { return { c: d.col, r: d.row, item: d.itemId }; }),
          zombieCount: this.zombies.length
        };
        localStorage.setItem('zombieCafeSave', JSON.stringify(data));
        return true;
      } catch (e) { return false; }
    },

    load: function () {
      try {
        var raw = localStorage.getItem('zombieCafeSave');
        if (!raw) return false;
        var d = JSON.parse(raw);
        this.coins = d.coins; this.toxin = d.toxin; this.flesh = d.flesh;
        this.xp = d.xp; this.level = d.level;
        this.stats = d.stats || { served: 0, infected: 0, raids: 0 };
        this.tables = (d.tables || []).map(function (t) { return new ZC.Table(t.c, t.r); });
        this.stoves = (d.stoves || []).map(function (s) {
          var st = new ZC.Stove(s.c, s.r); st.recipeId = s.recipe || 'coffee'; st.auto = s.auto !== false; return st;
        });
        this.decor = (d.decor || []).map(function (x) { return new ZC.Decor(x.c, x.r, x.item); });
        this.zombies = [];
        var n = d.zombieCount || 2;
        for (var i = 0; i < n; i++) this.spawnZombie(this.kitchenX + (i - n / 2) * 26, this.kitchenY + 36);
        this.customers = []; this.readyFood = [];
        return true;
      } catch (e) { return false; }
    },

    reset: function () {
      localStorage.removeItem('zombieCafeSave');
      this.newGame();
      if (ZC.ui) ZC.ui.updateHUD();
    }
  };

})(window.ZC || (window.ZC = {}));
