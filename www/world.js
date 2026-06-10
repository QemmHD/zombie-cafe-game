/* =====================================================================
 * Zombie Cafe — world simulation (pure logic, no canvas/DOM).
 *
 * A top-down cafe. Humans enter through the door, walk to a table and sit.
 * You tap stoves to cook; finished dishes pile on the kitchen "pass". Zombie
 * staff walk to the pass, pick up a dish, carry it to a waiting customer, who
 * eats, pays (tap to collect coins), then leaves. Infect a customer to turn
 * them into a zombie worker. Send squads of zombies to raid rival cafes.
 *
 * Everything is driven by tick(dt). Time is the internal `t` accumulator, so
 * the whole sim is deterministic and unit-testable without a browser.
 * Coordinates live in a 720 x 1280 virtual world; the renderer scales to fit.
 * ===================================================================== */
(function () {
  'use strict';

  var W = 720, H = 1280;
  var SPEED = 165;          // px / second walking speed
  var EAT_TIME = 5;
  var AUTO_PAY = 12;        // auto-collect a paying customer after this long
  var POOL_CAP = 40;
  var MAX_STOVES = 6, MAX_TABLES = 16;
  var INFECT_CHANCE = 0.16, INFECT_COST = 2;

  var RECIPES = {}, RIVAL = {};
  (function () {
    (window.RECIPES || []).forEach(function (r) { RECIPES[r.id] = r; });
    (window.RIVALS || []).forEach(function (r) { RIVAL[r.id] = r; });
  })();
  function shopById(id) { var s = window.SHOP || []; for (var i = 0; i < s.length; i++) if (s[i].id === id) return s[i]; return null; }

  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  var COLORS = window.CUSTOMER_COLORS, SKINS = window.SKIN_TONES;

  // ---- layout: fixed slots for furniture & key points ----------------
  var STOVE_SLOTS = [ {x:96,y:150}, {x:221,y:150}, {x:346,y:150}, {x:471,y:150}, {x:596,y:150}, {x:660,y:150} ];
  var TABLE_SLOTS = (function () {
    var xs = [120, 280, 440, 600], ys = [480, 650, 820, 985], out = [];
    for (var r = 0; r < ys.length; r++) for (var c = 0; c < xs.length; c++) out.push({ x: xs[c], y: ys[r] });
    return out;
  })();
  var PASS = { x: 360, y: 250 };
  var DOOR = { x: 360, y: 1215 };
  function home(i) { return { x: 180 + (i % 5) * 90, y: 330 + Math.floor(i / 5) * 64 }; }

  // =====================================================================
  function World(saved) { this.events = []; saved ? this._restore(saved) : this._fresh(); }

  World.prototype._fresh = function () {
    this.t = 0; this.coins = 60; this.toxin = 2; this.xp = 0; this.level = 1;
    this.served = 0; this.decor = {}; this.lastRecipe = 'coffee';
    this.ready = []; this.spawnAt = 1.2; this.raid = null;
    this.stoves = [ this._mkStove(0), this._mkStove(1) ];
    this.tables = [ this._mkTable(0), this._mkTable(1), this._mkTable(2) ];
    this.customers = [];
    this.zombies = [ this._mkZombie(0) ];
  };
  World.prototype._mkStove  = function (i) { var s = STOVE_SLOTS[i]; return { id: uid(), slot: i, x: s.x, y: s.y, recipe: null, start: 0, ready: false }; };
  World.prototype._mkTable  = function (i) { var s = TABLE_SLOTS[i]; return { id: uid(), slot: i, x: s.x, y: s.y, by: null }; };
  World.prototype._mkZombie = function (i) { var h = home(i); return { id: uid(), x: h.x, y: h.y, hx: h.x, hy: h.y, state: 'idle', tx: h.x, ty: h.y, carry: null, job: null, face: 'L', step: Math.random() * 6 }; };

  // ---- save / load ----------------------------------------------------
  World.prototype.snapshot = function () {
    return {
      t: this.t, coins: this.coins, toxin: this.toxin, xp: this.xp, level: this.level,
      served: this.served, decor: this.decor, lastRecipe: this.lastRecipe, ready: this.ready,
      spawnAt: this.spawnAt, raid: this.raid,
      stoves: this.stoves, tables: this.tables, zombies: this.zombies, customers: this.customers,
    };
  };
  World.prototype._restore = function (s) {
    for (var k in s) this[k] = s[k];
    this.events = []; this.customers = this.customers || []; this.ready = this.ready || [];
    this.decor = this.decor || {};
    // forward-compat: ensure zombies have home + render fields
    var self = this;
    (this.zombies || []).forEach(function (z, i) { if (z.hx == null) { var h = home(i); z.hx = h.x; z.hy = h.y; } if (z.step == null) z.step = 0; if (!z.face) z.face = 'L'; });
  };
  // Called once on load: finish cooks that completed offline; diners have left.
  World.prototype.fastForward = function (elapsed) {
    elapsed = Math.max(0, Math.min(elapsed, 8 * 3600));
    this.t += elapsed; this.customers = [];
    this.tables.forEach(function (tb) { tb.by = null; });
    for (var i = 0; i < this.stoves.length; i++) {
      var st = this.stoves[i]; if (st.recipe && this.t >= st.start + RECIPES[st.recipe].time) this._finishStove(st);
    }
    if (this.raid && this.t >= this.raid.returnsAt) this._resolveRaid();
  };

  // ---- derived --------------------------------------------------------
  World.prototype.ambiance = function () { var a = 0; for (var id in this.decor) { var it = shopById(id); if (it) a += it.ambiance || 0; } return a; };
  World.prototype.tipMult = function () { return 1 + this.ambiance() / 200; };
  World.prototype.patience = function () { return 20 + this.ambiance() / 8; };
  World.prototype.spawnEvery = function () { return Math.max(2.2, 6 / (1 + this.ambiance() / 50)); };
  World.prototype.xpNeed = function (lvl) { return Math.floor(60 * Math.pow(lvl, 1.4)); };
  World.prototype.unlocked = function () { var L = this.level; return (window.RECIPES || []).filter(function (r) { return r.level <= L; }); };
  World.prototype.priceFor = function (item) {
    if (item.kind === 'decor') return item.base;
    var owned = item.kind === 'stove' ? this.stoves.length : item.kind === 'table' ? this.tables.length : this.zombies.length + (this.raid ? this.raid.squad : 0);
    var freeStart = item.kind === 'stove' ? 2 : item.kind === 'table' ? 3 : 1;
    return Math.round(item.base * Math.pow(item.grow, owned - freeStart));
  };
  World.prototype.totalZombies = function () { return this.zombies.length + (this.raid ? this.raid.squad : 0); };

  // ---- progression ----------------------------------------------------
  World.prototype._gainXp = function (n) {
    this.xp += n; var before = this.level, leveled = false;
    while (this.xp >= this.xpNeed(this.level)) { this.xp -= this.xpNeed(this.level); this.level++; leveled = true; }
    if (leveled) {
      this.toxin += this.level - before;
      var newly = (window.RECIPES || []).filter(function (r) { return r.level > before && r.level <= this.level; }, this);
      this.events.push({ type: 'level', level: this.level, newly: newly, toxin: this.level - before });
    }
  };

  // ---- player actions -------------------------------------------------
  World.prototype.startCook = function (stoveId, recipeId) {
    var st = byId(this.stoves, stoveId), r = RECIPES[recipeId];
    if (!st || !r || st.recipe) return false;
    if (this.coins < r.cost) { this.events.push({ type: 'warn', msg: 'Not enough coins for ' + r.name }); return false; }
    this.coins -= r.cost; st.recipe = recipeId; st.start = this.t; st.ready = false; this.lastRecipe = recipeId; return true;
  };
  World.prototype.rushCook = function (stoveId) {
    var st = byId(this.stoves, stoveId); if (!st || !st.recipe || st.ready) return false;
    var r = RECIPES[st.recipe], remain = (st.start + r.time) - this.t, cost = Math.max(1, Math.ceil(remain / 60));
    if (this.toxin < cost) { this.events.push({ type: 'warn', msg: 'Need ' + cost + ' toxin to rush' }); return false; }
    this.toxin -= cost; st.start = this.t - r.time; return true;
  };
  World.prototype._finishStove = function (st) {
    var r = RECIPES[st.recipe];
    for (var i = 0; i < r.batch && this.ready.length < POOL_CAP; i++) this.ready.push(r.id);
    st.recipe = null; st.start = 0; st.ready = false;
  };
  World.prototype.collectCustomer = function (cid) {
    var c = byId(this.customers, cid); if (!c || c.state !== 'paying') return false;
    this.coins += c.pay; this.served++; this._gainXp(c.xp);
    this.events.push({ type: 'coin', x: c.x, y: c.y, amount: c.pay, xp: c.xp });
    this._leave(c); return true;
  };
  World.prototype.infect = function (cid) {
    var c = byId(this.customers, cid);
    if (!c || !c.infectable || (c.state !== 'waiting' && c.state !== 'paying')) return false;
    if (this.toxin < INFECT_COST) { this.events.push({ type: 'warn', msg: 'Need ' + INFECT_COST + ' toxin to infect' }); return false; }
    this.toxin -= INFECT_COST;
    var z = this._mkZombie(this.zombies.length); z.x = c.x; z.y = c.y; z.state = 'returning'; z.tx = z.hx; z.ty = z.hy;
    this.zombies.push(z);
    this._gainXp((c.xp || 1) * 2);
    this.events.push({ type: 'infect', x: c.x, y: c.y });
    this._freeTable(c); this.customers.splice(this.customers.indexOf(c), 1);
    return true;
  };
  World.prototype.buy = function (itemId) {
    var it = shopById(itemId); if (!it) return false;
    var cost = this.priceFor(it), bag = it.cur, have = bag === 'coin' ? this.coins : this.toxin;
    if (have < cost) { this.events.push({ type: 'warn', msg: 'Not enough ' + (bag === 'coin' ? 'coins' : 'toxin') }); return false; }
    if (it.kind === 'stove' && this.stoves.length >= MAX_STOVES) { this.events.push({ type: 'warn', msg: 'Kitchen is full' }); return false; }
    if (it.kind === 'table' && this.tables.length >= MAX_TABLES) { this.events.push({ type: 'warn', msg: 'Dining room is full' }); return false; }
    if (it.kind === 'decor' && this.decor[it.id]) { this.events.push({ type: 'warn', msg: 'Already owned' }); return false; }
    if (bag === 'coin') this.coins -= cost; else this.toxin -= cost;
    if (it.kind === 'stove') this.stoves.push(this._mkStove(this.stoves.length));
    else if (it.kind === 'table') this.tables.push(this._mkTable(this.tables.length));
    else if (it.kind === 'zombie') this.zombies.push(this._mkZombie(this.zombies.length));
    else if (it.kind === 'decor') this.decor[it.id] = 1;
    this.events.push({ type: 'bought', item: it });
    return true;
  };

  // ---- raids (take over other cafes) ---------------------------------
  World.prototype.canRaid = function (rivalId) {
    var rv = RIVAL[rivalId]; if (!rv) return false;
    return !this.raid && this.level >= rv.level && this.zombies.length >= rv.squad;
  };
  World.prototype.startRaid = function (rivalId) {
    var rv = RIVAL[rivalId]; if (!this.canRaid(rivalId)) return false;
    this.zombies.splice(0, rv.squad);                 // they march off
    this.raid = { rival: rivalId, squad: rv.squad, returnsAt: this.t + rv.time };
    this.events.push({ type: 'raidStart', rival: rv });
    return true;
  };
  World.prototype._resolveRaid = function () {
    var rv = RIVAL[this.raid.rival], squad = this.raid.squad;
    var power = squad * 22 + this.level * 6;
    var win = power >= rv.defense;
    var loot = win ? rv.reward : Math.floor(rv.reward * 0.15);
    this.coins += loot; if (win) this.toxin += rv.toxin || 0;
    if (win) this._gainXp(Math.round(rv.defense));
    for (var i = 0; i < squad; i++) this.zombies.push(this._mkZombie(this.zombies.length));
    this.events.push({ type: 'raidEnd', rival: rv, win: win, loot: loot, toxin: win ? (rv.toxin || 0) : 0 });
    this.raid = null;
  };

  // ---- simulation -----------------------------------------------------
  World.prototype.tick = function (dt) {
    if (dt > 0.25) dt = 0.25;                          // clamp big frame gaps
    this.t += dt;
    this._spawn();
    for (var i = 0; i < this.stoves.length; i++) { var st = this.stoves[i]; if (st.recipe && this.t >= st.start + RECIPES[st.recipe].time) this._finishStove(st); }
    this._stepZombies(dt);
    this._stepCustomers(dt);
    if (this.raid && this.t >= this.raid.returnsAt) this._resolveRaid();
  };

  World.prototype._spawn = function () {
    if (this.t < this.spawnAt) return;
    this.spawnAt = this.t + this.spawnEvery() * (0.65 + Math.random() * 0.7);
    var free = this.tables.filter(function (tb) { return !tb.by; });
    if (!free.length) return;
    var tb = pick(free), c = {
      id: uid(), x: DOOR.x, y: DOOR.y, tx: tb.x, ty: tb.y + 42, table: tb.id,
      state: 'toTable', wait: 0, eat: 0, pay: 0, xp: 0, dish: null,
      assigned: null, infectable: Math.random() < INFECT_CHANCE,
      color: pick(COLORS), skin: pick(SKINS), face: 'U', step: Math.random() * 6,
    };
    tb.by = c.id; this.customers.push(c);
  };

  function moveTo(e, dt) {
    var dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy), s = SPEED * dt;
    if (d <= s || d === 0) { e.x = e.tx; e.y = e.ty; return true; }
    e.x += dx / d * s; e.y += dy / d * s;
    e.face = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'L' : 'R') : (dy < 0 ? 'U' : 'D');
    e.step += s * 0.05;
    return false;
  }

  World.prototype._stepZombies = function (dt) {
    for (var i = 0; i < this.zombies.length; i++) {
      var z = this.zombies[i];
      if (z.state === 'idle') { this._assign(z); }
      if (z.state === 'idle') { z.tx = z.hx; z.ty = z.hy; moveTo(z, dt); continue; }
      var arr = moveTo(z, dt);
      if (!arr) continue;
      if (z.state === 'toPass') {
        var c = byId(this.customers, z.job);
        if (c && c.state === 'waiting') { z.state = 'toCustomer'; z.tx = c.x; z.ty = c.y - 6; }
        else { if (z.carry) this.ready.push(z.carry); z.carry = null; z.job = null; z.state = 'returning'; z.tx = z.hx; z.ty = z.hy; }
      } else if (z.state === 'toCustomer') {
        var cu = byId(this.customers, z.job);
        if (cu && cu.state === 'waiting') { cu.state = 'eating'; cu.eat = this.t; cu.dish = z.carry; cu.assigned = null; }
        else if (z.carry) this.ready.push(z.carry);
        z.carry = null; z.job = null; z.state = 'returning'; z.tx = z.hx; z.ty = z.hy;
      } else if (z.state === 'returning') { z.state = 'idle'; }
    }
  };
  World.prototype._assign = function (z) {
    if (!this.ready.length) return;
    for (var i = 0; i < this.customers.length; i++) {
      var c = this.customers[i];
      if (c.state === 'waiting' && !c.assigned) {
        c.assigned = z.id; z.job = c.id; z.carry = this.ready.pop();
        z.state = 'toPass'; z.tx = PASS.x; z.ty = PASS.y + 28; return;
      }
    }
  };

  World.prototype._stepCustomers = function (dt) {
    for (var i = this.customers.length - 1; i >= 0; i--) {
      var c = this.customers[i], arr = moveTo(c, dt);
      if (c.state === 'toTable') { if (arr) { c.state = 'waiting'; c.wait = this.t; c.face = 'U'; } }
      else if (c.state === 'waiting') {
        if (!c.assigned && this.t - c.wait > this.patience()) { this._leave(c); }
      } else if (c.state === 'eating') {
        if (this.t - c.eat >= EAT_TIME) {
          c.state = 'paying'; c.pay = Math.round((RECIPES[c.dish] || RECIPES.coffee).price * this.tipMult());
          c.xp = (RECIPES[c.dish] || RECIPES.coffee).xp; c.payAt = this.t;
        }
      } else if (c.state === 'paying') {
        if (this.t - c.payAt >= AUTO_PAY) { this.coins += c.pay; this.served++; this._gainXp(c.xp); this.events.push({ type: 'coin', x: c.x, y: c.y, amount: c.pay, xp: c.xp }); this._leave(c); }
      } else if (c.state === 'leaving') {
        if (arr) this.customers.splice(i, 1);
      }
    }
  };
  World.prototype._freeTable = function (c) { var tb = byId(this.tables, c.table); if (tb && tb.by === c.id) tb.by = null; };
  World.prototype._leave = function (c) { this._freeTable(c); c.state = 'leaving'; c.assigned = null; c.tx = DOOR.x; c.ty = DOOR.y; };

  function byId(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }

  // hit-testing helper for the renderer: nearest tappable entity to a point
  World.prototype.pickAt = function (x, y) {
    var best = null, bd = 46;
    for (var i = 0; i < this.customers.length; i++) {
      var c = this.customers[i]; if (c.state !== 'paying' && !(c.infectable && c.state === 'waiting')) continue;
      var d = dist(x, y, c.x, c.y - 16); if (d < bd) { bd = d; best = { kind: 'customer', id: c.id, paying: c.state === 'paying', infectable: c.infectable }; }
    }
    if (best && best.paying) return best;                 // prefer paying
    for (var j = 0; j < this.stoves.length; j++) {
      var s = this.stoves[j], dd = dist(x, y, s.x, s.y); if (dd < 52) { var sd = best ? bd : 999; if (dd < sd) return { kind: 'stove', id: s.id }; }
    }
    return best;
  };

  // expose constants the renderer needs
  World.W = W; World.H = H; World.PASS = PASS; World.DOOR = DOOR; World.STOVE_SLOTS = STOVE_SLOTS;
  window.createWorld = function (saved) { return new World(saved); };
  window.World = World;
})();
