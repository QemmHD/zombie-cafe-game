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

  // The world is a flat tile PLANE (logical floor coords). The renderer
  // projects it into an isometric view. COLS x ROWS tiles of size TILE.
  var TILE = 120, COLS = 7, ROWS = 8;
  var W = COLS * TILE, H = ROWS * TILE;     // 840 x 960 plane
  var SPEED = 150;          // plane-units / second walking speed
  var EAT_TIME = 5;
  var AUTO_PAY = 12;        // auto-collect a paying customer after this long
  var POOL_CAP = 40;
  var STOVE_AUTOPLATE = 30;     // idle safety net: auto-serve a finished stove
  var MAX_STOVES = 6, MAX_TABLES = 16;
  var INFECT_CHANCE = 0.16, INFECT_COST = 2;
  // zombie stamina + cleaning
  var DRAIN = 2.0, REGEN_IDLE = 3.0, REGEN_REST = 9.0;   // energy per second
  var TIRED = 14, RESTED = 55;                            // sleep below TIRED, wake at RESTED
  var CLEAN_TIME = 3.5;                                   // base seconds to clear a table
  var ZNAMES = ['Mort', 'Gnash', 'Rosa', 'Brundle', 'Patch', 'Drool', 'Stitch', 'Cleaver', 'Mossy', 'Gore', 'Hazel', 'Bones', 'Pickle', 'Snot', 'Grim', 'Maggot', 'Vee', 'Crud'];
  function rollRarity(boost) { var r = Math.random() - (boost || 0); return r < 0.05 ? 'elite' : r < 0.3 ? 'rare' : 'common'; }
  function statsFor(rar) { return rar === 'elite' ? { speed: 1.35, serve: 1.4, clean: 1.4 } : rar === 'rare' ? { speed: 1.15, serve: 1.2, clean: 1.2 } : { speed: 1, serve: 1, clean: 1 }; }

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
  var HAIRS = ['#2b2b2b', '#5a3a1a', '#7a5230', '#d9c27a', '#b04a2a', '#888', '#3a2a4a'];

  // ---- layout: fixed slots for furniture & key points ----------------
  // Kitchen appliances line the back wall (row ~0). 6 slots across.
  var STOVE_SLOTS = [ {x:90,y:78}, {x:210,y:78}, {x:330,y:78}, {x:510,y:78}, {x:630,y:78}, {x:750,y:78} ];
  // The dining floor is a 4x5 grid of cells. Tables AND decor occupy cells, so
  // decorating your cafe trades off seating — just like the original.
  var CELLS = (function () {
    var xs = [130, 320, 510, 700], ys = [330, 462, 594, 726, 852], out = [];
    for (var r = 0; r < ys.length; r++) for (var c = 0; c < xs.length; c++) out.push({ x: xs[c], y: ys[r] });
    return out;
  })();
  var TABLE_SLOTS = CELLS;
  var PASS = { x: 420, y: 168 };
  var DOOR = { x: 420, y: 930 };
  function home(i) { return { x: 110 + (i % 5) * 150, y: 210 + Math.floor(i / 5) * 64 }; }

  // =====================================================================
  function World(saved) { this.events = []; saved ? this._restore(saved) : this._fresh(); }

  World.prototype._fresh = function () {
    this.t = 0; this.coins = 60; this.toxin = 2; this.xp = 0; this.level = 1;
    this.served = 0; this.decor = {}; this.lastRecipe = 'coffee';
    this.ready = []; this.spawnAt = 1.2; this.raid = null; this.extraRecipes = [];
    this.stoves = [ this._mkStove(0), this._mkStove(1) ];
    this.decors = [];
    this.tables = [ this._mkTable(0), this._mkTable(5), this._mkTable(2) ];
    this.customers = [];
    this.zombies = [ this._mkZombie(0) ];
  };
  World.prototype._mkStove  = function (slot) { var s = STOVE_SLOTS[slot]; return { id: uid(), slot: slot, x: s.x, y: s.y, recipe: null, start: 0, ready: false }; };
  World.prototype._mkTable  = function (cell) { var s = CELLS[cell]; return { id: uid(), cell: cell, x: s.x, y: s.y, by: null, dirty: false, cleaning: null }; };
  World.prototype._mkDecor  = function (deco, cell) { var s = CELLS[cell]; return { id: uid(), deco: deco, cell: cell, x: s.x, y: s.y }; };

  // ---- grid helpers (build / placement) ------------------------------
  World.prototype.cellFree = function (cell, exceptId) {
    for (var i = 0; i < this.tables.length; i++) if (this.tables[i].cell === cell && this.tables[i].id !== exceptId) return false;
    for (var j = 0; j < this.decors.length; j++) if (this.decors[j].cell === cell && this.decors[j].id !== exceptId) return false;
    return true;
  };
  World.prototype.firstFreeCell = function () { for (var i = 0; i < CELLS.length; i++) if (this.cellFree(i)) return i; return -1; };
  World.prototype.freeStoveSlot = function () {
    for (var s = 0; s < STOVE_SLOTS.length; s++) { var used = false; for (var i = 0; i < this.stoves.length; i++) if (this.stoves[i].slot === s) used = true; if (!used) return s; } return -1;
  };
  World.prototype._mkZombie = function (i, rar) { var h = home(i); rar = rar || rollRarity(); var s = statsFor(rar);
    return { id: uid(), x: h.x, y: h.y, hx: h.x, hy: h.y, state: 'idle', tx: h.x, ty: h.y, carry: null, job: null, cleanId: null, face: 'L', step: Math.random() * 6,
      name: pick(ZNAMES), rarity: rar, role: 'auto', energy: 100, speed: s.speed, serve: s.serve, clean: s.clean }; };

  // ---- save / load ----------------------------------------------------
  World.prototype.snapshot = function () {
    return {
      t: this.t, coins: this.coins, toxin: this.toxin, xp: this.xp, level: this.level,
      served: this.served, decor: this.decor, lastRecipe: this.lastRecipe, ready: this.ready,
      spawnAt: this.spawnAt, raid: this.raid, extraRecipes: this.extraRecipes,
      stoves: this.stoves, tables: this.tables, decors: this.decors, zombies: this.zombies, customers: this.customers,
    };
  };
  World.prototype._restore = function (s) {
    for (var k in s) this[k] = s[k];
    this.events = []; this.customers = this.customers || []; this.ready = this.ready || [];
    this.decor = this.decor || {}; this.decors = this.decors || [];
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
      var st = this.stoves[i]; if (st.recipe && this.t >= st.start + RECIPES[st.recipe].time) { st.ready = true; st.readyAt = this.t; this.plateStove(st); }
    }
    if (this.raid && this.t >= this.raid.returnsAt) this._resolveRaid();
  };

  // ---- derived --------------------------------------------------------
  World.prototype.ambiance = function () { var a = 0; for (var i = 0; i < this.decors.length; i++) { var it = shopById(this.decors[i].deco); if (it) a += it.ambiance || 0; } return a; };
  World.prototype.tipMult = function () { return 1 + this.ambiance() / 200; };
  World.prototype.patience = function () { return 20 + this.ambiance() / 8; };
  World.prototype.spawnEvery = function () { return Math.max(2.2, 6 / (1 + this.ambiance() / 50)); };
  World.prototype.xpNeed = function (lvl) { return Math.floor(60 * Math.pow(lvl, 1.4)); };
  World.prototype.unlocked = function () { var L = this.level, ex = this.extraRecipes || []; return (window.RECIPES || []).filter(function (r) { return r.level <= L || ex.indexOf(r.id) >= 0; }); };
  World.prototype.priceFor = function (item) {
    var owned;
    if (item.kind === 'decor') owned = this.decors.filter(function (d) { return d.deco === item.id; }).length;
    else owned = item.kind === 'stove' ? this.stoves.length : item.kind === 'table' ? this.tables.length : this.zombies.length + (this.raid ? this.raid.squad : 0);
    var freeStart = item.kind === 'stove' ? 2 : item.kind === 'table' ? 3 : item.kind === 'decor' ? 0 : 1;
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
  // Plate a finished stove: send its batch to the serving counter (the "pass"),
  // from which zombie staff carry dishes to customers. This is the manual
  // "tap to serve" step from the original — call it when st.ready is true.
  World.prototype.plateStove = function (stoveId) {
    var st = typeof stoveId === 'object' ? stoveId : byId(this.stoves, stoveId);
    if (!st || !st.recipe || !st.ready) return false;
    var r = RECIPES[st.recipe], added = 0;
    for (var i = 0; i < r.batch && this.ready.length < POOL_CAP; i++) { this.ready.push(r.id); added++; }
    this.events.push({ type: 'plated', x: st.x, y: st.y, emoji: r.emoji, n: added });
    st.recipe = null; st.start = 0; st.ready = false; st.readyAt = 0;
    return true;
  };
  World.prototype.collectCustomer = function (cid) {
    var c = byId(this.customers, cid); if (!c || c.state !== 'paying') return false;
    this.coins += c.pay; this.served++; this._gainXp(c.xp);
    this.events.push({ type: 'coin', x: c.x, y: c.y, amount: c.pay, xp: c.xp });
    this._leave(c, true); return true;
  };
  World.prototype.infect = function (cid) {
    var c = byId(this.customers, cid);
    if (!c || !c.infectable || (c.state !== 'waiting' && c.state !== 'paying')) return false;
    if (this.toxin < INFECT_COST) { this.events.push({ type: 'warn', msg: 'Need ' + INFECT_COST + ' toxin to infect' }); return false; }
    this.toxin -= INFECT_COST;
    // a rare/infectable customer has a better shot at a rare zombie
    var z = this._mkZombie(this.zombies.length, rollRarity(0.15)); z.x = c.x; z.y = c.y; z.state = 'returning'; z.tx = z.hx; z.ty = z.hy;
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
    if (it.kind === 'stove' && this.freeStoveSlot() < 0) { this.events.push({ type: 'warn', msg: 'Kitchen is full' }); return false; }
    if ((it.kind === 'table' || it.kind === 'decor') && this.firstFreeCell() < 0) { this.events.push({ type: 'warn', msg: 'No floor space — sell or rearrange' }); return false; }
    if (bag === 'coin') this.coins -= cost; else this.toxin -= cost;
    if (it.kind === 'stove') this.stoves.push(this._mkStove(this.freeStoveSlot()));
    else if (it.kind === 'table') this.tables.push(this._mkTable(this.firstFreeCell()));
    else if (it.kind === 'zombie') this.zombies.push(this._mkZombie(this.zombies.length));
    else if (it.kind === 'decor') this.decors.push(this._mkDecor(it.id, this.firstFreeCell()));
    this.events.push({ type: 'bought', item: it });
    return true;
  };

  // ---- build mode: move / sell furniture -----------------------------
  World.prototype.moveTable = function (id, cell) { var t = byId(this.tables, id); if (!t || !this.cellFree(cell, id)) return false; t.cell = cell; t.x = CELLS[cell].x; t.y = CELLS[cell].y; return true; };
  World.prototype.moveDecor = function (id, cell) { var d = byId(this.decors, id); if (!d || !this.cellFree(cell, id)) return false; d.cell = cell; d.x = CELLS[cell].x; d.y = CELLS[cell].y; return true; };
  World.prototype.moveStove = function (id, slot) { var s = byId(this.stoves, id); for (var i = 0; i < this.stoves.length; i++) if (this.stoves[i].slot === slot && this.stoves[i].id !== id) return false; if (!s) return false; s.slot = slot; s.x = STOVE_SLOTS[slot].x; s.y = STOVE_SLOTS[slot].y; return true; };
  World.prototype.cellAt = function (x, y) {
    var best = -1, bd = 80;
    for (var i = 0; i < CELLS.length; i++) { var d = Math.hypot(x - CELLS[i].x, y - CELLS[i].y); if (d < bd) { bd = d; best = i; } }
    return best;
  };
  World.prototype.stoveSlotAt = function (x, y) {
    var best = -1, bd = 70;
    for (var i = 0; i < STOVE_SLOTS.length; i++) { var d = Math.hypot(x - STOVE_SLOTS[i].x, y - STOVE_SLOTS[i].y); if (d < bd) { bd = d; best = i; } }
    return best;
  };

  // ---- zombie management ---------------------------------------------
  World.prototype.setZombieRole = function (zid, role) { var z = byId(this.zombies, zid); if (!z) return false; z.role = role; if (role !== 'rest' && z.state === 'resting' && z.energy >= TIRED) z.state = 'idle'; return true; };
  World.prototype.feedZombie = function (zid) {
    var z = byId(this.zombies, zid); if (!z) return false;
    if (z.energy >= 99) { this.events.push({ type: 'warn', msg: z.name + ' is already full of energy' }); return false; }
    if (this.toxin < 1) { this.events.push({ type: 'warn', msg: 'Need 1 toxin to feed a zombie' }); return false; }
    this.toxin -= 1; z.energy = 100; if (z.state === 'resting') z.state = 'idle';
    this.events.push({ type: 'fed', x: z.x, y: z.y }); return true;
  };
  World.prototype.pickZombieAt = function (x, y) {
    var best = null, bd = 60;
    for (var i = 0; i < this.zombies.length; i++) { var z = this.zombies[i], d = dist(x, y, z.x, z.y - 30); if (d < bd) { bd = d; best = z; } }
    return best;
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
    var gotRecipe = null;
    if (win) {
      this._gainXp(Math.round(rv.defense));
      this.extraRecipes = this.extraRecipes || [];
      if (rv.recipe && this.level < (RECIPES[rv.recipe] || {}).level && this.extraRecipes.indexOf(rv.recipe) < 0) {
        this.extraRecipes.push(rv.recipe); gotRecipe = RECIPES[rv.recipe];
      }
    }
    for (var i = 0; i < squad; i++) this.zombies.push(this._mkZombie(this.zombies.length));
    this.events.push({ type: 'raidEnd', rival: rv, win: win, loot: loot, toxin: win ? (rv.toxin || 0) : 0, recipe: gotRecipe });
    this.raid = null;
  };

  // ---- simulation -----------------------------------------------------
  World.prototype.tick = function (dt) {
    if (dt > 0.25) dt = 0.25;                          // clamp big frame gaps
    this.t += dt;
    this._spawn();
    for (var i = 0; i < this.stoves.length; i++) {
      var st = this.stoves[i];
      if (st.recipe && !st.ready && this.t >= st.start + RECIPES[st.recipe].time) { st.ready = true; st.readyAt = this.t; }
      // faithful to the original you tap to serve; auto-plate only as an idle
      // safety net so an unattended stove eventually frees up.
      if (st.ready && this.t - (st.readyAt || this.t) >= STOVE_AUTOPLATE) this.plateStove(st.id);
    }
    this._stepZombies(dt);
    this._stepCustomers(dt);
    if (this.raid && this.t >= this.raid.returnsAt) this._resolveRaid();
  };

  World.prototype._spawn = function () {
    if (this.t < this.spawnAt) return;
    this.spawnAt = this.t + this.spawnEvery() * (0.65 + Math.random() * 0.7);
    var free = this.tables.filter(function (tb) { return !tb.by && !tb.dirty; });
    if (!free.length) return;
    var tb = pick(free), c = {
      id: uid(), x: DOOR.x, y: DOOR.y, tx: tb.x, ty: tb.y + 20, table: tb.id,
      state: 'toTable', wait: 0, eat: 0, pay: 0, xp: 0, dish: null,
      assigned: null, infectable: Math.random() < INFECT_CHANCE,
      color: pick(COLORS), skin: pick(SKINS), hair: pick(HAIRS), face: 'U', step: Math.random() * 6,
    };
    tb.by = c.id; this.customers.push(c);
  };

  function moveTo(e, dt, spd) {
    spd = spd || SPEED;
    var dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy), s = spd * dt;
    if (d <= s || d === 0) { e.x = e.tx; e.y = e.ty; return true; }
    e.x += dx / d * s; e.y += dy / d * s;
    e.face = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'L' : 'R') : (dy < 0 ? 'U' : 'D');
    e.step += s * 0.05;
    return false;
  }
  function zspeed(z) { return SPEED * (z.speed || 1) * (0.55 + 0.45 * (z.energy || 0) / 100); }

  World.prototype._stepZombies = function (dt) {
    for (var i = 0; i < this.zombies.length; i++) {
      var z = this.zombies[i];
      var working = z.state === 'toPass' || z.state === 'toCustomer' || z.state === 'toClean' || z.state === 'cleaning';
      if (working) z.energy = Math.max(0, z.energy - DRAIN * dt);
      else if (z.state === 'resting') z.energy = Math.min(100, z.energy + REGEN_REST * dt);
      else z.energy = Math.min(100, z.energy + REGEN_IDLE * dt);

      // finished cooks: cleaning is a timed (non-moving) task
      if (z.state === 'cleaning') {
        if (this.t - z.cleanStart >= CLEAN_TIME / (z.clean || 1)) {
          var ct = byId(this.tables, z.cleanId); if (ct) { ct.dirty = false; ct.cleaning = null; this.events.push({ type: 'cleaned', x: ct.x, y: ct.y }); }
          z.cleanId = null; z.state = 'returning'; z.tx = z.hx; z.ty = z.hy; this._gainXp(1);
        }
        continue;
      }
      if (z.state === 'idle') {
        if (z.role === 'rest' || z.energy < TIRED) { z.state = 'resting'; z.tx = z.hx; z.ty = z.hy; }
        else this._assign(z);
      }
      if (z.state === 'resting') {
        z.tx = z.hx; z.ty = z.hy; moveTo(z, dt, zspeed(z));
        if (z.role !== 'rest' && z.energy >= RESTED) z.state = 'idle';
        continue;
      }
      if (z.state === 'idle') { z.tx = z.hx; z.ty = z.hy; moveTo(z, dt, zspeed(z)); continue; }
      var arr = moveTo(z, dt, zspeed(z));
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
      } else if (z.state === 'toClean') {
        var dt2 = byId(this.tables, z.cleanId);
        if (dt2 && dt2.dirty) { z.state = 'cleaning'; z.cleanStart = this.t; }
        else { if (dt2) dt2.cleaning = null; z.cleanId = null; z.state = 'returning'; z.tx = z.hx; z.ty = z.hy; }
      } else if (z.state === 'returning') { z.state = 'idle'; }
    }
  };
  // Assign an idle zombie a task, respecting its role. 'auto' serves first,
  // then buses dirty tables; 'waiter'/'cleaner' only do their job.
  World.prototype._assign = function (z) {
    var canServe = z.role === 'auto' || z.role === 'waiter';
    var canClean = z.role === 'auto' || z.role === 'cleaner';
    if (canServe && this.ready.length) {
      for (var i = 0; i < this.customers.length; i++) {
        var c = this.customers[i];
        if (c.state === 'waiting' && !c.assigned) {
          c.assigned = z.id; z.job = c.id; z.carry = this.ready.pop();
          z.state = 'toPass'; z.tx = PASS.x; z.ty = PASS.y + 22; return;
        }
      }
    }
    if (canClean) {
      for (var j = 0; j < this.tables.length; j++) {
        var tb = this.tables[j];
        if (tb.dirty && !tb.cleaning) { tb.cleaning = z.id; z.cleanId = tb.id; z.state = 'toClean'; z.tx = tb.x; z.ty = tb.y + 10; return; }
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
        if (this.t - c.payAt >= AUTO_PAY) { this.coins += c.pay; this.served++; this._gainXp(c.xp); this.events.push({ type: 'coin', x: c.x, y: c.y, amount: c.pay, xp: c.xp }); this._leave(c, true); }
      } else if (c.state === 'leaving') {
        if (arr) this.customers.splice(i, 1);
      }
    }
  };
  World.prototype._freeTable = function (c) { var tb = byId(this.tables, c.table); if (tb && tb.by === c.id) tb.by = null; };
  // Leaving after eating leaves a dirty table a zombie must clean; an impatient
  // walk-out leaves the table clean.
  World.prototype._leave = function (c, ate) { var tb = byId(this.tables, c.table); if (tb && tb.by === c.id) { tb.by = null; if (ate) tb.dirty = true; } c.state = 'leaving'; c.assigned = null; c.tx = DOOR.x; c.ty = DOOR.y; };

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

  // build mode: nearest movable furniture to a point
  World.prototype.pickFurnitureAt = function (x, y) {
    var best = null, bd = 50;
    for (var i = 0; i < this.tables.length; i++) { var t = this.tables[i], d = dist(x, y, t.x, t.y); if (d < bd) { bd = d; best = { kind: 'table', id: t.id }; } }
    for (var j = 0; j < this.decors.length; j++) { var de = this.decors[j], dd = dist(x, y, de.x, de.y); if (dd < bd) { bd = dd; best = { kind: 'decor', id: de.id }; } }
    for (var k = 0; k < this.stoves.length; k++) { var s = this.stoves[k], ds = dist(x, y, s.x, s.y); if (ds < 55 && (!best || ds < bd)) { best = { kind: 'stove', id: s.id }; } }
    return best;
  };

  // expose constants the renderer needs
  World.W = W; World.H = H; World.PASS = PASS; World.DOOR = DOOR; World.STOVE_SLOTS = STOVE_SLOTS; World.CELLS = CELLS;
  World.TILE = TILE; World.COLS = COLS; World.ROWS = ROWS;
  window.createWorld = function (saved) { return new World(saved); };
  window.World = World;
})();
