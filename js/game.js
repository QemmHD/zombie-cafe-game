/*
 * game.js — Core controller: isometric world, update loop, economy,
 * spawning, zombie dispatch AI, rendering and save/load.
 */
(function (ZC) {
  'use strict';
  var CONFIG = ZC.CONFIG, util = ZC.util, S = ZC.sprites, iso = ZC.iso;

  var Game = ZC.Game = {
    coins: 0, toxin: 0, flesh: 0, xp: 0, level: 1,
    tables: [], stoves: [], decor: [], zombies: [], customers: [],
    readyFood: [], floaters: [],
    spawnTimer: 0, autosaveTimer: 0,
    raid: { active: false, timer: 0, cooldown: 0, count: 0 },
    mode: 'none', paused: false,
    stats: { served: 0, infected: 0, raids: 0 },

    init: function (canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      iso.setup();
      canvas.width = Math.round(iso.width);
      canvas.height = Math.round(iso.height);

      // key tile positions
      this.entrance = { wx: CONFIG.cols - 0.5, wy: CONFIG.rows - 0.2 };
      this.kitchen = { wx: 0.6, wy: 0.6 };   // counter pickup point (back corner)

      if (!this.load()) this.newGame();
      this.bindCanvas();
    },

    newGame: function () {
      this.coins = CONFIG.startCoins; this.toxin = CONFIG.startToxin; this.flesh = CONFIG.startFlesh;
      this.xp = 0; this.level = 1;
      this.tables = []; this.stoves = []; this.decor = [];
      this.zombies = []; this.customers = []; this.readyFood = [];
      this.stats = { served: 0, infected: 0, raids: 0 };

      this.tables.push(new ZC.Table(3, 3));
      this.tables.push(new ZC.Table(5, 3));
      this.tables.push(new ZC.Table(4, 5));
      var st = new ZC.Stove(1, 1); st.recipeId = 'coffee'; this.stoves.push(st);
      this.spawnZombie(this.kitchen.wx + 0.6, this.kitchen.wy + 0.8);
      this.spawnZombie(this.kitchen.wx + 1.4, this.kitchen.wy + 0.4);
    },

    addCoins: function (n) { this.coins += n; if (ZC.ui) ZC.ui.updateHUD(); },
    addToxin: function (n) { this.toxin += n; if (ZC.ui) ZC.ui.updateHUD(); },
    addFlesh: function (n) { this.flesh += n; if (ZC.ui) ZC.ui.updateHUD(); },

    addXP: function (n) {
      this.xp += n;
      var need = ZC.xpForLevel(this.level);
      while (this.xp >= need) {
        this.xp -= need; this.level++; this.toxin += 5;
        this.floater(this.entrance.wx, this.entrance.wy, 'LEVEL ' + this.level + '!', '#f1c40f');
        if (ZC.sfx) ZC.sfx.level();
        if (ZC.ui) ZC.ui.toast('Level up! Reached level ' + this.level + ' (+5 toxin)');
        need = ZC.xpForLevel(this.level);
      }
      if (ZC.ui) ZC.ui.updateHUD();
    },

    appeal: function () { var a = 0; for (var i = 0; i < this.decor.length; i++) a += this.decor[i].appeal; return a; },
    maxZombies: function () { return CONFIG.maxZombies(this.level, this.tables.length); },

    // floaters live in tile-space, projected at draw time
    floater: function (wx, wy, text, color) {
      this.floaters.push({ wx: wx, wy: wy, dy: 0, text: text, color: color || '#fff', life: 1.4, max: 1.4 });
    },

    spawnZombie: function (wx, wy) { var z = new ZC.Zombie(wx, wy); this.zombies.push(z); return z; },

    /* ------------------------------ Building ------------------------------ */
    tileOccupied: function (col, row) {
      var all = this.tables.concat(this.stoves, this.decor);
      for (var i = 0; i < all.length; i++) if (all[i].col === col && all[i].row === row) return true;
      return false;
    },
    canPlace: function (col, row) {
      if (col < 0 || row < 0 || col >= CONFIG.cols || row >= CONFIG.rows) return false;
      if (this.tileOccupied(col, row)) return false;
      return true;
    },
    placeItem: function (shopId, col, row) {
      var item = ZC.shopById(shopId);
      if (!item) return false;
      if (this.coins < item.cost) { if (ZC.ui) ZC.ui.toast('Not enough coins.'); if (ZC.sfx) ZC.sfx.error(); return false; }
      if (!this.canPlace(col, row)) { if (ZC.sfx) ZC.sfx.error(); return false; }
      this.coins -= item.cost;
      if (item.type === 'table') this.tables.push(new ZC.Table(col, row));
      else if (item.type === 'stove') this.stoves.push(new ZC.Stove(col, row));
      else this.decor.push(new ZC.Decor(col, row, shopId));
      this.floater(col + 0.5, row + 0.5, '-' + item.cost, '#e74c3c');
      if (ZC.sfx) ZC.sfx.build();
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

    freeTable: function () { for (var i = 0; i < this.tables.length; i++) if (this.tables[i].isFree()) return this.tables[i]; return null; },

    updateSpawning: function (dt) {
      if (this.tables.length === 0 || this.customers.length >= CONFIG.maxCustomers) return;
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        var interval = util.clamp(CONFIG.spawnIntervalBase - this.appeal() * 0.05, CONFIG.spawnIntervalMin, CONFIG.spawnIntervalBase);
        this.spawnTimer = interval * util.rand(0.7, 1.3);
        if (this.freeTable()) this.spawnCustomer();
      }
    },
    spawnCustomer: function () {
      var t = this.freeTable(); if (!t) return;
      var c = new ZC.Customer(this.entrance.wx, this.entrance.wy);
      t.customer = c; c.table = t; this.customers.push(c);
    },

    updateStoves: function (dt) {
      for (var i = 0; i < this.stoves.length; i++) {
        var st = this.stoves[i], rec = st.recipe();
        if (!rec) continue;
        if (st.cooking) {
          st.timer -= dt;
          if (st.timer <= 0) {
            st.cooking = false;
            for (var s = 0; s < rec.servings; s++) this.readyFood.push({ recipeId: rec.id, price: rec.price });
            this.floater(st.wx, st.wy, '+' + rec.servings + ' ' + rec.icon, '#2ecc71');
          }
        } else if (st.auto && rec.unlockLevel <= this.level && this.coins >= rec.cost && this.readyFood.length < this.tables.length + 2) {
          this.coins -= rec.cost; st.cooking = true; st.timer = rec.cookTime;
          if (ZC.ui) ZC.ui.updateHUD();
        }
      }
    },

    updateCustomers: function (dt) {
      for (var i = this.customers.length - 1; i >= 0; i--) {
        var c = this.customers[i];
        c.phase += dt * 8;
        if (c.state === 'entering') {
          var seat = c.table.seat();
          if (ZC.moveTo(c, seat.wx, seat.wy, CONFIG.customerSpeed, dt)) { c.state = 'waiting'; c.facing = -1; }
        } else if (c.state === 'waiting') {
          c.patience -= dt;
          if (c.patience <= 0) this.releaseCustomer(c, false);
        } else if (c.state === 'eating') {
          c.eatTimer -= dt;
          if (c.eatTimer <= 0) this.releaseCustomer(c, true);
        } else if (c.state === 'leaving') {
          if (ZC.moveTo(c, this.entrance.wx, this.entrance.wy, CONFIG.customerSpeed, dt)) this.customers.splice(i, 1);
        }
      }
    },

    releaseCustomer: function (c, payed) {
      if (c.table) { c.table.customer = null; c.table = null; }
      if (c.assignedZombie) {
        var z = c.assignedZombie;
        if (z.carrying) { this.readyFood.push(z.carrying); z.carrying = null; }
        z.task = null; z.state = 'returning'; c.assignedZombie = null;
      }
      c.state = 'leaving';
      if (!payed) { this.floater(c.wx, c.wy, '😠', '#e74c3c'); }
    },

    /* ----------------------- Zombie dispatch & update --------------------- */
    dispatchZombies: function () {
      if (this.readyFood.length === 0) return;
      for (var i = 0; i < this.zombies.length; i++) {
        var z = this.zombies[i];
        if (!z.isAvailable()) continue;
        var target = null;
        for (var j = 0; j < this.customers.length; j++) {
          var c = this.customers[j];
          if (c.state === 'waiting' && !c.served && !c.assignedZombie) { target = c; break; }
        }
        if (!target || this.readyFood.length === 0) break;
        var portion = this.readyFood.shift();
        target.assignedZombie = z;
        z.task = { customer: target, portion: portion };
        z.state = 'toPickup';
      }
    },

    customerValid: function (c) { return c && c.state === 'waiting' && this.customers.indexOf(c) !== -1; },

    abortTask: function (z) {
      if (z.carrying) { this.readyFood.push(z.carrying); z.carrying = null; }
      if (z.task && z.task.customer && z.task.customer.assignedZombie === z) z.task.customer.assignedZombie = null;
      z.task = null;
      if (z.state !== 'resting') z.state = 'returning';
    },

    updateZombies: function (dt) {
      for (var i = 0; i < this.zombies.length; i++) {
        var z = this.zombies[i];
        z.phase += dt * 9;
        if (z.state === 'raiding') continue;

        if (z.state === 'resting') {
          z.energy += CONFIG.energyRegenRest * dt;
          if (z.energy >= CONFIG.zombieMaxEnergy * 0.5) { z.energy = util.clamp(z.energy, 0, CONFIG.zombieMaxEnergy); z.state = 'idle'; }
          continue;
        }
        z.energy -= CONFIG.energyDrainIdle * dt;
        if (z.energy <= 0) { z.energy = 0; this.abortTask(z); z.state = 'resting'; continue; }

        if (z.state === 'idle') {
          ZC.moveTo(z, z.homeX, z.homeY, CONFIG.zombieSpeed * 0.5, dt);
        } else if (z.state === 'toPickup') {
          if (!z.task || !this.customerValid(z.task.customer)) { this.abortTask(z); continue; }
          if (ZC.moveTo(z, this.kitchen.wx + 0.4, this.kitchen.wy + 0.4, CONFIG.zombieSpeed, dt)) { z.carrying = z.task.portion; z.state = 'toServe'; }
        } else if (z.state === 'toServe') {
          if (!z.task || !this.customerValid(z.task.customer)) { this.abortTask(z); continue; }
          var c = z.task.customer, sp = c.table.seat();
          if (ZC.moveTo(z, sp.wx - 0.5, sp.wy, CONFIG.zombieSpeed, dt)) this.serveCustomer(z, c);
        } else if (z.state === 'returning') {
          if (ZC.moveTo(z, z.homeX, z.homeY, CONFIG.zombieSpeed, dt)) z.state = 'idle';
        }
      }
    },

    serveCustomer: function (z, c) {
      var portion = z.carrying || (z.task && z.task.portion);
      var pay = portion ? portion.price : 10;
      z.carrying = null; z.task = null;
      z.energy -= CONFIG.serveEnergyCost; z.state = 'returning';
      c.served = true; c.assignedZombie = null; c.state = 'eating'; c.eatTimer = CONFIG.eatTime;
      this.addCoins(pay); this.addXP(Math.max(3, Math.round(pay / 4)));
      this.stats.served++;
      this.floater(c.wx, c.wy, '+' + pay, '#f1c40f');
      if (ZC.sfx) ZC.sfx.coin();
    },

    /* ------------------------------ Infect -------------------------------- */
    infectCustomer: function (c) {
      if (this.zombies.length >= this.maxZombies()) { if (ZC.ui) ZC.ui.toast('Zombie cap reached — add more tables/level up.'); if (ZC.sfx) ZC.sfx.error(); return false; }
      if (this.toxin < CONFIG.infectCost) { if (ZC.ui) ZC.ui.toast('Not enough toxin (need ' + CONFIG.infectCost + ').'); if (ZC.sfx) ZC.sfx.error(); return false; }
      if (c.state !== 'waiting' && c.state !== 'eating') return false;
      this.toxin -= CONFIG.infectCost;
      if (c.table) c.table.customer = null;
      if (c.assignedZombie) this.abortTask(c.assignedZombie);
      var idx = this.customers.indexOf(c); if (idx !== -1) this.customers.splice(idx, 1);
      var z = this.spawnZombie(c.wx, c.wy); z.energy = CONFIG.zombieMaxEnergy; z.state = 'returning';
      this.stats.infected++;
      this.floater(c.wx, c.wy, 'INFECTED!', '#9b59b6');
      if (ZC.sfx) ZC.sfx.infect();
      if (ZC.ui) { ZC.ui.updateHUD(); ZC.ui.toast('Customer infected — new zombie staffer!'); }
      return true;
    },

    /* ------------------------- Flesh / feeding ---------------------------- */
    feedZombie: function (z) {
      if (this.flesh < 1) { if (ZC.ui) ZC.ui.toast('No flesh! Raid the city or buy some.'); if (ZC.sfx) ZC.sfx.error(); return false; }
      this.flesh--; z.energy = util.clamp(z.energy + CONFIG.fleshFeedAmount, 0, CONFIG.zombieMaxEnergy);
      if (z.state === 'resting' && z.energy > CONFIG.zombieMaxEnergy * 0.3) z.state = 'idle';
      this.floater(z.wx, z.wy, '+energy', '#2ecc71');
      if (ZC.sfx) ZC.sfx.feed();
      if (ZC.ui) ZC.ui.updateHUD();
      return true;
    },
    buyFlesh: function () {
      if (this.toxin < 1) { if (ZC.ui) ZC.ui.toast('Not enough toxin.'); if (ZC.sfx) ZC.sfx.error(); return false; }
      this.toxin--; this.flesh += CONFIG.fleshPerToxin;
      if (ZC.ui) { ZC.ui.updateHUD(); ZC.ui.toast('Bought ' + CONFIG.fleshPerToxin + ' flesh.'); }
      return true;
    },

    /* ------------------------------ Raids --------------------------------- */
    startRaid: function () {
      if (this.raid.active) { if (ZC.ui) ZC.ui.toast('A raid is already underway.'); return false; }
      if (this.raid.cooldown > 0) { if (ZC.ui) ZC.ui.toast('Raid on cooldown (' + Math.ceil(this.raid.cooldown) + 's).'); return false; }
      var avail = []; for (var i = 0; i < this.zombies.length; i++) if (this.zombies[i].isAvailable()) avail.push(this.zombies[i]);
      if (avail.length === 0) { if (ZC.ui) ZC.ui.toast('No rested zombies free to raid!'); if (ZC.sfx) ZC.sfx.error(); return false; }
      var count = Math.min(3, avail.length);
      for (var k = 0; k < count; k++) { avail[k].state = 'raiding'; avail[k].energy -= 20; }
      this.raid.active = true; this.raid.timer = CONFIG.raidDuration; this.raid.count = count;
      if (ZC.ui) ZC.ui.toast('Sent ' + count + ' zombies to scavenge the city...');
      return true;
    },
    updateRaid: function (dt) {
      if (this.raid.cooldown > 0) this.raid.cooldown -= dt;
      if (!this.raid.active) return;
      this.raid.timer -= dt;
      if (this.raid.timer <= 0) {
        var count = this.raid.count;
        var coins = Math.round(util.rand(40, 90) * count), flesh = Math.round(util.rand(2, 4) * count), toxin = Math.round(util.rand(1, 3) * count);
        this.addCoins(coins); this.addFlesh(flesh); this.addToxin(toxin);
        for (var i = 0; i < this.zombies.length; i++) if (this.zombies[i].state === 'raiding') {
          this.zombies[i].state = 'returning'; this.zombies[i].wx = this.kitchen.wx + 0.5; this.zombies[i].wy = this.kitchen.wy + 0.5;
        }
        this.raid.active = false; this.raid.cooldown = CONFIG.raidCooldown; this.raid.count = 0; this.stats.raids++;
        if (ZC.sfx) ZC.sfx.coin();
        if (ZC.ui) ZC.ui.toast('Raid returned! +' + coins + ' coins, +' + flesh + ' flesh, +' + toxin + ' toxin');
      }
    },

    updateFloaters: function (dt) {
      for (var i = this.floaters.length - 1; i >= 0; i--) {
        var f = this.floaters[i]; f.life -= dt; f.dy += 26 * dt;
        if (f.life <= 0) this.floaters.splice(i, 1);
      }
    },

    /* ------------------------------ Render -------------------------------- */
    render: function () {
      var ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
      ctx.clearRect(0, 0, W, H);
      this.drawRoom(ctx);

      // build highlight
      if (this.mode.indexOf('build:') === 0 && this.hoverTile) this.drawTileHighlight(ctx, this.hoverTile.col, this.hoverTile.row);

      // counter plates (ready food waiting to be served)
      this.drawCounterPlates(ctx);

      // depth-sorted entities
      var draw = [];
      var i;
      for (i = 0; i < this.decor.length; i++) draw.push(this.decor[i]);
      for (i = 0; i < this.tables.length; i++) draw.push(this.tables[i]);
      for (i = 0; i < this.stoves.length; i++) draw.push(this.stoves[i]);
      for (i = 0; i < this.customers.length; i++) draw.push(this.customers[i]);
      for (i = 0; i < this.zombies.length; i++) if (this.zombies[i].state !== 'raiding') draw.push(this.zombies[i]);
      draw.sort(function (a, b) {
        var ka = a.wx + a.wy, kb = b.wx + b.wy;
        if (ka !== kb) return ka - kb;
        return (a.kind === 'zombie' || a.kind === 'customer' ? 1 : 0) - (b.kind === 'zombie' || b.kind === 'customer' ? 1 : 0);
      });
      for (i = 0; i < draw.length; i++) this.drawEntity(ctx, draw[i]);

      // floaters
      for (i = 0; i < this.floaters.length; i++) {
        var f = this.floaters[i], p = iso.project(f.wx, f.wy);
        S.floater(ctx, p.x, p.y - 40 - f.dy, f.text, f.color, util.clamp(f.life / f.max, 0, 1));
      }

      if (this.raid.active) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(W / 2 - 130, 8, 260, 28);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('🧟 Raiding the city... ' + Math.ceil(this.raid.timer) + 's', W / 2, 26);
      }
    },

    drawRoom: function (ctx) {
      var C = CONFIG;
      // far back walls (left + right) meeting at top corner
      var top = iso.project(0, 0);
      var rightEnd = iso.project(C.cols, 0);
      var leftEnd = iso.project(0, C.rows);
      // right-back wall
      ctx.fillStyle = '#473a4a';
      ctx.beginPath();
      ctx.moveTo(top.x, top.y); ctx.lineTo(rightEnd.x, rightEnd.y);
      ctx.lineTo(rightEnd.x, rightEnd.y - C.wallH); ctx.lineTo(top.x, top.y - C.wallH); ctx.closePath(); ctx.fill();
      // left-back wall
      ctx.fillStyle = '#3b3140';
      ctx.beginPath();
      ctx.moveTo(top.x, top.y); ctx.lineTo(leftEnd.x, leftEnd.y);
      ctx.lineTo(leftEnd.x, leftEnd.y - C.wallH); ctx.lineTo(top.x, top.y - C.wallH); ctx.closePath(); ctx.fill();
      // windows on each wall
      this.drawWindows(ctx, top, rightEnd, C.wallH, 1);
      this.drawWindows(ctx, top, leftEnd, C.wallH, -1);
      // skirting
      ctx.strokeStyle = '#2a2230'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(rightEnd.x, rightEnd.y); ctx.lineTo(top.x, top.y); ctx.lineTo(leftEnd.x, leftEnd.y); ctx.stroke();

      // checkered floor
      for (var r = 0; r < C.rows; r++) {
        for (var c = 0; c < C.cols; c++) {
          var a = iso.project(c, r), b = iso.project(c + 1, r), d = iso.project(c + 1, r + 1), e = iso.project(c, r + 1);
          ctx.fillStyle = ((c + r) % 2 === 0) ? '#5a4636' : '#4b3a2d';
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(d.x, d.y); ctx.lineTo(e.x, e.y); ctx.closePath(); ctx.fill();
        }
      }
      // counter strip across back (row 0 visual)
      var cs = iso.project(0, 0.04), ce = iso.project(C.cols, 0.04);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cs.x, cs.y); ctx.lineTo(ce.x, ce.y); ctx.stroke();

      // entrance doormat
      var m = iso.project(this.entrance.wx, this.entrance.wy);
      ctx.fillStyle = '#7b241c';
      ctx.beginPath(); ctx.moveTo(m.x, m.y - 9); ctx.lineTo(m.x + 22, m.y); ctx.lineTo(m.x, m.y + 9); ctx.lineTo(m.x - 22, m.y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ecf0f1'; ctx.font = '9px system-ui'; ctx.textAlign = 'center'; ctx.fillText('WELCOME', m.x, m.y + 2);
    },

    drawWindows: function (ctx, top, end, wallH, dir) {
      var n = 2;
      for (var i = 0; i < n; i++) {
        var t0 = 0.28 + i * 0.34, t1 = t0 + 0.18;
        var x0 = top.x + (end.x - top.x) * t0, y0 = top.y + (end.y - top.y) * t0;
        var x1 = top.x + (end.x - top.x) * t1, y1 = top.y + (end.y - top.y) * t1;
        var wy = wallH * 0.62, wh = wallH * 0.34;
        ctx.fillStyle = 'rgba(120,150,180,0.35)';
        ctx.beginPath();
        ctx.moveTo(x0, y0 - wy); ctx.lineTo(x1, y1 - wy);
        ctx.lineTo(x1, y1 - wy - wh); ctx.lineTo(x0, y0 - wy - wh); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#2a2230'; ctx.lineWidth = 2; ctx.stroke();
      }
    },

    drawTileHighlight: function (ctx, col, row) {
      var a = iso.project(col, row), b = iso.project(col + 1, row), d = iso.project(col + 1, row + 1), e = iso.project(col, row + 1);
      ctx.fillStyle = this.canPlace(col, row) ? 'rgba(46,204,113,0.4)' : 'rgba(231,76,60,0.4)';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(d.x, d.y); ctx.lineTo(e.x, e.y); ctx.closePath(); ctx.fill();
    },

    drawCounterPlates: function (ctx) {
      var n = Math.min(this.readyFood.length, 8);
      for (var i = 0; i < n; i++) {
        var p = iso.project(this.kitchen.wx + 0.3 + i * 0.18, this.kitchen.wy + 0.3 + i * 0.05);
        var rec = ZC.recipeById(this.readyFood[i].recipeId);
        S.plate(ctx, p.x, p.y, rec ? rec.color : '#bbb');
      }
    },

    drawEntity: function (ctx, e) {
      var p = iso.project(e.wx, e.wy);
      if (e.kind === 'table') {
        S.table(ctx, p.x, p.y, !e.isFree());
      } else if (e.kind === 'stove') {
        var rec = e.recipe();
        S.stove(ctx, p.x, p.y, { cooking: e.cooking, progress: e.cooking ? 1 - e.timer / rec.cookTime : 0, icon: rec ? rec.icon : '', phase: this._t || 0 });
      } else if (e.kind === 'decor') {
        S.decor(ctx, p.x, p.y, e.itemId);
      } else if (e.kind === 'customer') {
        var moving = e.state === 'entering' || e.state === 'leaving';
        S.customer(ctx, p.x, p.y, { color: e.color, hair: e.hair, facing: e.facing, phase: moving ? e.phase : 0 });
        if (e.state === 'waiting') S.bubble(ctx, p.x, p.y, util.clamp(e.patience / CONFIG.customerPatience, 0, 1), '🍴');
        else if (e.state === 'eating') S.bubble(ctx, p.x, p.y, -1, '😋');
      } else if (e.kind === 'zombie') {
        if (e.state === 'resting' && e.energy < 1) { S.tombstone(ctx, p.x, p.y); return; }
        var mv = e.state === 'toPickup' || e.state === 'toServe' || e.state === 'returning';
        var cr = e.carrying ? ZC.recipeById(e.carrying.recipeId) : null;
        S.zombie(ctx, p.x, p.y, { phase: mv ? e.phase : 0, facing: e.facing, carrying: !!e.carrying, carryColor: cr ? cr.color : null, resting: e.state === 'resting', showEnergy: true, energy: e.energy });
        if (e.state === 'resting') { ctx.font = '13px serif'; ctx.textAlign = 'center'; ctx.fillText('💤', p.x + 16, p.y - 34); }
      }
    },

    /* ----------------------------- Input ---------------------------------- */
    bindCanvas: function () {
      var self = this, canvas = this.canvas;
      function toCanvas(ev) {
        var rect = canvas.getBoundingClientRect();
        var sx = canvas.width / rect.width, sy = canvas.height / rect.height;
        var px = ev.clientX !== undefined ? ev.clientX : (ev.touches && ev.touches[0].clientX);
        var py = ev.clientY !== undefined ? ev.clientY : (ev.touches && ev.touches[0].clientY);
        return { x: (px - rect.left) * sx, y: (py - rect.top) * sy };
      }
      function tileAt(p) { var u = iso.unproject(p.x, p.y); return { col: Math.floor(u.wx), row: Math.floor(u.wy) }; }

      canvas.addEventListener('mousemove', function (ev) { self.hoverTile = tileAt(toCanvas(ev)); });
      canvas.addEventListener('click', function (ev) { var p = toCanvas(ev); self.handleClick(p.x, p.y, tileAt(p)); });
      canvas.addEventListener('touchstart', function (ev) {
        ev.preventDefault(); var p = toCanvas(ev); var t = tileAt(p); self.hoverTile = t; self.handleClick(p.x, p.y, t);
      }, { passive: false });
    },

    handleClick: function (sx, sy, tile) {
      if (this.mode.indexOf('build:') === 0) { this.placeItem(this.mode.split(':')[1], tile.col, tile.row); return; }
      if (this.mode === 'infect') { var c = this.pickCustomer(sx, sy); if (c) this.infectCustomer(c); return; }
      var st = this.pickStove(sx, sy); if (st) { if (ZC.ui) ZC.ui.openStoveMenu(st); return; }
      var z = this.pickZombie(sx, sy); if (z) { if (z.state === 'resting' || z.energy < CONFIG.zombieMaxEnergy) this.feedZombie(z); return; }
    },

    // pick by nearest projected screen position
    pickNearest: function (list, sx, sy, maxD, skip) {
      var best = null, bd = maxD;
      for (var i = 0; i < list.length; i++) {
        var o = list[i]; if (skip && skip(o)) continue;
        var p = iso.project(o.wx, o.wy);
        var d = util.dist(sx, sy, p.x, p.y - 14);
        if (d < bd) { bd = d; best = o; }
      }
      return best;
    },
    pickStove: function (sx, sy) { return this.pickNearest(this.stoves, sx, sy, 30); },
    pickZombie: function (sx, sy) { return this.pickNearest(this.zombies, sx, sy, 28, function (z) { return z.state === 'raiding'; }); },
    pickCustomer: function (sx, sy) { return this.pickNearest(this.customers, sx, sy, 28); },

    /* ------------------------------ Save ---------------------------------- */
    save: function () {
      try {
        localStorage.setItem('zombieCafeSave', JSON.stringify({
          v: 2, coins: this.coins, toxin: this.toxin, flesh: this.flesh, xp: this.xp, level: this.level, stats: this.stats,
          tables: this.tables.map(function (t) { return { c: t.col, r: t.row }; }),
          stoves: this.stoves.map(function (s) { return { c: s.col, r: s.row, recipe: s.recipeId, auto: s.auto }; }),
          decor: this.decor.map(function (d) { return { c: d.col, r: d.row, item: d.itemId }; }),
          zombieCount: this.zombies.length
        }));
        return true;
      } catch (e) { return false; }
    },
    load: function () {
      try {
        var raw = localStorage.getItem('zombieCafeSave'); if (!raw) return false;
        var d = JSON.parse(raw); if (d.v !== 2) return false;   // old saves use different coords
        this.coins = d.coins; this.toxin = d.toxin; this.flesh = d.flesh; this.xp = d.xp; this.level = d.level;
        this.stats = d.stats || { served: 0, infected: 0, raids: 0 };
        this.tables = (d.tables || []).map(function (t) { return new ZC.Table(t.c, t.r); });
        this.stoves = (d.stoves || []).map(function (s) { var st = new ZC.Stove(s.c, s.r); st.recipeId = s.recipe || 'coffee'; st.auto = s.auto !== false; return st; });
        this.decor = (d.decor || []).map(function (x) { return new ZC.Decor(x.c, x.r, x.item); });
        this.zombies = []; var n = d.zombieCount || 2;
        for (var i = 0; i < n; i++) this.spawnZombie(this.kitchen.wx + 0.5 + i * 0.3, this.kitchen.wy + 0.5 + i * 0.2);
        this.customers = []; this.readyFood = [];
        return true;
      } catch (e) { return false; }
    },
    reset: function () { localStorage.removeItem('zombieCafeSave'); this.newGame(); if (ZC.ui) ZC.ui.updateHUD(); }
  };

})(window.ZC || (window.ZC = {}));
