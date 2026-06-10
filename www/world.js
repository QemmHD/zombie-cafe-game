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
  var COUNTER_CAP = 40;     // servings the pass can hold (Phase 4)
  var MAX_STOVES = 6, MAX_TABLES = 16;
  var INFECT_CHANCE = 0.16, INFECT_COST = 2;
  // food burn pipeline (Phase 4): once ready, food must be moved before it burns
  var BURN_GRACE = 22;      // seconds ready before a burn warning
  var BURN_HARD = 14;       // extra seconds of warning before it burns
  // zombie stamina + cleaning
  var DRAIN = 2.0, REGEN_IDLE = 3.0, REGEN_REST = 9.0;   // energy per second
  var TIRED = 14, RESTED = 55;                            // sleep below TIRED, wake at RESTED
  var DAYDREAM_E = 22, SCARE_E = 9;                       // low-energy hazard thresholds (Phase 7)
  var CLEAN_TIME = 3.5;                                   // base seconds to clear a table
  // rating / reputation (Phase 11): internal 0..100 score shown as 1..5 stars
  var REP_START = 55;
  var ZNAMES = ['Mort', 'Gnash', 'Rosa', 'Brundle', 'Patch', 'Drool', 'Stitch', 'Cleaver', 'Mossy', 'Gore', 'Hazel', 'Bones', 'Pickle', 'Snot', 'Grim', 'Maggot', 'Vee', 'Crud'];
  function rollRarity(boost) { var r = Math.random() - (boost || 0); return r < 0.05 ? 'elite' : r < 0.3 ? 'rare' : 'common'; }
  // patience = how low energy can get before this zombie risks acting out;
  // higher patience tolerates more (elites are pricklier — a risk/reward).
  function statsFor(rar) { return rar === 'elite' ? { speed: 1.35, serve: 1.4, clean: 1.4, patience: 0.5 } : rar === 'rare' ? { speed: 1.15, serve: 1.2, clean: 1.2, patience: 0.75 } : { speed: 1, serve: 1, clean: 1, patience: 1 }; }

  var RECIPES = {}, RIVAL = {};
  (function () {
    (window.RECIPES || []).forEach(function (r) { RECIPES[r.id] = r; });
    (window.RIVALS || []).forEach(function (r) { RIVAL[r.id] = r; });
  })();
  function shopById(id) { var s = window.SHOP || []; for (var i = 0; i < s.length; i++) if (s[i].id === id) return s[i]; return null; }
  var CTYPES = window.CUSTOMER_TYPES || [];
  function typeOf(c) { var id = c && c.type; for (var i = 0; i < CTYPES.length; i++) if (CTYPES[i].id === id) return CTYPES[i]; return CTYPES[0] || { name: 'Civilian', pay: 1, tip: 0.1, patience: 1, infect: { toxin: 2 }, z: { role: 'Server', speed: 1, serve: 1, clean: 1, cook: 1, attack: 10, maxEnergy: 100, patience: 1, rarity: 'common', trait: '' } }; }

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
    this.ready = []; this.spawnAt = 1.2; this.raid = null; this.extraRecipes = []; this.auto = true;
    this.rep = REP_START; this.fridge = []; this.storage = []; this.extraSlots = 0;   // rep, raid-loot fridge, stored furniture, bonus staff slots
    this.cafeName = 'The Rotten Spoon';
    this.stoves = [ this._mkStove(0), this._mkStove(1) ];
    this.decors = [];
    this.tables = [ this._mkTable(0), this._mkTable(5), this._mkTable(2) ];
    this.customers = [];
    this.zombies = [ this._mkZombie(0) ];
  };
  World.prototype._mkStove  = function (slot) { var s = STOVE_SLOTS[slot]; return { id: uid(), slot: slot, x: s.x, y: s.y, recipe: null, start: 0, ready: false }; };
  World.prototype._mkTable  = function (cell) { var s = CELLS[cell]; return { id: uid(), cell: cell, x: s.x, y: s.y, by: null, reserved: null, dirty: false, cleaning: null }; };
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
    return { id: uid(), x: h.x, y: h.y, hx: h.x, hy: h.y, state: 'idle', tx: h.x, ty: h.y, fx: h.x, fy: h.y, path: [], carry: null, carryBatch: null, job: null, cleanId: null, stoveId: null, face: 'L', step: Math.random() * 6,
      name: pick(ZNAMES), kind: 'Server', rarity: rar, role: 'auto', energy: 100, maxEnergy: 100, speed: s.speed, serve: s.serve, clean: s.clean, cook: 1, attack: 10, patience: s.patience, dazeUntil: 0, stored: false, reanimateUntil: 0 }; };
  // Build a zombie from an infected customer's inherited profile (Phase 9).
  World.prototype._mkZombieFrom = function (ct) {
    var z = this._mkZombie(this.zombies.length, ct.z.rarity);
    z.kind = ct.z.role; z.speed = ct.z.speed; z.serve = ct.z.serve; z.clean = ct.z.clean;
    z.cook = ct.z.cook; z.attack = ct.z.attack; z.maxEnergy = ct.z.maxEnergy; z.energy = ct.z.maxEnergy;
    z.patience = ct.z.patience; z.trait = ct.z.trait; z.fromType = ct.name;
    return z;
  };

  // ---- save / load ----------------------------------------------------
  World.prototype.snapshot = function () {
    return {
      t: this.t, coins: this.coins, toxin: this.toxin, xp: this.xp, level: this.level,
      served: this.served, decor: this.decor, lastRecipe: this.lastRecipe, ready: this.ready,
      spawnAt: this.spawnAt, raid: this.raid, extraRecipes: this.extraRecipes, auto: this.auto,
      rep: this.rep, fridge: this.fridge, storage: this.storage, extraSlots: this.extraSlots, cafeName: this.cafeName,
      stoves: this.stoves, tables: this.tables, decors: this.decors, zombies: this.zombies, customers: this.customers,
    };
  };
  World.prototype._restore = function (s) {
    for (var k in s) this[k] = s[k];
    this.events = []; this.customers = this.customers || []; this.ready = this.ready || [];
    this.decor = this.decor || {}; this.decors = this.decors || []; this.fridge = this.fridge || []; this.storage = this.storage || [];
    if (this.auto == null) this.auto = true;
    if (this.rep == null) this.rep = REP_START;
    if (this.extraSlots == null) this.extraSlots = 0;
    if (!this.cafeName) this.cafeName = 'The Rotten Spoon';
    // forward-compat: ensure zombies + tables + customers have all fields
    var self = this;
    (this.zombies || []).forEach(function (z, i) { if (z.hx == null) { var h = home(i); z.hx = h.x; z.hy = h.y; } if (z.step == null) z.step = 0; if (!z.face) z.face = 'L'; if (!z.path) z.path = []; if (z.fx == null) { z.fx = z.tx; z.fy = z.ty; } if (z.patience == null) z.patience = 1; if (z.dazeUntil == null) z.dazeUntil = 0; if (z.stored == null) z.stored = false; if (z.maxEnergy == null) z.maxEnergy = 100; if (!z.kind) z.kind = 'Server'; if (z.cook == null) z.cook = 1; if (z.attack == null) z.attack = 10; if (z.reanimateUntil == null) z.reanimateUntil = 0; });
    (this.tables || []).forEach(function (tb) { if (tb.reserved === undefined) tb.reserved = null; });
    (this.customers || []).forEach(function (c) { if (!c.path) c.path = []; if (c.fx == null) { c.fx = c.tx; c.fy = c.ty; } if (!c.type) c.type = 'civilian'; });
  };

  // ---- rating / reputation (Phase 11) --------------------------------
  // rep is a 0..100 score; the HUD shows it as 1..5 stars. Good service nudges
  // it up, bad service down. Rating then feeds spawn rate & customer quality.
  World.prototype.ratingStars = function () { return Math.max(1, Math.min(5, 1 + this.rep / 25)); };  // 1.0 .. 5.0
  World.prototype._nudgeRep = function (delta, reason) {
    var before = this.rep; this.rep = Math.max(0, Math.min(100, this.rep + delta));
    if (Math.abs(this.rep - before) >= 0.01) this.events.push({ type: delta >= 0 ? 'ratingUp' : 'ratingDown', rep: this.rep, stars: this.ratingStars(), reason: reason });
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
  World.prototype.tipMult = function () { return 1 + this.ambiance() / 200 + this.rep / 400; };   // décor + reputation both tip
  World.prototype.patience = function () { return 20 + this.ambiance() / 8; };
  // Higher rating = more (and better) customers; a poor rating thins the crowd.
  World.prototype.spawnEvery = function () { var rf = 0.6 + (100 - this.rep) / 100; return Math.max(2.2, 6 / (1 + this.ambiance() / 50) * rf); };
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
    if (st.burned) { this.events.push({ type: 'warn', msg: 'Clear the burnt mess off this stove first' }); return false; }
    if (this.coins < r.cost) { this.events.push({ type: 'warn', msg: 'Not enough coins for ' + r.name }); return false; }
    this.coins -= r.cost; st.recipe = recipeId; st.start = this.t; st.ready = false; st.burning = false; st.readyAt = 0; this.lastRecipe = recipeId;
    this.events.push({ type: 'CookingStarted', x: st.x, y: st.y }); return true;
  };
  // Wipe burnt food off a stove so it can be used again (player tap or zombie).
  World.prototype.clearBurned = function (stoveId) {
    var st = byId(this.stoves, stoveId); if (!st || !st.burned) return false;
    st.recipe = null; st.burned = false; st.ready = false; st.readyAt = 0; st.burning = false;
    this.events.push({ type: 'cleaned', x: st.x, y: st.y }); return true;
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
    for (var i = 0; i < r.batch && this.ready.length < COUNTER_CAP; i++) { this.ready.push(r.id); added++; }
    this.events.push({ type: 'plated', x: st.x, y: st.y, emoji: r.emoji, n: added });
    st.recipe = null; st.start = 0; st.ready = false; st.readyAt = 0;
    return true;
  };
  World.prototype.collectCustomer = function (cid) {
    var c = byId(this.customers, cid); if (!c || c.state !== 'paying') return false;
    this._payAndLeave(c); return true;
  };
  // payment + mood-driven rating swing + happy/neutral/angry thought bubble
  World.prototype._payAndLeave = function (c) {
    this.coins += c.pay; this.served++; this._gainXp(c.xp);
    var mood = c.mood || 'neutral';
    this._nudgeRep(mood === 'happy' ? 1.4 : mood === 'angry' ? -1.2 : 0.2, 'a ' + mood + ' customer');
    this.events.push({ type: 'coin', x: c.x, y: c.y, amount: c.pay, xp: c.xp, mood: mood });
    this.events.push({ type: 'CustomerPaid', x: c.x, y: c.y, mood: mood });
    this._leave(c, true);
  };
  World.prototype.infectCost = function (c) { var t = typeOf(c); return (t && t.infect) || { toxin: INFECT_COST }; };
  World.prototype.infect = function (cid) {
    var c = byId(this.customers, cid);
    if (!c || !c.infectable || (c.state !== 'waiting' && c.state !== 'paying' && c.state !== 'queued')) return false;
    var ct = typeOf(c), cost = this.infectCost(c);
    if (this.toxin < (cost.toxin || 0)) { this.events.push({ type: 'warn', msg: 'Need ' + (cost.toxin || 0) + ' toxin to infect' }); return false; }
    if (this.coins < (cost.cash || 0)) { this.events.push({ type: 'warn', msg: 'Need ' + (cost.cash || 0) + ' coins to infect' }); return false; }
    this.toxin -= (cost.toxin || 0); this.coins -= (cost.cash || 0);
    var z = this._mkZombieFrom(ct); z.x = c.x; z.y = c.y; z.state = 'returning'; z.tx = z.hx; z.ty = z.hy; z.fx = z.hx; z.fy = z.hy;
    var wentActive = this._addZombie(z);
    this._gainXp((c.xp || 2) * 2);
    this.events.push({ type: 'CustomerInfected', x: c.x, y: c.y, zombie: z, stored: !wentActive });
    this._freeTable(c); var qi = this.queue ? this.queue.indexOf(c.id) : -1; if (qi >= 0) this.queue.splice(qi, 1);
    this.customers.splice(this.customers.indexOf(c), 1);
    return true;
  };
  // ---- fridge: raid-loot food (Phase 4) ------------------------------
  // Stolen batches land here. You can plate them onto the pass to serve, or —
  // if the recipe is new to you — unlock it (which consumes the batch).
  World.prototype.serveFromFridge = function (idx) {
    var b = this.fridge[idx]; if (!b) return false;
    var added = 0;
    while (b.servings > 0 && this.ready.length < COUNTER_CAP) { this.ready.push(b.recipeId); b.servings--; added++; }
    if (!added) { this.events.push({ type: 'warn', msg: 'The pass is full' }); return false; }
    if (b.servings <= 0) this.fridge.splice(idx, 1);
    this.events.push({ type: 'fridge', x: PASS.x, y: PASS.y, emoji: (RECIPES[b.recipeId] || {}).emoji || '🍽️', n: added });
    return true;
  };
  World.prototype.discardFridge = function (idx) { if (!this.fridge[idx]) return false; this.fridge.splice(idx, 1); return true; };
  World.prototype.unlockFromFridge = function (idx) {
    var b = this.fridge[idx]; if (!b) return false;
    var r = RECIPES[b.recipeId]; if (!r) return false;
    var known = r.level <= this.level || (this.extraRecipes || []).indexOf(b.recipeId) >= 0;
    if (known) { this.events.push({ type: 'warn', msg: 'You already know ' + r.name }); return false; }
    this.extraRecipes = this.extraRecipes || []; this.extraRecipes.push(b.recipeId);
    this.fridge.splice(idx, 1);                       // unlocking consumes the batch
    this.events.push({ type: 'recipeUnlocked', recipe: r });
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
    else if (it.kind === 'zombie') this._addZombie(this._mkZombie(this.zombies.length));
    else if (it.kind === 'decor') this.decors.push(this._mkDecor(it.id, this.firstFreeCell()));
    this.events.push({ type: 'bought', item: it });
    return true;
  };

  // ---- build mode: move / sell furniture -----------------------------
  World.prototype.moveTable = function (id, cell) { var t = byId(this.tables, id); if (!t || !this.cellFree(cell, id)) return false; t.cell = cell; t.x = CELLS[cell].x; t.y = CELLS[cell].y; return true; };
  World.prototype.moveDecor = function (id, cell) { var d = byId(this.decors, id); if (!d || !this.cellFree(cell, id)) return false; d.cell = cell; d.x = CELLS[cell].x; d.y = CELLS[cell].y; return true; };
  World.prototype.moveStove = function (id, slot) { var s = byId(this.stoves, id); for (var i = 0; i < this.stoves.length; i++) if (this.stoves[i].slot === slot && this.stoves[i].id !== id) return false; if (!s) return false; s.slot = slot; s.x = STOVE_SLOTS[slot].x; s.y = STOVE_SLOTS[slot].y; return true; };
  // ---- build mode: store (stash) or sell furniture (Phase 9/12) -------
  World.prototype._removeFurniture = function (kind, id) {
    if (kind === 'table') { var ti = this.tables.findIndex(function (t) { return t.id === id; }); if (ti < 0) return null; var tb = this.tables[ti]; if (tb.by || tb.reserved) { this.events.push({ type: 'warn', msg: 'Someone is using that table' }); return null; } this.tables.splice(ti, 1); return { kind: 'table' }; }
    if (kind === 'stove') { var si = this.stoves.findIndex(function (s) { return s.id === id; }); if (si < 0) return null; var st = this.stoves[si]; if (st.recipe) { this.events.push({ type: 'warn', msg: 'Finish or clear the stove first' }); return null; } this.stoves.splice(si, 1); return { kind: 'stove' }; }
    if (kind === 'decor') { var di = this.decors.findIndex(function (d) { return d.id === id; }); if (di < 0) return null; var deco = this.decors[di].deco; this.decors.splice(di, 1); return { kind: 'decor', deco: deco }; }
    return null;
  };
  World.prototype.storeFurniture = function (kind, id) {
    var rem = this._removeFurniture(kind, id); if (!rem) return false;
    this.storage.push(rem); this.events.push({ type: 'rosterChanged' }); return true;
  };
  World.prototype.sellFurniture = function (kind, id) {
    var ref = kind === 'decor' ? null : null;
    var item = kind === 'decor' ? null : null;
    // resolve sell value from the shop entry
    var shopId = kind === 'decor' ? (byId(this.decors, id) || {}).deco : kind;
    var entry = shopById(shopId), sell = (entry && entry.sell) || 0;
    var rem = this._removeFurniture(kind, id); if (!rem) return false;
    this.coins += sell; this.events.push({ type: 'sold', coins: sell }); return true;
  };
  World.prototype.placeFromStorage = function (idx) {
    var it = this.storage[idx]; if (!it) return false;
    if (it.kind === 'stove') { var slot = this.freeStoveSlot(); if (slot < 0) { this.events.push({ type: 'warn', msg: 'Kitchen is full' }); return false; } this.stoves.push(this._mkStove(slot)); }
    else { var cell = this.firstFreeCell(); if (cell < 0) { this.events.push({ type: 'warn', msg: 'No floor space' }); return false; }
      if (it.kind === 'table') this.tables.push(this._mkTable(cell)); else this.decors.push(this._mkDecor(it.deco, cell)); }
    this.storage.splice(idx, 1); this.events.push({ type: 'rosterChanged' }); return true;
  };
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
    this.toxin -= 1; z.energy = z.maxEnergy || 100; if (z.state === 'resting' && z.role !== 'rest') z.state = 'idle';
    this.events.push({ type: 'fed', x: z.x, y: z.y }); return true;
  };
  World.prototype.pickZombieAt = function (x, y) {
    var best = null, bd = 60;
    for (var i = 0; i < this.zombies.length; i++) { var z = this.zombies[i]; if (z.stored) continue; var d = dist(x, y, z.x, z.y - 30); if (d < bd) { bd = d; best = z; } }
    return best;
  };

  // ---- roster / Meat Locker (Phase 10) -------------------------------
  // Active staff work the floor; the rest wait in the Meat Locker. Slots grow
  // with level (and bought upgrades). New zombies overflow into storage.
  World.prototype.activeSlots = function () { return 3 + Math.floor((this.level - 1) / 2) + (this.extraSlots || 0); };
  World.prototype.activeZombies = function () { return this.zombies.filter(function (z) { return !z.stored; }); };
  World.prototype.storedZombies = function () { return this.zombies.filter(function (z) { return z.stored; }); };
  World.prototype._addZombie = function (z) {
    z.stored = this.activeZombies().length >= this.activeSlots();
    this.zombies.push(z);
    return !z.stored;                                  // true if it went active
  };
  World.prototype.storeZombie = function (id) {
    var z = byId(this.zombies, id); if (!z || z.stored) return false;
    this._releaseJob(z); z.stored = true; z.state = 'idle'; z.x = z.hx; z.y = z.hy; z.tx = z.hx; z.ty = z.hy; z.fx = z.hx; z.fy = z.hy;
    this.events.push({ type: 'rosterChanged' }); return true;
  };
  World.prototype.activateZombie = function (id) {
    var z = byId(this.zombies, id); if (!z || !z.stored) return false;
    if (z.reanimateUntil > this.t) { this.events.push({ type: 'warn', msg: z.name + ' is still reanimating' }); return false; }
    if (this.activeZombies().length >= this.activeSlots()) { this.events.push({ type: 'warn', msg: 'Active staff is full — store one first or expand slots' }); return false; }
    z.stored = false; z.state = 'idle'; z.x = z.hx; z.y = z.hy; z.energy = Math.max(z.energy, 20);
    this.events.push({ type: 'rosterChanged' }); return true;
  };
  World.prototype.restZombie = function (id) { var z = byId(this.zombies, id); if (!z) return false; this._releaseJob(z); z.role = 'rest'; z.state = 'resting'; routeTo(this, z, z.hx, z.hy); return true; };
  World.prototype.renameZombie = function (id, name) { var z = byId(this.zombies, id); if (!z || !name) return false; z.name = ('' + name).slice(0, 14); return true; };
  World.prototype.buySlot = function () {
    var cost = 4 + this.extraSlots * 2;
    if (this.toxin < cost) { this.events.push({ type: 'warn', msg: 'Need ' + cost + ' toxin for another staff slot' }); return false; }
    this.toxin -= cost; this.extraSlots = (this.extraSlots || 0) + 1; this.events.push({ type: 'rosterChanged' }); return true;
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
    var gotRecipe = null, fridgeFood = null;
    if (win) {
      this._gainXp(Math.round(rv.defense));
      // Food loot goes into the FRIDGE (Phase 4) — serve it, or unlock the
      // rival's signature recipe from there if it's new to you.
      if (rv.recipe) {
        var known = (RECIPES[rv.recipe] || {}).level <= this.level || (this.extraRecipes || []).indexOf(rv.recipe) >= 0;
        var batch = { recipeId: rv.recipe, servings: (RECIPES[rv.recipe] || {}).batch || 4, source: rv.name, canUnlock: !known };
        this.fridge.push(batch); fridgeFood = batch;
        if (!known) gotRecipe = RECIPES[rv.recipe];
      }
    }
    for (var i = 0; i < squad; i++) this._addZombie(this._mkZombie(this.zombies.length));
    this.events.push({ type: 'raidEnd', rival: rv, win: win, loot: loot, toxin: win ? (rv.toxin || 0) : 0, recipe: gotRecipe, food: fridgeFood });
    this.raid = null;
  };

  // ---- simulation -----------------------------------------------------
  World.prototype.tick = function (dt) {
    if (dt > 0.25) dt = 0.25;                          // clamp big frame gaps
    this.t += dt;
    this._spawn();
    // Stove FSM (Phase 4): cooking -> finished -> burnWarning -> burned.
    // Finished food MUST be carried off (by a commanded or auto zombie) before
    // it burns. Nothing teleports — burning is the cost of ignoring the pass.
    for (var i = 0; i < this.stoves.length; i++) {
      var st = this.stoves[i];
      if (!st.recipe || st.burned) continue;            // burnt food waits to be cleared, doesn't re-cook
      if (!st.ready && this.t >= st.start + (RECIPES[st.recipe].time)) { st.ready = true; st.readyAt = this.t; st.burning = false; this.events.push({ type: 'CookingFinished', x: st.x, y: st.y, emoji: RECIPES[st.recipe].emoji }); }
      if (st.ready && !st.burned) {
        var since = this.t - (st.readyAt || this.t), grace = RECIPES[st.recipe].burnGrace || BURN_GRACE;
        if (!st.burning && since >= grace) { st.burning = true; this.events.push({ type: 'FoodBurnWarning', x: st.x, y: st.y }); }
        if (st.burning && since >= grace + BURN_HARD && !st.collecting) {
          st.burned = true; st.ready = false; this.events.push({ type: 'FoodBurned', x: st.x, y: st.y });
          this._nudgeRep(-2.5, 'burned food');
        }
      }
    }
    this._seatQueued();
    this._stepZombies(dt);
    this._stepCustomers(dt);
    if (this.raid && this.t >= this.raid.returnsAt) this._resolveRaid();
  };

  World.prototype.maxCustomers = function () { return this.tables.length + 5; };   // seats + a short queue
  // weighted pick of a customer archetype, gated by level & rating (Phase 5)
  World.prototype._rollType = function () {
    var stars = this.ratingStars(), L = this.level, pool = [], total = 0, i;
    for (i = 0; i < CTYPES.length; i++) { var t = CTYPES[i]; if (L >= (t.levelReq || 1) && stars >= (t.ratingReq || 0)) { pool.push(t); total += t.weight; } }
    if (!pool.length) return CTYPES[0];
    var r = Math.random() * total;
    for (i = 0; i < pool.length; i++) { r -= pool[i].weight; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  };
  // is there a walking route from the door to this table's seat?
  World.prototype.reachableTable = function (tb) {
    var blocked = this._blockedTiles();
    var sc = Math.floor(DOOR.x / TILE), sr = Math.floor(DOOR.y / TILE);
    var tc = Math.floor(tb.x / TILE), tr = Math.floor(tb.y / TILE);
    var q = [[sc, sr]], seen = {}; seen[sc + ',' + sr] = 1; var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (q.length) {
      var cur = q.shift();
      for (var d = 0; d < 4; d++) {
        var nc = cur[0] + DIRS[d][0], nr = cur[1] + DIRS[d][1], k = nc + ',' + nr;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || seen[k]) continue;
        if (Math.abs(nc - tc) <= 0 && Math.abs(nr - tr) <= 0) return true;   // reached the table tile's neighbour chain
        if (blocked[k]) continue;
        seen[k] = 1; q.push([nc, nr]);
      }
    }
    return false;
  };
  // try to reserve a free, clean, reachable table for a customer
  World.prototype._trySeat = function (c) {
    for (var i = 0; i < this.tables.length; i++) {
      var tb = this.tables[i];
      if (tb.by || tb.reserved || tb.dirty || tb.cleaning) continue;
      if (!this.reachableTable(tb)) continue;
      tb.reserved = c.id; c.table = tb.id; c.state = 'toTable';
      routeTo(this, c, tb.x, tb.y + 20); return true;
    }
    return false;
  };
  // FIFO: seat anyone who's been queueing as soon as a table opens up
  World.prototype._seatQueued = function () {
    for (var i = 0; i < this.customers.length; i++) {
      var c = this.customers[i]; if (c.state !== 'queued') continue;
      this._trySeat(c);
    }
  };

  World.prototype._spawn = function () {
    if (this.t < this.spawnAt) return;
    this.spawnAt = this.t + this.spawnEvery() * (0.65 + Math.random() * 0.7);
    if (this.customers.length >= this.maxCustomers()) return;
    var ct = this._rollType();
    var qpos = this._queueSpot(this.customers.filter(function (c) { return c.state === 'queued'; }).length);
    var c = {
      id: uid(), x: DOOR.x, y: DOOR.y, tx: DOOR.x, ty: DOOR.y, fx: DOOR.x, fy: DOOR.y, path: [], table: null,
      state: 'queued', wait: this.t, eat: 0, pay: 0, xp: 0, dish: null, assigned: null,
      type: ct.id, rarity: ct.rarity, infectable: true,
      color: ct.shirt || pick(COLORS), skin: pick(SKINS), hair: pick(HAIRS), hat: ct.hat || null, face: 'U', step: Math.random() * 6,
    };
    this.customers.push(c);
    if (!this._trySeat(c)) routeTo(this, c, qpos.x, qpos.y);   // no seat: wait in line by the door
  };
  World.prototype._queueSpot = function (n) { return { x: DOOR.x - 120 + (n % 4) * 80, y: DOOR.y + 6 - Math.floor(n / 4) * 60 }; };

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

  // ---- grid pathfinding: BFS over tiles + line-of-sight smoothing -----
  // Tables and (blocking) decor occupy their tile; characters route around
  // them instead of clipping through. Endpoint tiles are always steppable so
  // seats beside tables stay reachable.
  function clampi(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function tkey(c, r) { return c + ',' + r; }
  World.prototype._blockedTiles = function () {
    var set = {}, i;
    for (i = 0; i < this.tables.length; i++) { var t = this.tables[i]; set[tkey(Math.floor(t.x / TILE), Math.floor(t.y / TILE))] = 1; }
    for (i = 0; i < this.decors.length; i++) {
      var d = this.decors[i], it = shopById(d.deco);
      if (it && it.blocks === false) continue;
      set[tkey(Math.floor(d.x / TILE), Math.floor(d.y / TILE))] = 1;
    }
    return set;
  };
  World.prototype._clearLine = function (blocked, x0, y0, x1, y1, allow) {
    var d = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.ceil(d / 30));
    for (var i = 1; i < steps; i++) {
      var x = x0 + (x1 - x0) * i / steps, y = y0 + (y1 - y0) * i / steps;
      var k = tkey(clampi(Math.floor(x / TILE), 0, COLS - 1), clampi(Math.floor(y / TILE), 0, ROWS - 1));
      if (blocked[k] && !allow[k]) return false;
    }
    return true;
  };
  World.prototype.findPath = function (x0, y0, x1, y1) {
    var blocked = this._blockedTiles();
    var sc = clampi(Math.floor(x0 / TILE), 0, COLS - 1), sr = clampi(Math.floor(y0 / TILE), 0, ROWS - 1);
    var tc = clampi(Math.floor(x1 / TILE), 0, COLS - 1), tr = clampi(Math.floor(y1 / TILE), 0, ROWS - 1);
    var allow = {}; allow[tkey(sc, sr)] = 1; allow[tkey(tc, tr)] = 1;
    if (this._clearLine(blocked, x0, y0, x1, y1, allow)) return [{ x: x1, y: y1 }];
    var q = [[sc, sr]], prev = {}, seen = {}; seen[tkey(sc, sr)] = 1;
    var found = false, DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (q.length) {
      var cur = q.shift();
      if (cur[0] === tc && cur[1] === tr) { found = true; break; }
      for (var i = 0; i < 4; i++) {
        var nc = cur[0] + DIRS[i][0], nr = cur[1] + DIRS[i][1], k = tkey(nc, nr);
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || seen[k]) continue;
        if (blocked[k] && !allow[k]) continue;
        seen[k] = 1; prev[k] = cur; q.push([nc, nr]);
      }
    }
    if (!found) return [{ x: x1, y: y1 }];                 // fallback: walk straight
    var tiles = [], at = [tc, tr];
    while (at && !(at[0] === sc && at[1] === sr)) { tiles.unshift(at); at = prev[tkey(at[0], at[1])]; }
    var pts = tiles.map(function (t) { return { x: t[0] * TILE + TILE / 2, y: t[1] * TILE + TILE / 2 }; });
    if (pts.length) pts[pts.length - 1] = { x: x1, y: y1 }; else pts = [{ x: x1, y: y1 }];
    // greedy smoothing: skip waypoints we can see past
    var out = [], cx = x0, cy = y0, i2 = 0;
    while (i2 < pts.length) {
      var j = pts.length - 1;
      while (j > i2 && !this._clearLine(blocked, cx, cy, pts[j].x, pts[j].y, allow)) j--;
      out.push(pts[j]); cx = pts[j].x; cy = pts[j].y; i2 = j + 1;
    }
    return out;
  };
  function routeTo(world, e, x, y) {
    e.fx = x; e.fy = y;
    e.path = world.findPath(e.x, e.y, x, y);
    var n = e.path.shift();
    e.tx = n.x; e.ty = n.y;
  }
  // advance along the routed path; true when the final point is reached
  function step(world, e, dt, spd) {
    if (!moveTo(e, dt, spd)) return false;
    if (e.path && e.path.length) { var n = e.path.shift(); e.tx = n.x; e.ty = n.y; return false; }
    return true;
  }
  // Build validation (Phase 12): flag tables a customer can no longer walk to,
  // or a door whose front is walled off. Returns human-readable problems.
  World.prototype.layoutWarnings = function () {
    var out = [], i;
    for (i = 0; i < this.tables.length; i++) if (!this.reachableTable(this.tables[i])) out.push('A table is blocked off — customers can\'t reach it.');
    // door reachable to at least one table?
    var blocked = this._blockedTiles(), dc = Math.floor(DOOR.x / TILE), dr = Math.floor(DOOR.y / TILE);
    if (blocked[dc + ',' + dr]) out.push('The entrance is blocked!');
    // de-dupe
    return out.filter(function (m, k) { return out.indexOf(m) === k; });
  };
  // after the layout changes (build mode), re-route everyone mid-walk
  World.prototype.repathAll = function () {
    var self = this;
    function rp(e) { if (e.fx != null && (e.x !== e.fx || e.y !== e.fy)) routeTo(self, e, e.fx, e.fy); }
    this.zombies.forEach(rp); this.customers.forEach(rp);
  };

  World.prototype._stepZombies = function (dt) {
    for (var i = 0; i < this.zombies.length; i++) {
      var z = this.zombies[i];
      if (z.stored) continue;                          // in the Meat Locker, off the floor
      if (z.reanimateUntil > this.t) { z.energy = Math.min(z.maxEnergy || 100, z.energy + REGEN_REST * dt); continue; }
      var working = z.state === 'toPass' || z.state === 'toCustomer' || z.state === 'toClean' || z.state === 'cleaning' || z.state === 'toStove' || z.state === 'toDeposit';
      var emax = z.maxEnergy || 100;
      if (working) z.energy = Math.max(0, z.energy - DRAIN * dt);
      else if (z.state === 'resting') z.energy = Math.min(emax, z.energy + REGEN_REST * dt);
      else if (z.state !== 'daydream') z.energy = Math.min(emax, z.energy + REGEN_IDLE * dt);

      // Low-energy hazards (Phase 7). A tired zombie may zone out; a critically
      // drained, impatient one may scare a diner off — costing you rating.
      if (z.state === 'daydream') {
        if (this.t >= z.dazeUntil) { z.state = 'idle'; }
        continue;
      }
      var idleish = (z.state === 'idle' || z.state === 'returning');
      if (z.energy <= SCARE_E && z.role !== 'rest' && Math.random() < (1.1 - z.patience) * 0.6 * dt) {
        var victim = this._nearestWaiting(z);
        if (victim) { this.events.push({ type: 'ZombieScaredCustomer', x: victim.x, y: victim.y, name: z.name }); this._nudgeRep(-3, 'a zombie scared a customer'); this._leave(victim, false); victim.scared = true; z.energy = Math.max(0, z.energy - 3); }
      } else if (z.energy <= DAYDREAM_E && idleish && Math.random() < 0.25 * dt) {
        z.state = 'daydream'; z.dazeUntil = this.t + 2 + Math.random() * 2;
        this.events.push({ type: 'ZombieDaydreaming', x: z.x, y: z.y, name: z.name });
        continue;
      }

      // cleaning is a timed (non-moving) task
      if (z.state === 'cleaning') {
        if (this.t - z.cleanStart >= CLEAN_TIME / (z.clean || 1)) {
          var ct = byId(this.tables, z.cleanId); if (ct) { ct.dirty = false; ct.cleaning = null; this.events.push({ type: 'cleaned', x: ct.x, y: ct.y }); }
          z.cleanId = null; z.state = 'returning'; routeTo(this, z, z.hx, z.hy); this._gainXp(1);
        }
        continue;
      }
      if (z.state === 'idle') {
        if (z.role === 'rest' || z.energy < TIRED) { z.state = 'resting'; routeTo(this, z, z.hx, z.hy); }
        else if (this.auto) this._assign(z);
      }
      if (z.state === 'resting') {
        step(this, z, dt, zspeed(z));
        if (z.role !== 'rest' && z.energy >= RESTED) z.state = 'idle';
        continue;
      }
      if (z.state === 'idle') {
        if (z.fx !== z.hx || z.fy !== z.hy) routeTo(this, z, z.hx, z.hy);
        step(this, z, dt, zspeed(z)); continue;
      }
      var arr = step(this, z, dt, zspeed(z));
      if (!arr) continue;
      if (z.state === 'toPass') {
        var c = byId(this.customers, z.job);
        if (c && c.state === 'waiting') { z.state = 'toCustomer'; routeTo(this, z, c.x, c.y - 6); }
        else { this._releaseJob(z); z.state = 'returning'; routeTo(this, z, z.hx, z.hy); }
      } else if (z.state === 'toCustomer') {
        var cu = byId(this.customers, z.job);
        if (cu && cu.state === 'waiting') { cu.state = 'eating'; cu.eat = this.t; cu.dish = z.carry; cu.assigned = null; z.carry = null; z.job = null; }
        else this._releaseJob(z);
        z.state = 'returning'; routeTo(this, z, z.hx, z.hy);
      } else if (z.state === 'toClean') {
        var dt2 = byId(this.tables, z.cleanId);
        if (dt2 && dt2.dirty) { z.state = 'cleaning'; z.cleanStart = this.t; }
        else { if (dt2) dt2.cleaning = null; z.cleanId = null; z.state = 'returning'; routeTo(this, z, z.hx, z.hy); }
      } else if (z.state === 'toStove') {
        // commanded carry: pick the finished batch up, OR clear a burnt mess
        var sst = byId(this.stoves, z.stoveId);
        if (sst && sst.burned) {
          this.clearBurned(sst.id); sst.collecting = false;
          z.stoveId = null; z.state = 'returning'; routeTo(this, z, z.hx, z.hy);
        } else if (sst && sst.ready && sst.recipe) {
          var rr2 = RECIPES[sst.recipe];
          z.carryBatch = { id: sst.recipe, n: rr2.batch };
          sst.recipe = null; sst.start = 0; sst.ready = false; sst.readyAt = 0; sst.burning = false; sst.collecting = false;
          z.state = 'toDeposit'; routeTo(this, z, PASS.x, PASS.y + 22);
        } else { if (sst) sst.collecting = false; z.stoveId = null; z.state = 'returning'; routeTo(this, z, z.hx, z.hy); }
      } else if (z.state === 'toDeposit') {
        if (z.carryBatch) {
          var added = 0;
          for (var b = 0; b < z.carryBatch.n && this.ready.length < COUNTER_CAP; b++) { this.ready.push(z.carryBatch.id); added++; }
          this.events.push({ type: 'plated', x: PASS.x, y: PASS.y, emoji: (RECIPES[z.carryBatch.id] || {}).emoji || '🍽️', n: added });
          z.carryBatch = null;
        }
        z.stoveId = null; z.state = 'returning'; routeTo(this, z, z.hx, z.hy);
      } else if (z.state === 'returning') { z.state = 'idle'; }
    }
  };
  // drop whatever the zombie was committed to (job swap or abort)
  World.prototype._releaseJob = function (z) {
    if (z.job) { var c = byId(this.customers, z.job); if (c && c.assigned === z.id) c.assigned = null; z.job = null; }
    if (z.carry) { this.ready.push(z.carry); z.carry = null; }
    if (z.carryBatch) { for (var b = 0; b < z.carryBatch.n && this.ready.length < COUNTER_CAP; b++) this.ready.push(z.carryBatch.id); z.carryBatch = null; }
    if (z.cleanId) { var tb = byId(this.tables, z.cleanId); if (tb && tb.cleaning === z.id) tb.cleaning = null; z.cleanId = null; }
    if (z.stoveId) { var sv = byId(this.stoves, z.stoveId); if (sv && sv.collecting) sv.collecting = false; z.stoveId = null; }
  };
  World.prototype._nearestWaiting = function (z) {
    var best = null, bd = 1e9;
    for (var i = 0; i < this.customers.length; i++) { var c = this.customers[i]; if (c.state !== 'waiting' && c.state !== 'eating') continue; var d = dist(z.x, z.y, c.x, c.y); if (d < bd) { bd = d; best = c; } }
    return best;
  };
  // Auto-mode job priority (Phase 8): move finished food off the stove before
  // it burns -> serve the most impatient diner -> clear a burnt stove -> bus a
  // dirty table -> idle. 'waiter'/'cleaner' roles only do their own job.
  World.prototype._assign = function (z) {
    var canServe = z.role === 'auto' || z.role === 'waiter';
    var canClean = z.role === 'auto' || z.role === 'cleaner';
    var i;
    // 1. rescue finished food from the pass-blocking stoves
    if (canServe && this.ready.length < COUNTER_CAP) {
      for (i = 0; i < this.stoves.length; i++) {
        var fs = this.stoves[i];
        if (fs.ready && fs.recipe && !fs.collecting) { fs.collecting = true; z.stoveId = fs.id; z.state = 'toStove'; routeTo(this, z, fs.x, fs.y + 40); return; }
      }
    }
    // 2. serve the most impatient hungry customer we have food for
    if (canServe && this.ready.length) {
      var pickC = null, worst = -1;
      for (i = 0; i < this.customers.length; i++) {
        var c = this.customers[i];
        if (c.state === 'waiting' && !c.assigned) { var waited = this.t - c.wait; if (waited > worst) { worst = waited; pickC = c; } }
      }
      if (pickC) { pickC.assigned = z.id; z.job = pickC.id; z.carry = this.ready.pop(); z.state = 'toPass'; routeTo(this, z, PASS.x, PASS.y + 22); return; }
    }
    // 3. clear a burnt stove so it can cook again
    if (canServe) {
      for (i = 0; i < this.stoves.length; i++) { var bs = this.stoves[i]; if (bs.burned && !bs.collecting) { bs.collecting = true; z.stoveId = bs.id; z.state = 'toStove'; routeTo(this, z, bs.x, bs.y + 40); return; } }
    }
    // 4. bus a dirty table
    if (canClean) {
      for (var j = 0; j < this.tables.length; j++) {
        var tb = this.tables[j];
        if (tb.dirty && !tb.cleaning) { tb.cleaning = z.id; z.cleanId = tb.id; z.state = 'toClean'; routeTo(this, z, tb.x, tb.y + 10); return; }
      }
    }
  };

  // ---- manual tap-commands: tap zombie, then tap a target -------------
  // Returns { ok, msg } so the UI can confirm or flash an error.
  World.prototype.commandZombie = function (zid, hit) {
    var z = byId(this.zombies, zid); if (!z || !hit) return { ok: false, msg: '' };
    if (z.state === 'cleaning') return { ok: false, msg: z.name + ' is mid-scrub' };
    if (z.energy < TIRED && hit.kind !== 'rest') return { ok: false, msg: z.name + ' is exhausted — feed or let them rest' };
    if (hit.kind === 'stove') {
      var st = byId(this.stoves, hit.id); if (!st) return { ok: false, msg: '' };
      if (st.burned) { this._releaseJob(z); st.collecting = true; z.state = 'toStove'; z.stoveId = st.id; routeTo(this, z, st.x, st.y + 40); return { ok: true, msg: z.name + ' is scraping off the burnt food' }; }
      if (!st.ready) return { ok: false, msg: st.recipe ? 'Still cooking' : 'Nothing to pick up — start a cook first' };
      this._releaseJob(z);
      st.collecting = true; z.state = 'toStove'; z.stoveId = st.id; routeTo(this, z, st.x, st.y + 40);
      return { ok: true, msg: z.name + ' is collecting the food' };
    }
    if (hit.kind === 'customer') {
      var c = byId(this.customers, hit.id);
      if (!c || c.state !== 'waiting') return { ok: false, msg: 'They don\'t need service' };
      if (c.assigned) return { ok: false, msg: 'Someone is already serving them' };
      if (!this.ready.length) return { ok: false, msg: 'No food on the pass — cook & collect first' };
      this._releaseJob(z);
      c.assigned = z.id; z.job = c.id; z.carry = this.ready.pop();
      z.state = 'toPass'; routeTo(this, z, PASS.x, PASS.y + 22);
      return { ok: true, msg: z.name + ' is serving them' };
    }
    if (hit.kind === 'table') {
      var tb = byId(this.tables, hit.id);
      if (!tb || !tb.dirty) return { ok: false, msg: 'That table doesn\'t need cleaning' };
      if (tb.cleaning) return { ok: false, msg: 'Already being cleaned' };
      this._releaseJob(z);
      tb.cleaning = z.id; z.cleanId = tb.id; z.state = 'toClean'; routeTo(this, z, tb.x, tb.y + 10);
      return { ok: true, msg: z.name + ' is bussing that table' };
    }
    if (hit.kind === 'rest') {
      this._releaseJob(z); z.state = 'resting'; routeTo(this, z, z.hx, z.hy);
      return { ok: true, msg: z.name + ' is taking a break' };
    }
    return { ok: false, msg: '' };
  };
  // anything tappable as a command target near a point
  World.prototype.pickTargetAt = function (x, y) {
    var i;
    for (i = 0; i < this.customers.length; i++) {
      var c = this.customers[i];
      if (c.state !== 'waiting' && c.state !== 'paying') continue;
      if (dist(x, y, c.x, c.y - 16) < 46) return { kind: 'customer', id: c.id, state: c.state, infectable: c.infectable };
    }
    for (i = 0; i < this.stoves.length; i++) { var s = this.stoves[i]; if (dist(x, y, s.x, s.y) < 55) return { kind: 'stove', id: s.id, ready: s.ready, cooking: !!s.recipe, burned: !!s.burned }; }
    for (i = 0; i < this.tables.length; i++) { var tb = this.tables[i]; if (tb.dirty && dist(x, y, tb.x, tb.y) < 55) return { kind: 'table', id: tb.id }; }
    return null;
  };

  World.prototype.custPatience = function (c) { return this.patience() * (typeOf(c).patience || 1); };
  World.prototype._stepCustomers = function (dt) {
    for (var i = this.customers.length - 1; i >= 0; i--) {
      var c = this.customers[i], arr = step(this, c, dt, SPEED);
      if (c.state === 'queued') {
        // no seat yet: wait in line by the door; patience still drains
        c.face = 'U';
        var qw = this.t - c.wait, qpat = this.custPatience(c) * 1.2;
        c.annoyed = qw > qpat * 0.6;
        if (qw > qpat) { this._nudgeRep(-1.5, 'no free table'); this.events.push({ type: 'CustomerLeftAngry', x: c.x, y: c.y, reason: 'noseat' }); this._leave(c); }
      } else if (c.state === 'toTable') {
        if (arr) {
          var tb0 = byId(this.tables, c.table);
          if (tb0) { tb0.by = c.id; tb0.reserved = null; }
          c.state = 'waiting'; c.wait = this.t; c.face = 'U';
          this.events.push({ type: 'CustomerSeated', x: c.x, y: c.y });
        }
      } else if (c.state === 'waiting') {
        // patience drains while waiting for food; the longer they wait the worse
        // their mood (and tip) when finally served.
        var waited = this.t - c.wait, pat = this.custPatience(c);
        c.annoyed = waited > pat * 0.6;
        if (!c.assigned && waited > pat) { this._nudgeRep(-2, 'customer left hungry'); this.events.push({ type: 'CustomerLeftAngry', x: c.x, y: c.y }); this._leave(c); }
      } else if (c.state === 'eating') {
        if (c.serveWait == null) { c.serveWait = this.t - c.wait; }   // captured at service
        if (this.t - c.eat >= EAT_TIME) {
          var r = (RECIPES[c.dish] || RECIPES.coffee), ct = typeOf(c);
          var ratio = c.serveWait / this.custPatience(c);
          c.mood = ratio < 0.45 ? 'happy' : ratio < 0.85 ? 'neutral' : 'angry';
          var mult = (c.mood === 'happy' ? 1.15 : c.mood === 'angry' ? 0.7 : 1) * (ct.pay || 1);
          var tip = Math.random() < (ct.tip || 0) ? 1.25 : 1;          // some customers tip
          c.tipped = tip > 1;
          c.state = 'paying'; c.pay = Math.max(1, Math.round(r.price * this.tipMult() * mult * tip));
          c.xp = r.xp; c.payAt = this.t;
        }
      } else if (c.state === 'paying') {
        if (this.t - c.payAt >= AUTO_PAY) { this._payAndLeave(c); }
      } else if (c.state === 'leaving') {
        if (arr) this.customers.splice(i, 1);
      }
    }
  };
  World.prototype._freeTable = function (c) { var tb = byId(this.tables, c.table); if (tb) { if (tb.by === c.id) tb.by = null; if (tb.reserved === c.id) tb.reserved = null; } };
  // Leaving after eating leaves a dirty table a zombie must clean; an impatient
  // walk-out frees the (still-clean) table and lets the next person sit.
  World.prototype._leave = function (c, ate) {
    var tb = byId(this.tables, c.table);
    if (tb) { if (tb.by === c.id) { tb.by = null; if (ate) tb.dirty = true; } if (tb.reserved === c.id) tb.reserved = null; }
    c.state = 'leaving'; c.assigned = null; routeTo(this, c, DOOR.x, DOOR.y);
  };
  // table state enum (Phase 6) for UI / tests
  World.prototype.tableState = function (tb) {
    if (tb.cleaning) return 'beingCleaned';
    if (tb.dirty) return 'dirty';
    if (!this.reachableTable(tb)) return 'unreachable';
    if (tb.by) { var c = byId(this.customers, tb.by); if (c) { if (c.state === 'eating') return 'eating'; if (c.state === 'paying') return 'finished'; if (c.assigned || c.state === 'waiting') return 'occupiedWaiting'; } return 'occupiedServed'; }
    if (tb.reserved) return 'reserved';
    return 'cleanEmpty';
  };

  function byId(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }

  // hit-testing helper for the renderer: nearest tappable entity to a point
  World.prototype.pickAt = function (x, y) {
    var best = null, bd = 46, SEATED = { queued: 1, waiting: 1, eating: 1, paying: 1 };
    for (var i = 0; i < this.customers.length; i++) {
      var c = this.customers[i]; if (!SEATED[c.state]) continue;
      var d = dist(x, y, c.x, c.y - 16); if (d < bd) { bd = d; best = { kind: 'customer', id: c.id, paying: c.state === 'paying', infectable: c.infectable }; }
    }
    if (best && best.paying) return best;                 // prefer paying
    for (var j = 0; j < this.stoves.length; j++) {
      var s = this.stoves[j], dd = dist(x, y, s.x, s.y); if (dd < 52) { var sd = best ? bd : 999; if (dd < sd) return { kind: 'stove', id: s.id, ready: s.ready, burned: s.burned, recipe: s.recipe }; }
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
