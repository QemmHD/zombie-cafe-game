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
  // projects it into an isometric view. COLS x ROWS tiles of size TILE —
  // the BASE size; buying expansions grows the floor into the grass lot
  // (the original's expansion system: each step +1 column +1 row).
  var TILE = 120, COLS = 7, ROWS = 8, MAX_EXP = 4;
  var W = COLS * TILE, H = ROWS * TILE;     // base 840 x 960 plane
  var SPEED = 150;          // plane-units / second walking speed
  var EAT_TIME = 5;
  var AUTO_PAY = 12;        // auto-collect a paying customer after this long
  var COUNTER_CAP = 40;     // servings the pass can hold (Phase 4)
  var MAX_STOVES = 6, MAX_TABLES = 16;
  var INFECT_CHANCE = 0.16, INFECT_COST = 2;
  // food burn pipeline (Phase 4): once ready, food must be moved before it
  // burns. Faithful rule: the grace window is PROPORTIONAL to the cook time
  // (a dish survives roughly one extra cook-time on the stove, i.e. it's gone
  // by ~2x its cook time) — quick dishes are fragile, slow dishes forgiving.
  var BURN_WARN_F = 0.6;    // fraction of the grace window before the warning
  var BURN_MIN = 8;         // floor (seconds) so ultra-fast dishes aren't instant
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

  // ---- layout: everything aligned to TILE CENTERS (square grid) -------
  // Kitchen appliances line the back wall on row 0 (slot = a tile center).
  var STOVE_SLOTS = [ {x:60,y:60}, {x:180,y:60}, {x:300,y:60}, {x:540,y:60}, {x:660,y:60}, {x:780,y:60},
                      {x:900,y:60}, {x:1020,y:60}, {x:1140,y:60}, {x:1260,y:60} ];   // cols 7-10 open with expansions
  // The dining floor: cols 1-5 x rows 2-6 of exact tile centers. Tables AND
  // decor occupy cells (decorating trades off seating); col 0/6 stay as aisles.
  var CELLS = (function () {
    var out = [], c, r;
    for (r = 2; r <= 6; r++) for (c = 1; c <= 5; c++) out.push({ x: c * TILE + 60, y: r * TILE + 60 });
    // expansion bands appended in tier order (so saved cell indexes never
    // shift): tier e opens column 5+e and row 6+e of dining floor
    for (var e = 1; e <= MAX_EXP; e++) {
      var C2 = 5 + e, R2 = 6 + e;
      for (r = 2; r <= R2 - 1; r++) out.push({ x: C2 * TILE + 60, y: r * TILE + 60 });
      for (c = 1; c <= C2; c++) out.push({ x: c * TILE + 60, y: R2 * TILE + 60 });
    }
    return out;
  })();
  var TABLE_SLOTS = CELLS;
  // Serving counters are 1x1 each: ONE food stack per square (same dish piles
  // up with a count). Start with 2; buyable up to 4. PASS = the first counter.
  var PASS = { x: 420, y: 180 };
  var PASS_SPOTS = [ { x: 420, y: 180 }, { x: 540, y: 180 }, { x: 300, y: 180 }, { x: 660, y: 180 } ];
  // Entrance: a doorway in the LEFT wall (plane x≈0), down toward the dining
  // area (kitchen runs along the top). Customers spawn/leave just inside it.
  var DOOR = { x: 60, y: 600 };
  // idle staff wait along the LEFT wall (col 0), clear of the serving
  // counters (row 1, cols 2-5), the dining cells and the door row
  var HOME_YS = [180, 290, 400, 510, 760, 870];
  function home(i) { return { x: 64 + Math.floor(i / HOME_YS.length) * 38, y: HOME_YS[i % HOME_YS.length] }; }

  // =====================================================================
  function World(saved) { this.events = []; saved ? this._restore(saved) : this._fresh(); }

  World.prototype._fresh = function () {
    this.t = 0; this.coins = 60; this.toxin = 2; this.xp = 0; this.level = 1;
    this.served = 0; this.decor = {}; this.lastRecipe = 'coffee';
    this.ready = []; this.spawnAt = 1.2; this.raid = null; this.battle = null; this.extraRecipes = []; this.auto = true; this.review = null; this.expansion = 0;
    this.rep = REP_START; this.fridge = []; this.storage = []; this.extraSlots = 0; this.passUnits = 2;   // rep, raid-loot fridge, stored furniture, bonus staff slots
    this.cafeName = 'The Rotten Spoon';
    this.stoves = [ this._mkStove(0), this._mkStove(1) ];
    this.decors = [];
    this.tables = [ this._mkTable(0), this._mkTable(2), this._mkTable(4) ];   // row 2, spaced — each keeps its south chair square open
    this.chairs = [];
    this.customers = [];
    this.zombies = [ this._mkZombie(0) ];
    this._syncChairs();
  };
  // ---- chairs as first-class, reservable seat entities (4.6B) ---------
  // Each table is linked to one chair (the seat at its front edge). Chairs are
  // authoritative: a customer reserves then occupies a specific chair, never
  // just a table. Dirty/unreachable tables block their chairs.
  // A chair ATTACHES to its table across a small gap on the ADJACENT SOUTH
  // square (its own tile, like the reference): the diner walks onto that square
  // and sits facing the table. Tables may pack side-by-side as long as this
  // chair square stays free — that's the "one open side per table" rule.
  World.prototype._mkChair = function (tb) {
    return { id: uid(), table: tb.id, side: 'S', facing: 'U',
      c: Math.floor(tb.x / TILE), r: Math.floor(tb.y / TILE) + 1,   // the square SOUTH of the table
      x: tb.x, y: tb.y + 88,                    // sit point: on that square, gap from the table edge
      plateX: tb.x, plateY: tb.y - 4,           // plate stays on the tabletop
      by: null, reserved: null };
  };
  World.prototype.chairSitPoint = function (ch) { return { x: ch.x, y: ch.y }; };
  World.prototype.tableServePoint = function (tb) { return this._freeTileNear(tb.x, tb.y, '_', tb.x, tb.y + 40); };
  World.prototype.tableCleanPoint = function (tb) { return this._freeTileNear(tb.x, tb.y, '_', tb.x, tb.y + 40); };
  World.prototype._syncChairs = function () {
    this.chairs = this.chairs || []; var self = this, tids = {};
    this.tables.forEach(function (tb) { tids[tb.id] = tb; });
    // drop chairs whose table is gone
    this.chairs = this.chairs.filter(function (ch) { return tids[ch.table]; });
    // keep the chair on the adjacent SOUTH square of its (possibly moved) table
    this.chairs.forEach(function (ch) { var tb = tids[ch.table]; ch.c = Math.floor(tb.x / TILE); ch.r = Math.floor(tb.y / TILE) + 1; ch.x = tb.x; ch.y = tb.y + 88; });
    // ensure each table that should have a chair has exactly one
    this.tables.forEach(function (tb) {
      if (tb.noChair) return;
      if (!self.chairs.some(function (ch) { return ch.table === tb.id; })) self.chairs.push(self._mkChair(tb));
    });
  };
  World.prototype.chairsOf = function (tableId) { return this.chairs.filter(function (ch) { return ch.table === tableId; }); };
  World.prototype.chairState = function (ch) {
    var tb = byId(this.tables, ch.table);
    if (!tb) return 'invalidNoTable';
    if (tb.dirty || tb.cleaning) return 'blocked';
    // the chair square itself must stay free for the chair to CONNECT — tables
    // may pack side-by-side only while one side remains open for the seat
    if (this._blockedTiles()[ch.c + ',' + ch.r]) return 'blocked';
    if (!this.inBounds(ch.c, ch.r)) return 'blocked';
    if (!this.reachableTable(tb)) return 'unreachable';
    if (ch.by) return 'occupied';
    if (ch.reserved) return 'reserved';
    return 'empty';
  };
  World.prototype.addChair = function (tableId) { var tb = byId(this.tables, tableId); if (!tb) return false; tb.noChair = false; if (!this.chairsOf(tableId).length) this.chairs.push(this._mkChair(tb)); return true; };
  World.prototype.removeChair = function (tableId) { var tb = byId(this.tables, tableId); if (!tb) return false; this.chairs = this.chairs.filter(function (ch) { return ch.table !== tableId; }); tb.noChair = true; return true; };
  World.prototype.seatCount = function () { var self = this; return this.chairs.filter(function (ch) { var s = self.chairState(ch); return s !== 'invalidNoTable'; }).length; };
  World.prototype._mkStove  = function (slot) { var s = STOVE_SLOTS[slot]; return { id: uid(), slot: slot, x: s.x, y: s.y, recipe: null, start: 0, ready: false }; };
  World.prototype._mkTable  = function (cell) { var s = CELLS[cell]; return { id: uid(), cell: cell, x: s.x, y: s.y, by: null, reserved: null, dirty: false, cleaning: null }; };
  World.prototype._mkDecor  = function (deco, cell) { var s = CELLS[cell]; return { id: uid(), deco: deco, cell: cell, x: s.x, y: s.y }; };

  // ---- grid helpers (build / placement) ------------------------------
  // a dining cell is usable only if the café has expanded far enough
  World.prototype.cellUsable = function (cell) {
    var s = CELLS[cell]; if (!s) return false;
    var c = Math.floor(s.x / TILE), r = Math.floor(s.y / TILE);
    return c <= 5 + (this.expansion || 0) && r <= 6 + (this.expansion || 0);
  };
  World.prototype.cellFree = function (cell, exceptId) {
    if (!this.cellUsable(cell)) return false;
    for (var i = 0; i < this.tables.length; i++) if (this.tables[i].cell === cell && this.tables[i].id !== exceptId) return false;
    for (var j = 0; j < this.decors.length; j++) if (this.decors[j].cell === cell && this.decors[j].id !== exceptId) return false;
    return true;
  };
  // ---- café expansion (faithful ladder, scaled to our economy) --------
  // The original sold each +1col/+1row step for cash OR toxin:
  // 3.5k / 25k(10☣) / 75k(30☣) / 100k(40☣) / 120k(50☣) / 150k(50☣)...
  // Ours: 4 steps on the same shape, level-gated like the original (L7+).
  var EXPANSIONS = [
    { coin: 1500, level: 7 },
    { coin: 4000, toxin: 10, level: 9 },
    { coin: 9000, toxin: 30, level: 11 },
    { coin: 18000, toxin: 40, level: 13 },
  ];
  World.prototype.nextExpansion = function () { return EXPANSIONS[this.expansion || 0] || null; };
  World.prototype.expandCafe = function (useToxin) {
    var ex = this.nextExpansion();
    if (!ex) { this.events.push({ type: 'warn', msg: 'The café is already at its largest' }); return false; }
    if (this.level < ex.level) { this.events.push({ type: 'warn', msg: 'Expansion unlocks at level ' + ex.level }); return false; }
    if (useToxin) {
      if (!ex.toxin) { this.events.push({ type: 'warn', msg: 'This step is cash-only' }); return false; }
      if (this.toxin < ex.toxin) { this.events.push({ type: 'warn', msg: 'Need ' + ex.toxin + ' toxin' }); return false; }
      this.toxin -= ex.toxin;
    } else {
      if (this.coins < ex.coin) { this.events.push({ type: 'warn', msg: 'Need ' + ex.coin + ' coins' }); return false; }
      this.coins -= ex.coin;
    }
    this.expansion = (this.expansion || 0) + 1;
    this.events.push({ type: 'expanded', cols: this.colsNow(), rows: this.rowsNow() });
    return true;
  };
  World.prototype.firstFreeCell = function () { for (var i = 0; i < CELLS.length; i++) if (this.cellFree(i)) return i; return -1; };
  World.prototype.stoveSlotUsable = function (s) { var sp = STOVE_SLOTS[s]; return !!sp && Math.floor(sp.x / TILE) < this.colsNow(); };
  World.prototype.freeStoveSlot = function () {
    for (var s = 0; s < STOVE_SLOTS.length; s++) { if (!this.stoveSlotUsable(s)) continue; var used = false; for (var i = 0; i < this.stoves.length; i++) if (this.stoves[i].slot === s) used = true; if (!used) return s; } return -1;
  };
  World.prototype._mkZombie = function (i, rar) { var h = home(i); rar = rar || rollRarity(); var s = statsFor(rar);
    return { id: uid(), x: h.x, y: h.y, hx: h.x, hy: h.y, state: 'idle', tx: h.x, ty: h.y, fx: h.x, fy: h.y, path: [], carry: null, carryBatch: null, job: null, cleanId: null, stoveId: null, face: 'L', step: Math.random() * 6,
      name: pick(ZNAMES), kind: 'Server', rarity: rar, role: 'auto', energy: 100, maxEnergy: 100, speed: s.speed, serve: s.serve, clean: s.clean, cook: 1, attack: 10, patience: s.patience, dazeUntil: 0, stored: false, reanimateUntil: 0, zxp: 0, zlevel: 1 }; };
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
      rep: this.rep, fridge: this.fridge, storage: this.storage, extraSlots: this.extraSlots, passUnits: this.passUnits, cafeName: this.cafeName, review: this.review, expansion: this.expansion,
      stoves: this.stoves, tables: this.tables, chairs: this.chairs, decors: this.decors, zombies: this.zombies, customers: this.customers,
    };
  };
  World.prototype._restore = function (s) {
    for (var k in s) this[k] = s[k];
    this.events = []; this.customers = this.customers || []; this.ready = this.ready || [];
    this.decor = this.decor || {}; this.decors = this.decors || []; this.fridge = this.fridge || []; this.storage = this.storage || [];
    if (this.auto == null) this.auto = true;
    if (this.rep == null) this.rep = REP_START;
    if (this.extraSlots == null) this.extraSlots = 0;
    if (this.passUnits == null) this.passUnits = 2;
    if (!this.cafeName) this.cafeName = 'The Rotten Spoon';
    if (this.review === undefined) this.review = null;
    if (this.expansion == null) this.expansion = 0;
    // forward-compat: ensure zombies + tables + customers have all fields
    var self = this;
    (this.zombies || []).forEach(function (z, i) { if (z.hx == null) { var h = home(i); z.hx = h.x; z.hy = h.y; } if (z.step == null) z.step = 0; if (!z.face) z.face = 'L'; if (!z.path) z.path = []; if (z.fx == null) { z.fx = z.tx; z.fy = z.ty; } if (z.patience == null) z.patience = 1; if (z.dazeUntil == null) z.dazeUntil = 0; if (z.stored == null) z.stored = false; if (z.maxEnergy == null) z.maxEnergy = 100; if (!z.kind) z.kind = 'Server'; if (z.cook == null) z.cook = 1; if (z.attack == null) z.attack = 10; if (z.reanimateUntil == null) z.reanimateUntil = 0; if (z.zxp == null) { z.zxp = 0; z.zlevel = 1; } z.inBattle = false; z.battleTarget = null;
      // a save captured mid-raid (battles aren't persisted): bring any zombie
      // stranded at battle coordinates back home so it isn't stuck off-floor
      if (!z.stored && z.reanimateUntil <= 0 && (z.x < 0 || z.x > W || z.y < 0 || z.y > H)) { z.x = z.hx; z.y = z.hy; z.tx = z.hx; z.ty = z.hy; z.fx = z.hx; z.fy = z.hy; z.path = []; z.state = 'idle'; } });
    (this.tables || []).forEach(function (tb) { if (tb.reserved === undefined) tb.reserved = null; });
    (this.customers || []).forEach(function (c) { if (!c.path) c.path = []; if (c.fx == null) { c.fx = c.tx; c.fy = c.ty; } if (!c.type) c.type = 'civilian'; });
    this.tileClaim = {}; this.chairs = this.chairs || []; this._syncChairs();
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
  };

  // ---- derived --------------------------------------------------------
  World.prototype.ambiance = function () { var a = 0; for (var i = 0; i < this.decors.length; i++) { var it = shopById(this.decors[i].deco); if (it) a += it.ambiance || 0; } return a; };
  World.prototype.tipMult = function () { return 1 + this.ambiance() / 200 + this.rep / 400 + this.bonusStars() * 0.03; };   // décor + reputation + purple stars all tip
  World.prototype.patience = function () { return 20 + this.ambiance() / 8; };
  // Higher rating = more (and better) customers; a poor rating thins the crowd.
  World.prototype.spawnEvery = function () { var rf = 0.6 + (100 - this.rep) / 100; return Math.max(2.2, 6 / (1 + this.ambiance() / 50) * rf); };
  World.prototype.xpNeed = function (lvl) { return Math.floor(60 * Math.pow(lvl, 1.4)); };
  World.prototype.unlocked = function () { var L = this.level, ex = this.extraRecipes || []; return (window.RECIPES || []).filter(function (r) { return r.level <= L || ex.indexOf(r.id) >= 0; }); };
  World.prototype.priceFor = function (item) {
    var owned;
    if (item.kind === 'decor') owned = this.decors.filter(function (d) { return d.deco === item.id; }).length;
    else if (item.kind === 'pass') owned = this.passUnits || 2;
    else owned = item.kind === 'stove' ? this.stoves.length : item.kind === 'table' ? this.tables.length : this.zombies.length;
    var freeStart = item.kind === 'stove' ? 2 : item.kind === 'table' ? 3 : item.kind === 'decor' ? 0 : item.kind === 'pass' ? 2 : 1;
    return Math.round(item.base * Math.pow(item.grow, owned - freeStart));
  };
  World.prototype.totalZombies = function () { return this.zombies.length; };

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
    this._reviewProg('cook', 1, recipeId);
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
    // one stack per counter square: a new dish type needs a free counter
    if (!this.canAccept(st.recipe)) { this.events.push({ type: 'warn', msg: 'No free serving counter — serve food or buy another counter' }); return false; }
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
    this._reviewProg('serve', 1); this._reviewProg('earn', c.pay);
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
    this._gainXp((c.xp || 2) * 2); this._reviewProg('infect', 1);
    this.events.push({ type: 'CustomerInfected', x: c.x, y: c.y, zombie: z, stored: !wentActive });
    this._freeTable(c); var qi = this.queue ? this.queue.indexOf(c.id) : -1; if (qi >= 0) this.queue.splice(qi, 1);
    this.releaseTiles(c.id);
    this.customers.splice(this.customers.indexOf(c), 1);
    return true;
  };
  // ---- fridge: raid-loot food (Phase 4) ------------------------------
  // Stolen batches land here. You can plate them onto the pass to serve, or —
  // if the recipe is new to you — unlock it (which consumes the batch).
  World.prototype.serveFromFridge = function (idx) {
    var b = this.fridge[idx]; if (!b) return false;
    if (!this.canAccept(b.recipeId)) { this.events.push({ type: 'warn', msg: 'No free serving counter for that dish' }); return false; }
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
    if (bag === 'coin') { this.coins -= cost; this._reviewProg('spend', cost); } else this.toxin -= cost;
    if (it.kind === 'stove') this.stoves.push(this._mkStove(this.freeStoveSlot()));
    else if (it.kind === 'table') this.tables.push(this._mkTable(this.firstFreeCell()));
    if (it.kind === 'table') this._syncChairs();
    else if (it.kind === 'zombie') this._addZombie(this._mkZombie(this.zombies.length));
    else if (it.kind === 'pass') { if (!this.buyPassUnit()) { if (bag === 'coin') this.coins += cost; else this.toxin += cost; return false; } }
    else if (it.kind === 'decor') this.decors.push(this._mkDecor(it.id, this.firstFreeCell()));
    this.events.push({ type: 'bought', item: it });
    return true;
  };

  // ---- build mode: move / sell furniture -----------------------------
  World.prototype.moveTable = function (id, cell) { var t = byId(this.tables, id); if (!t || !this.cellFree(cell, id)) return false; t.cell = cell; t.x = CELLS[cell].x; t.y = CELLS[cell].y; this._syncChairs(); return true; };
  World.prototype.moveDecor = function (id, cell) { var d = byId(this.decors, id); if (!d || !this.cellFree(cell, id)) return false; d.cell = cell; d.x = CELLS[cell].x; d.y = CELLS[cell].y; return true; };
  World.prototype.moveStove = function (id, slot) { var s = byId(this.stoves, id); for (var i = 0; i < this.stoves.length; i++) if (this.stoves[i].slot === slot && this.stoves[i].id !== id) return false; if (!s) return false; s.slot = slot; s.x = STOVE_SLOTS[slot].x; s.y = STOVE_SLOTS[slot].y; return true; };
  // ---- build mode: store (stash) or sell furniture (Phase 9/12) -------
  World.prototype._removeFurniture = function (kind, id) {
    if (kind === 'table') { var ti = this.tables.findIndex(function (t) { return t.id === id; }); if (ti < 0) return null; var tb = this.tables[ti]; if (tb.by || tb.reserved) { this.events.push({ type: 'warn', msg: 'Someone is using that table' }); return null; } this.tables.splice(ti, 1); this._syncChairs(); return { kind: 'table' }; }
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
      if (it.kind === 'table') { this.tables.push(this._mkTable(cell)); this._syncChairs(); } else this.decors.push(this._mkDecor(it.deco, cell)); }
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
    if (z.reanimateUntil > this.t) { this.events.push({ type: 'warn', msg: z.name + ' is still reanimating' }); return false; }
    var emax = z.maxEnergy || 100;
    if (z.energy >= emax - 1) { this.events.push({ type: 'warn', msg: z.name + ' is already full of energy' }); return false; }
    if (this.toxin < 1) { this.events.push({ type: 'warn', msg: 'Need 1 toxin to feed a zombie' }); return false; }
    this.toxin -= 1; z.energy = emax; if (z.state === 'resting' && z.role !== 'rest') z.state = 'idle';
    this.events.push({ type: 'fed', x: z.x, y: z.y }); return true;
  };
  // ---- zombie XP / levels (faithful: staff grow from doing the work) ---
  // +1 XP per dish served, +2 per raid kill. A level-up FULLY recharges the
  // zombie's energy (the original's signature reward) and nudges its stats.
  World.prototype.zXpNeed = function (lvl) { return 4 + lvl * 3; };
  World.prototype._zGainXp = function (z, n) {
    z.zxp = (z.zxp || 0) + n; z.zlevel = z.zlevel || 1;
    var leveled = false;
    while (z.zxp >= this.zXpNeed(z.zlevel)) {
      z.zxp -= this.zXpNeed(z.zlevel); z.zlevel++; leveled = true;
      z.maxEnergy = (z.maxEnergy || 100) + 8; z.attack = (z.attack || 10) + 1;
    }
    if (leveled) { z.energy = z.maxEnergy; this.events.push({ type: 'zombieLevel', x: z.x, y: z.y, name: z.name, level: z.zlevel }); }
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
    this._releaseJob(z); this.releaseTiles(z.id); z.stored = true; z.state = 'idle'; z.x = z.hx; z.y = z.hy; z.tx = z.hx; z.ty = z.hy; z.fx = z.hx; z.fy = z.hy;
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

  // ---- Review Board (level 6, faithful) -------------------------------
  // Four randomly selected tasks; completing all four earns a purple BONUS
  // star (max 3) on top of the rating. Bonus stars decay with time. Any
  // incomplete task can be bribed away for 2 toxin (the original's rate).
  var REVIEW_LEVEL = 6, REVIEW_MAX = 3, REVIEW_BRIBE = 2, REVIEW_DECAY = 1800;
  World.prototype.reviewUnlocked = function () { return this.level >= REVIEW_LEVEL; };
  World.prototype._mkReview = function () {
    var L = this.level, self = this;
    var dishes = this.unlocked().filter(function (r) { return !r.base; });
    var dish = pick(dishes.length ? dishes : [{ id: 'coffee', name: 'Rotten Coffee', emoji: '☕' }]);
    var pool = [
      { type: 'serve', goal: 6 + L * 2, label: 'Serve ' + (6 + L * 2) + ' customers' },
      { type: 'cook', recipe: dish.id, goal: 3, label: 'Cook 3× ' + dish.emoji + ' ' + dish.name },
      { type: 'spend', goal: L * 120, label: 'Spend 🪙' + (L * 120) + ' on your café' },
      { type: 'earn', goal: L * 90, label: 'Earn 🪙' + (L * 90) + ' from diners' },
      { type: 'raid', goal: 1, label: 'Win a raid' },
      { type: 'infect', goal: 1, label: 'Infect a customer' },
    ];
    var tasks = [];
    while (tasks.length < 4 && pool.length) { var i = Math.floor(Math.random() * pool.length); var t = pool.splice(i, 1)[0]; t.done = 0; tasks.push(t); }
    return { tasks: tasks, stars: (this.review && this.review.stars) || 0, decayAt: this.t + REVIEW_DECAY };
  };
  World.prototype._reviewProg = function (type, n, key) {
    if (!this.review) return;
    var hit = false;
    for (var i = 0; i < this.review.tasks.length; i++) {
      var t = this.review.tasks[i];
      if (t.type !== type || t.done >= t.goal) continue;
      if (type === 'cook' && key !== t.recipe && (key || '').split('.')[0] !== t.recipe) continue;
      t.done = Math.min(t.goal, t.done + n); hit = true;
    }
    if (hit) this._reviewCheck();
  };
  World.prototype._reviewCheck = function () {
    if (!this.review) return;
    if (this.review.tasks.every(function (t) { return t.done >= t.goal; })) {
      this.review.stars = Math.min(REVIEW_MAX, this.review.stars + 1);
      this.events.push({ type: 'reviewPassed', stars: this.review.stars });
      // faithful decay clock: each pass ADDS time to the fade timer, capped
      // (the original: 48h, +36h, +24h per further pass, one-week cap)
      var ext = Math.min(this.t + REVIEW_DECAY * 4.6, Math.max(this.review.decayAt, this.t) + REVIEW_DECAY * 1.3);
      var stars = this.review.stars;
      this.review = this._mkReview(); this.review.stars = stars; this.review.decayAt = ext;
    }
  };
  World.prototype.bribeTask = function (i) {
    if (!this.review) return false;
    var t = this.review.tasks[i]; if (!t || t.done >= t.goal) return false;
    if (this.toxin < REVIEW_BRIBE) { this.events.push({ type: 'warn', msg: 'Need ' + REVIEW_BRIBE + ' toxin to bribe the inspector' }); return false; }
    this.toxin -= REVIEW_BRIBE; t.done = t.goal; t.bribed = true;
    this._reviewCheck(); return true;
  };
  World.prototype.bonusStars = function () { return this.review ? this.review.stars : 0; };

  // ---- raid battles (live, faithful) ----------------------------------
  // Your squad LINES UP ON THE SIDEWALK outside the rival café and you send
  // them in ONE BY ONE (tap a lined-up zombie to deploy it); a deployed
  // zombie auto-melees its nearest enemy, or tap an enemy to retarget it.
  // Waiters are weak; the cooking HEAD CHEF is the boss. Energy doubles as
  // HP on both sides and Atk Strength is flat energy damage per hit (the
  // original's combat model). ENERGIZE spends toxin for a mid-raid refill;
  // tap the white truce flag to retreat anytime — you keep the cash from
  // anyone already eaten. Downed zombies reanimate in the Meat Locker.
  var REANIMATE = 600;          // scaled from the original's 8h (later 1h)
  var ATK_RANGE = 72, ENERGIZE_COST = 1;
  World.prototype.canRaid = function (rivalId) {
    var rv = RIVAL[rivalId]; if (!rv) return false;
    var ready = this.activeZombies().filter(function (z) { return z.reanimateUntil <= this.t; }, this);
    return !this.battle && this.level >= rv.level && ready.length >= 1;
  };
  // sidewalk line-up spot i: on the pavement out front, single file
  World.prototype._lineupSpot = function (i) { return { x: 220 + i * 130, y: ROWS * TILE + 64 }; };   // base-size arena's south pavement
  World.prototype.startRaid = function (rivalId) {
    var rv = RIVAL[rivalId]; if (!this.canRaid(rivalId)) return false;
    var self = this, lineup = [];
    this.activeZombies().forEach(function (z) {
      if (z.reanimateUntil > self.t) return;
      self._releaseJob(z); self.releaseTiles(z.id);
      z.inBattle = true; z.battleTarget = null; z.atkAt = 0;
      var sp = self._lineupSpot(lineup.length);
      z.x = sp.x; z.y = sp.y; z.tx = sp.x; z.ty = sp.y; z.fx = sp.x; z.fy = sp.y; z.path = []; z.face = 'R'; z.state = 'idle';
      lineup.push(z.id);
    });
    // the rival crew: weak waiters on the floor, seated patrons (eatable),
    // and the head-chef boss holding the kitchen line
    var enemies = [], i;
    var mkE = function (kind, name, x, y, hp, atk, spd, cfg) {
      return { id: uid(), kind: kind, name: name, x: x, y: y, tx: x, ty: y, fx: x, fy: y, path: [],
        hp: hp, maxHp: hp, atk: atk, speed: spd, atkAt: 0, face: 'D', step: Math.random() * 6,
        skin: pick(SKINS), hair: pick(HAIRS), color: (cfg && cfg.color) || pick(COLORS), hat: (cfg && cfg.hat) || null };
    };
    for (i = 0; i < rv.squad + 1; i++) {
      var wx = [180, 420, 300, 540, 660][i % 5], wy = [420, 540, 660, 420, 540][i % 5];
      enemies.push(mkE('waiter', 'Waiter', wx, wy, 26 + rv.level * 7, 3 + rv.level, 0.62, { color: '#7a8696' }));
    }
    enemies.push(mkE('patron', 'Patron', 180, 780, 20, 0, 0, {}));
    enemies.push(mkE('patron', 'Patron', 540, 780, 20, 0, 0, {}));
    enemies.push(mkE('chef', 'Head Chef', 420, 300, rv.defense, 7 + rv.level * 2, 0.5, { hat: 'chef', color: '#e8e4da' }));
    // the rival's counters hold their signature dish — tap to STEAL it
    var counters = [];
    if (rv.recipe) counters.push({ id: uid(), x: PASS_SPOTS[0].x, y: PASS_SPOTS[0].y, recipe: rv.recipe, n: (RECIPES[rv.recipe] || {}).batch || 4, looted: false });
    this.battle = { rival: rivalId, lineup: lineup, inside: [], enemies: enemies, counters: counters, loot: { coins: 0 }, stoleRecipe: false };
    this.events.push({ type: 'raidStart', rival: rv });
    return true;
  };
  World.prototype.deployZombie = function (zid) {
    var B = this.battle; if (!B) return false;
    var qi = B.lineup.indexOf(zid); if (qi < 0) return false;
    var z = byId(this.zombies, zid); if (!z) return false;
    B.lineup.splice(qi, 1); B.inside.push(zid);
    z.x = DOOR.x; z.y = DOOR.y; z.tx = z.x; z.ty = z.y; z.battleTarget = null;
    var self = this;
    B.lineup.forEach(function (id, i) { var lz = byId(self.zombies, id); if (lz) { var sp = self._lineupSpot(i); lz.x = sp.x; lz.y = sp.y; lz.tx = sp.x; lz.ty = sp.y; } });
    this.events.push({ type: 'deployed', name: z.name, x: z.x, y: z.y });
    return true;
  };
  World.prototype.deployAll = function () { var B = this.battle; if (!B) return false; while (B.lineup.length) this.deployZombie(B.lineup[0]); return true; };
  World.prototype.setBattleTarget = function (zid, enemyId) {
    var B = this.battle; if (!B || B.inside.indexOf(zid) < 0) return false;
    var z = byId(this.zombies, zid), e = byId(B.enemies, enemyId);
    if (!z || !e || e.hp <= 0) return false;
    z.battleTarget = enemyId; this.events.push({ type: 'retarget', x: e.x, y: e.y });
    return true;
  };
  // ENERGIZE: toxin -> instant full energy on one raiding zombie (mid-fight heal)
  World.prototype.energizeZombie = function (zid) {
    var B = this.battle; if (!B) return false;
    var z = byId(this.zombies, zid); if (!z || !z.inBattle) return false;
    if (z.energy >= (z.maxEnergy || 100) - 1) { this.events.push({ type: 'warn', msg: z.name + ' is already full of energy' }); return false; }
    if (this.toxin < ENERGIZE_COST) { this.events.push({ type: 'warn', msg: 'Need ' + ENERGIZE_COST + ' toxin to energize' }); return false; }
    this.toxin -= ENERGIZE_COST; z.energy = z.maxEnergy || 100;
    this.events.push({ type: 'energized', x: z.x, y: z.y, name: z.name });
    return true;
  };
  // steal the food off a rival counter (tap it) — goes straight to your fridge
  World.prototype.lootCounter = function (counterId) {
    var B = this.battle; if (!B) return false;
    var ct = byId(B.counters, counterId); if (!ct || ct.looted) return false;
    if (!B.inside.length) { this.events.push({ type: 'warn', msg: 'Send a zombie in first' }); return false; }
    ct.looted = true;
    var known = (RECIPES[ct.recipe] || {}).level <= this.level || (this.extraRecipes || []).indexOf(ct.recipe) >= 0;
    this.fridge.push({ recipeId: ct.recipe, servings: ct.n, source: RIVAL[B.rival].name, canUnlock: !known });
    if (!known) B.stoleRecipe = true;
    this.events.push({ type: 'stole', x: ct.x, y: ct.y, emoji: (RECIPES[ct.recipe] || {}).emoji || '🍽️', n: ct.n });
    return true;
  };
  World.prototype.retreat = function () { if (!this.battle) return false; this._endBattle(false, true); return true; };
  World.prototype._battleKill = function (z, e) {
    var B = this.battle;
    // each kill pays cash + 2 XP to the killer + a bite of energy (faithful)
    B.loot.coins += e.kind === 'chef' ? 40 : e.kind === 'waiter' ? 20 : 15;
    z.energy = Math.min(z.maxEnergy || 100, z.energy + Math.max(8, e.maxHp * 0.2));
    this._zGainXp(z, e.kind === 'chef' ? 10 : 2);
    this.events.push({ type: 'battleKill', x: e.x, y: e.y, kind: e.kind, coins: e.kind === 'chef' ? 40 : e.kind === 'waiter' ? 20 : 15 });
  };
  World.prototype._battleDown = function (z) {
    var B = this.battle, qi = B.inside.indexOf(z.id);
    if (qi >= 0) B.inside.splice(qi, 1);
    z.inBattle = false; z.stored = true; z.energy = 0;
    z.reanimateUntil = this.t + REANIMATE;
    z.x = z.hx; z.y = z.hy; z.tx = z.hx; z.ty = z.hy; z.fx = z.hx; z.fy = z.hy; z.state = 'idle';
    this.events.push({ type: 'zombieDown', name: z.name, until: z.reanimateUntil });
  };
  World.prototype._endBattle = function (win, retreated) {
    var B = this.battle, rv = RIVAL[B.rival], self = this;
    this.coins += B.loot.coins;                          // eaten cash is kept either way
    var gotRecipe = null, fridgeFood = null;
    if (win) {
      this.coins += rv.reward; this.toxin += rv.toxin || 0;
      this._gainXp(Math.round(rv.defense)); this._reviewProg('raid', 1);
      // any un-stolen counter food comes home with the victors
      B.counters.forEach(function (ct) {
        if (ct.looted) return;
        var known = (RECIPES[ct.recipe] || {}).level <= self.level || (self.extraRecipes || []).indexOf(ct.recipe) >= 0;
        var batch = { recipeId: ct.recipe, servings: ct.n, source: rv.name, canUnlock: !known };
        self.fridge.push(batch); fridgeFood = batch;
        if (!known) gotRecipe = RECIPES[ct.recipe];
      });
    }
    // survivors walk home
    B.lineup.concat(B.inside).forEach(function (id) {
      var z = byId(self.zombies, id); if (!z) return;
      z.inBattle = false; z.battleTarget = null;
      z.x = z.hx; z.y = z.hy; z.tx = z.hx; z.ty = z.hy; z.fx = z.hx; z.fy = z.hy; z.path = []; z.state = 'idle';
    });
    this.events.push({ type: 'raidEnd', rival: rv, win: win, retreated: !!retreated, loot: B.loot.coins + (win ? rv.reward : 0), toxin: win ? (rv.toxin || 0) : 0, recipe: gotRecipe, food: fridgeFood });
    this.battle = null;
  };
  World.prototype._battleTick = function (dt) {
    var B = this.battle, self = this; if (!B) return;
    var living = B.enemies.filter(function (e) { return e.hp > 0; });
    var staff = living.filter(function (e) { return e.kind !== 'patron'; });
    // deployed zombies: close on the target and melee it
    B.inside.slice().forEach(function (zid) {
      var z = byId(self.zombies, zid); if (!z) return;
      var tgt = byId(B.enemies, z.battleTarget);
      if (!tgt || tgt.hp <= 0) {                          // auto-pick the nearest living enemy
        tgt = null; var bd = 1e9;
        living.forEach(function (e) { if (e.hp <= 0) return; var d = dist(z.x, z.y, e.x, e.y); if (d < bd) { bd = d; tgt = e; } });
        z.battleTarget = tgt ? tgt.id : null;
      }
      if (!tgt) return;
      var d = dist(z.x, z.y, tgt.x, tgt.y);
      if (d > ATK_RANGE) { z.tx = tgt.x; z.ty = tgt.y; moveTo(z, dt, zspeed(z)); }
      else if (self.t >= (z.atkAt || 0)) {
        z.atkAt = self.t + 1.2 / (z.speed || 1);          // speed = attack cadence too
        tgt.hp -= z.attack;                               // Atk Strength = flat energy damage
        self.events.push({ type: 'hit', x: tgt.x, y: tgt.y, n: z.attack, enemy: true });
        if (tgt.hp <= 0) self._battleKill(z, tgt);
      }
    });
    // rival staff fight back (energy = your zombies' HP)
    staff.forEach(function (e) {
      var tz = null, bd = 1e9;
      B.inside.forEach(function (zid) { var z = byId(self.zombies, zid); if (!z) return; var d = dist(e.x, e.y, z.x, z.y); if (d < bd) { bd = d; tz = z; } });
      if (!tz) return;
      // the chef holds the kitchen line until you get close; waiters chase
      if (e.kind === 'chef' && bd > 240) return;
      if (bd > ATK_RANGE) { e.tx = tz.x; e.ty = tz.y; moveTo(e, dt, SPEED * e.speed); }
      else if (self.t >= (e.atkAt || 0)) {
        e.atkAt = self.t + 1.4;
        tz.energy = Math.max(0, tz.energy - e.atk);
        self.events.push({ type: 'hit', x: tz.x, y: tz.y, n: e.atk, enemy: false });
        if (tz.energy <= 0) self._battleDown(tz);
      }
    });
    if (!staff.length) this._endBattle(true);
    else if (!B.inside.length && !B.lineup.length) this._endBattle(false);
  };
  // battle hit-testing for the UI
  World.prototype.pickEnemyAt = function (x, y) {
    var B = this.battle; if (!B) return null;
    var best = null, bd = 55;
    B.enemies.forEach(function (e) { if (e.hp <= 0) return; var d = dist(x, y, e.x, e.y - 16); if (d < bd) { bd = d; best = e; } });
    return best;
  };
  World.prototype.pickCounterAt = function (x, y) {
    var B = this.battle; if (!B) return null;
    var best = null, bd = 70;
    B.counters.forEach(function (ct) { if (ct.looted) return; var d = dist(x, y, ct.x, ct.y); if (d < bd) { bd = d; best = ct; } });
    return best;
  };

  // ---- simulation -----------------------------------------------------
  World.prototype.tick = function (dt) {
    if (dt > 0.25) dt = 0.25;                          // clamp big frame gaps
    this.t += dt;
    // during a raid you're at the rival café — your own café is PAUSED (the
    // original raids on a separate screen), so no customers leave angry and
    // no food burns unattended while your squad is away fighting.
    if (this.battle) { this._battleTick(dt); return; }
    this._spawn();
    // Stove FSM (Phase 4): cooking -> finished -> burnWarning -> burned.
    // Finished food MUST be carried off (by a commanded or auto zombie) before
    // it burns. Nothing teleports — burning is the cost of ignoring the pass.
    for (var i = 0; i < this.stoves.length; i++) {
      var st = this.stoves[i];
      if (!st.recipe || st.burned) continue;            // burnt food waits to be cleared, doesn't re-cook
      if (!st.ready && this.t >= st.start + (RECIPES[st.recipe].time)) { st.ready = true; st.readyAt = this.t; st.burning = false; this.events.push({ type: 'CookingFinished', x: st.x, y: st.y, emoji: RECIPES[st.recipe].emoji }); }
      if (st.ready && !st.burned) {
        var since = this.t - (st.readyAt || this.t);
        var grace = RECIPES[st.recipe].burnGrace || Math.max(BURN_MIN, RECIPES[st.recipe].time);   // ~2x cook time total
        if (!st.burning && since >= grace * BURN_WARN_F) { st.burning = true; this.events.push({ type: 'FoodBurnWarning', x: st.x, y: st.y }); }
        if (st.burning && since >= grace && !st.collecting) {
          st.burned = true; st.ready = false; this.events.push({ type: 'FoodBurned', x: st.x, y: st.y });
          this._nudgeRep(-2.5, 'burned food');
        }
      }
    }
    this._seatQueued();
    this._stepZombies(dt);
    this._stepCustomers(dt);
    // review board: opens at level 6; purple bonus stars decay with time
    if (!this.review && this.reviewUnlocked()) this.review = this._mkReview();
    if (this.review && this.review.stars > 0 && this.t >= this.review.decayAt) {
      this.review.stars--; this.review.decayAt = this.t + 1800;
      this.events.push({ type: 'reviewDecay', stars: this.review.stars });
    }
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
        if (nc < 0 || nr < 0 || nc >= this.colsNow() || nr >= this.rowsNow() || seen[k]) continue;
        if (Math.abs(nc - tc) <= 0 && Math.abs(nr - tr) <= 0) return true;   // reached the table tile's neighbour chain
        if (blocked[k]) continue;
        seen[k] = 1; q.push([nc, nr]);
      }
    }
    return false;
  };
  // reserve a specific empty, reachable CHAIR (not just a table) for a customer
  World.prototype._trySeat = function (c) {
    for (var i = 0; i < this.chairs.length; i++) {
      var ch = this.chairs[i];
      if (this.chairState(ch) !== 'empty') continue;
      var tb = byId(this.tables, ch.table); if (!tb) continue;
      ch.reserved = c.id; tb.reserved = c.id; c.chair = ch.id; c.table = tb.id; c.state = 'toTable';
      routeTo(this, c, ch.x, ch.y); return true;
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
  // Queue forms a readable single-file line down the aisle from the door, with a
  // gentle stagger so bodies + thought bubbles don't overlap (visual offsets).
  World.prototype._queueSpot = function (n) { return { x: 120 + (n % 2) * 34, y: DOOR.y + 64 + n * 60 }; };

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
  // tiles an object occupies, honouring a w x h footprint (default 1x1)
  World.prototype.footprintTiles = function (obj) {
    var c0 = Math.floor(obj.x / TILE), r0 = Math.floor(obj.y / TILE), w = obj.w || 1, h = obj.h || 1, out = [];
    for (var dx = 0; dx < w; dx++) for (var dy = 0; dy < h; dy++) out.push([c0 + dx, r0 + dy]);
    return out;
  };
  World.prototype._blockedTiles = function () {
    var set = {}, self = this, i;
    var block = function (obj) { self.footprintTiles(obj).forEach(function (t) { set[tkey(t[0], t[1])] = 1; }); };
    this.tables.forEach(block);
    this.stoves.forEach(block);
    this.passTiles().forEach(function (pt) { set[tkey(Math.floor(pt.x / TILE), Math.floor(pt.y / TILE))] = 1; });   // each 1x1 counter blocks its square
    for (i = 0; i < this.decors.length; i++) {
      var d = this.decors[i], it = shopById(d.deco);
      if (it && it.blocks === false) continue;
      block(d);
    }
    if (this._tempBlock) for (var k in this._tempBlock) set[k] = 1;          // hypothetical (build preview)
    return set;
  };
  // Live build validation: would placing/moving `kind` at `cell` be valid?
  // Returns { ok, reason }. Used by the placement ghost (green/red).
  World.prototype.placementValidity = function (kind, cell, exceptId) {
    if (kind === 'stove') {
      if (cell == null || cell < 0 || !this.stoveSlotUsable(cell)) return { ok: false, reason: 'Outside café' };
      for (var i = 0; i < this.stoves.length; i++) if (this.stoves[i].slot === cell && this.stoves[i].id !== exceptId) return { ok: false, reason: 'Overlaps furniture' };
      return { ok: true };
    }
    if (cell == null || cell < 0) return { ok: false, reason: 'Outside café' };
    if (!this.cellFree(cell, exceptId)) return { ok: false, reason: 'Overlaps furniture' };
    var tc = Math.floor(CELLS[cell].x / TILE), tr = Math.floor(CELLS[cell].y / TILE);
    if (tc === Math.floor(DOOR.x / TILE) && tr === Math.floor(DOOR.y / TILE)) return { ok: false, reason: 'Blocks the entrance' };
    // simulate the new blocker and check every table is still reachable + the door
    this._tempBlock = {}; this._tempBlock[tkey(tc, tr)] = 1;
    var ok = true, reason = null, blocked = this._blockedTiles();
    if (blocked[tkey(Math.floor(DOOR.x / TILE), Math.floor(DOOR.y / TILE))]) { ok = false; reason = 'Blocks the entrance'; }
    for (var j = 0; ok && j < this.tables.length; j++) { if (this.tables[j].id === exceptId) continue; if (!this.reachableTable(this.tables[j])) { ok = false; reason = 'No path to a table'; } }
    this._tempBlock = null;
    return { ok: ok, reason: reason };
  };
  // ---- logical square grid (the movement model) ----------------------
  // The view is isometric but the LOGIC is a COLS x ROWS square grid. Tiles are
  // walkable unless a furniture footprint blocks them. Characters claim a
  // standing tile so they never stack, and they stop at INTERACTION tiles
  // beside objects (never inside them).
  function tcol(x) { return clampi(Math.floor(x / TILE), 0, COLS + MAX_EXP - 1); }
  function trow(y) { return clampi(Math.floor(y / TILE), 0, ROWS + MAX_EXP - 1); }
  World.prototype.tileCenter = function (c, r) { return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 }; };
  World.prototype.tileOf = function (x, y) { return [tcol(x), trow(y)]; };
  // current (possibly expanded) grid size
  World.prototype.colsNow = function () { return COLS + (this.expansion || 0); };
  World.prototype.rowsNow = function () { return ROWS + (this.expansion || 0); };
  World.prototype.inBounds = function (c, r) { return c >= 0 && r >= 0 && c < this.colsNow() && r < this.rowsNow(); };
  // resolve any object to its explicit visual ANCHOR type (Stage 4.6E)
  World.prototype.anchorOf = function (obj) {
    if (!obj) return 'FLOOR_BASE_CENTER';
    if (obj.deco) return (window.ANCHOR_BY_ART && window.ANCHOR_BY_ART[(shopById(obj.deco) || {}).art]) || 'FLOOR_BASE_CENTER';
    if ('recipe' in obj) return 'WALL_BACK_FLUSH';        // stove
    if ('table' in obj) return 'CHAIR_SEAT_POINT';         // chair
    if ('dirty' in obj) return 'TABLE_CENTER';            // table
    if (obj === PASS || obj.pass) return 'COUNTER_FRONT_EDGE';
    return 'FLOOR_BASE_CENTER';
  };
  World.prototype.isWallAnchor = function (a) { return ('' + a).indexOf('WALL_') === 0 || a === 'FRIDGE_WALL_EDGE' || a === 'SINK_WALL_EDGE' || a === 'STOVE_FRONT_EDGE' || a === 'COUNTER_FRONT_EDGE'; };
  // toon-volume MODEL metadata (anchor/footprint/height/occlusion/renderLayer)
  World.prototype.objModel = function (k) { return (window.OBJ_MODELS || {})[k] || null; };
  // ---- 1x1 serving counters: ONE food stack per square -----------------
  World.prototype.passTiles = function () { return PASS_SPOTS.slice(0, this.passUnits || 2); };
  // group the pass pool into per-recipe stacks (insertion order); counter i
  // displays stack i — same dish piles up, a new dish needs a free counter.
  World.prototype.stacks = function () {
    var out = [], idx = {};
    for (var i = 0; i < this.ready.length; i++) { var id = this.ready[i]; if (idx[id] == null) { idx[id] = out.length; out.push({ id: id, n: 0 }); } out[idx[id]].n++; }
    return out;
  };
  World.prototype.canAccept = function (recipeId) {
    if (this.ready.length >= COUNTER_CAP) return false;
    var s = this.stacks();
    for (var i = 0; i < s.length; i++) if (s[i].id === recipeId) return true;   // stacks onto its pile
    return s.length < (this.passUnits || 2);                                    // needs a free counter square
  };
  World.prototype.buyPassUnit = function () {
    if ((this.passUnits || 2) >= PASS_SPOTS.length) { this.events.push({ type: 'warn', msg: 'No room for more serving counters' }); return false; }
    this.passUnits = (this.passUnits || 2) + 1; this.events.push({ type: 'rosterChanged' }); return true;
  };
  // ---- visual layout validator (Stage 4.10B) --------------------------
  // Uses each object's VISUAL bounds (OBJ_MODELS, in tile units) to flag
  // furniture whose sprites would collide on screen. Intentional overlaps
  // (chair tucked at its own table, plates on tops, seated diners) are inside
  // the parent sprite, so any cross-object intersection here is illegal.
  World.prototype.visualBoundsOf = function (kind, o) {
    var m = this.objModel(kind) || { bounds: [0.8, 0.6] };
    var w = m.bounds[0] * TILE * 0.8, h = m.bounds[1] * TILE * 0.8;   // 0.8 = tuck margin
    return { x: o.x - w / 2, y: o.y - h / 2, w: w, h: h, kind: kind, id: o.id };
  };
  World.prototype.layoutOverlaps = function () {
    var boxes = [], self = this;
    this.tables.forEach(function (t) { boxes.push(self.visualBoundsOf('table', t)); });
    this.stoves.forEach(function (s) { boxes.push(self.visualBoundsOf('stove', s)); });
    this.passTiles().forEach(function (pt, i) { boxes.push(self.visualBoundsOf('pass', { id: 'pass' + i, x: pt.x, y: pt.y })); });
    this.decors.forEach(function (d) {
      var art = (shopById(d.deco) || {}).art;
      if (art === 'rug') return;                          // walkable mat may sit under things
      var key = { counter: 'counter', sink: 'sink', fridge: 'fridge' }[art] || 'chair';
      boxes.push(self.visualBoundsOf(key, d));
    });
    var bad = [];
    for (var i = 0; i < boxes.length; i++) for (var j = i + 1; j < boxes.length; j++) {
      var a = boxes[i], b = boxes[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) bad.push([a.kind + ':' + a.id, b.kind + ':' + b.id]);
    }
    return bad;
  };

  // ---- explicit per-tile claims (reserved vs occupied) ----------------
  // The grid is the source of truth: a tile is free only if it is in-bounds,
  // not blocked by a footprint, and not claimed by another character.
  World.prototype._claims = function () { return this.tileClaim || (this.tileClaim = {}); };
  World.prototype.tileFree = function (c, r, id) {
    if (!this.inBounds(c, r)) return false;
    if (this._blockedTiles()[tkey(c, r)]) return false;
    var cl = this._claims()[tkey(c, r)];
    return !cl || cl.id === id;
  };
  World.prototype.reserveTile = function (id, c, r) { if (!this.tileFree(c, r, id)) return false; this._claims()[tkey(c, r)] = { id: id, kind: 'res' }; return true; };
  World.prototype.occupyTile = function (id, c, r) { if (!this.tileFree(c, r, id)) return false; this._claims()[tkey(c, r)] = { id: id, kind: 'occ' }; return true; };
  World.prototype.releaseTiles = function (id) { var cl = this._claims(); for (var k in cl) if (cl[k].id === id) delete cl[k]; };
  World.prototype.tileClaimedBy = function (c, r) { var cl = this._claims()[tkey(c, r)]; return cl ? cl.id : null; };
  // explicit, queryable state for one tile (debug + the grid-is-truth contract)
  World.prototype.tileState = function (c, r) {
    if (!this.inBounds(c, r)) return 'outsideCafe';
    var k = tkey(c, r);
    if (k === tkey(tcol(DOOR.x), trow(DOOR.y))) return 'door';
    if (this._blockedTiles()[k]) return 'blocked';
    var cl = this._claims()[k];
    if (cl) return cl.kind === 'occ' ? 'occupied' : 'reserved';
    return 'walkable';
  };
  // tiles claimed by OTHER characters (so pathing routes around them)
  World.prototype._occupiedTiles = function (exceptId) {
    var set = {}, cl = this._claims(), k;
    for (k in cl) if (cl[k].id !== exceptId) set[k] = 1;
    // also treat each other character's current tile as taken (defensive)
    var add = function (e) { if (!e || e.id === exceptId || e.stored) return; set[tkey(tcol(e.x), trow(e.y))] = 1; };
    this.zombies.forEach(add); this.customers.forEach(add);
    return set;
  };
  // pick the nearest free, walkable INTERACTION tile beside a target point
  World.prototype._freeTileNear = function (tx, ty, exceptId, fromX, fromY) {
    var occ = this._occupiedTiles(exceptId), blocked = this._blockedTiles();
    var tc = tcol(tx), tr = trow(ty), self = this, best = null, bd = 1e9;
    var cand = [[tc, tr + 1], [tc, tr - 1], [tc + 1, tr], [tc - 1, tr], [tc + 1, tr + 1], [tc - 1, tr + 1], [tc, tr]];
    cand.forEach(function (cell) {
      var c = cell[0], r = cell[1], k = tkey(c, r);
      if (c < 0 || r < 0 || c >= self.colsNow() || r >= self.rowsNow() || blocked[k] || occ[k]) return;
      var ctr = self.tileCenter(c, r), d = Math.hypot((fromX == null ? tx : fromX) - ctr.x, (fromY == null ? ty : fromY) - ctr.y);
      if (d < bd) { bd = d; best = ctr; }
    });
    return best || { x: tx, y: ty };
  };
  // BFS over the square grid, avoiding blocked + other characters' tiles. No
  // line-of-sight smoothing: the returned waypoints are TILE CENTRES, so
  // characters move strictly tile-to-tile instead of gliding through space.
  World.prototype.findPath = function (x0, y0, x1, y1, avoid) {
    var blocked = this._blockedTiles(), k;
    if (avoid) for (k in avoid) blocked[k] = 1;
    var sc = tcol(x0), sr = trow(y0), tc = tcol(x1), tr = trow(y1);
    var startK = tkey(sc, sr), tgtK = tkey(tc, tr);
    blocked[startK] = 0;                                   // never block where we stand or aim
    var q = [[sc, sr]], prev = {}, seen = {}; seen[startK] = 1;
    var found = (sc === tc && sr === tr), DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (q.length) {
      var cur = q.shift();
      if (cur[0] === tc && cur[1] === tr) { found = true; break; }
      for (var i = 0; i < 4; i++) {
        var nc = cur[0] + DIRS[i][0], nr = cur[1] + DIRS[i][1], kk = tkey(nc, nr);
        if (nc < 0 || nr < 0 || nc >= this.colsNow() || nr >= this.rowsNow() || seen[kk]) continue;
        if (blocked[kk] && kk !== tgtK) continue;          // target tile is always enterable
        seen[kk] = 1; prev[kk] = cur; q.push([nc, nr]);
      }
    }
    this._pathFound = found;
    if (!found) return [{ x: x1, y: y1 }];
    var tiles = [], at = [tc, tr];
    while (at && !(at[0] === sc && at[1] === sr)) { tiles.unshift(at); at = prev[tkey(at[0], at[1])]; }
    var pts = tiles.map(function (t) { return { x: t[0] * TILE + TILE / 2, y: t[1] * TILE + TILE / 2 }; });
    if (pts.length) pts[pts.length - 1] = { x: x1, y: y1 }; else pts = [{ x: x1, y: y1 }];
    return pts;
  };
  // reachability over the grid, honouring other characters? (no — layout only)
  World.prototype.pathExists = function (x0, y0, x1, y1) { this.findPath(x0, y0, x1, y1); return this._pathFound; };
  function routeTo(world, e, x, y) {
    e.fx = x; e.fy = y;
    world.releaseTiles(e.id);                              // drop our old claim
    world.reserveTile(e.id, tcol(x), trow(y));             // claim the destination tile
    e.path = world.findPath(e.x, e.y, x, y, world._occupiedTiles(e.id));
    e.noPath = !world._pathFound;
    var n = e.path.shift(); e.tx = n.x; e.ty = n.y;
  }
  // route a worker to the INTERACTION tile beside an object (never inside it)
  World.prototype._goToObject = function (z, tx, ty) { var it = this._freeTileNear(tx, ty, z.id, z.x, z.y); routeTo(this, z, it.x, it.y); };
  // advance along the routed path; true when the final point is reached
  function step(world, e, dt, spd) {
    if (!moveTo(e, dt, spd)) return false;
    if (e.path && e.path.length) { var n = e.path.shift(); e.tx = n.x; e.ty = n.y; return false; }
    return true;
  }
  // Build validation (Phase 12): flag tables a customer can no longer walk to,
  // or a door whose front is walled off. Returns human-readable problems.
  World.prototype.layoutWarnings = function () {
    var out = [], i, self = this;
    for (i = 0; i < this.tables.length; i++) if (!this.reachableTable(this.tables[i])) out.push('A table is blocked off — customers can\'t reach it.');
    // every table needs its chair square free (one open side per table)
    this.chairs.forEach(function (ch) { if (self.chairState(ch) === 'blocked' && !byId(self.tables, ch.table).dirty) out.push('A table has no room for its chair — keep one side open.'); });
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
      if (z.inBattle) continue;                        // fighting at the rival café (battle tick owns them)
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
        if (c && c.state === 'waiting') { z.state = 'toCustomer'; this._goToObject(z, c.x, c.y); }
        else { this._releaseJob(z); z.state = 'returning'; routeTo(this, z, z.hx, z.hy); }
      } else if (z.state === 'toCustomer') {
        var cu = byId(this.customers, z.job);
        if (cu && cu.state === 'waiting') { cu.state = 'eating'; cu.eat = this.t; cu.dish = z.carry; cu.assigned = null; z.carry = null; z.job = null; this._zGainXp(z, 1); }
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
          z.state = 'toDeposit'; this._goToObject(z, PASS.x, PASS.y);
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
        if (fs.ready && fs.recipe && !fs.collecting && this.canAccept(fs.recipe)) { fs.collecting = true; z.stoveId = fs.id; z.state = 'toStove'; this._goToObject(z, fs.x, fs.y); return; }
      }
    }
    // 2. serve the most impatient hungry customer we have food for
    if (canServe && this.ready.length) {
      var pickC = null, worst = -1;
      for (i = 0; i < this.customers.length; i++) {
        var c = this.customers[i];
        if (c.state === 'waiting' && !c.assigned) { var waited = this.t - c.wait; if (waited > worst) { worst = waited; pickC = c; } }
      }
      if (pickC) { pickC.assigned = z.id; z.job = pickC.id; z.carry = this.ready.pop(); z.state = 'toPass'; this._goToObject(z, PASS.x, PASS.y); return; }
    }
    // 3. clear a burnt stove so it can cook again
    if (canServe) {
      for (i = 0; i < this.stoves.length; i++) { var bs = this.stoves[i]; if (bs.burned && !bs.collecting) { bs.collecting = true; z.stoveId = bs.id; z.state = 'toStove'; this._goToObject(z, bs.x, bs.y); return; } }
    }
    // 4. bus a dirty table
    if (canClean) {
      for (var j = 0; j < this.tables.length; j++) {
        var tb = this.tables[j];
        if (tb.dirty && !tb.cleaning) { tb.cleaning = z.id; z.cleanId = tb.id; z.state = 'toClean'; this._goToObject(z, tb.x, tb.y); return; }
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
      if (st.burned) { this._releaseJob(z); st.collecting = true; z.state = 'toStove'; z.stoveId = st.id; this._goToObject(z, st.x, st.y); return { ok: true, msg: z.name + ' is scraping off the burnt food' }; }
      if (!st.ready) return { ok: false, msg: st.recipe ? 'Still cooking' : 'Nothing to pick up — start a cook first' };
      if (!this.canAccept(st.recipe)) return { ok: false, msg: 'No free serving counter for that dish' };
      this._releaseJob(z);
      st.collecting = true; z.state = 'toStove'; z.stoveId = st.id; this._goToObject(z, st.x, st.y);
      return { ok: true, msg: z.name + ' is collecting the food' };
    }
    if (hit.kind === 'customer') {
      var c = byId(this.customers, hit.id);
      if (!c || c.state !== 'waiting') return { ok: false, msg: 'They don\'t need service' };
      if (c.assigned) return { ok: false, msg: 'Someone is already serving them' };
      if (!this.ready.length) return { ok: false, msg: 'No food on the pass — cook & collect first' };
      this._releaseJob(z);
      c.assigned = z.id; z.job = c.id; z.carry = this.ready.pop();
      z.state = 'toPass'; this._goToObject(z, PASS.x, PASS.y);
      return { ok: true, msg: z.name + ' is serving them' };
    }
    if (hit.kind === 'table') {
      var tb = byId(this.tables, hit.id);
      if (!tb || !tb.dirty) return { ok: false, msg: 'That table doesn\'t need cleaning' };
      if (tb.cleaning) return { ok: false, msg: 'Already being cleaned' };
      this._releaseJob(z);
      tb.cleaning = z.id; z.cleanId = tb.id; z.state = 'toClean'; this._goToObject(z, tb.x, tb.y);
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
          var tb0 = byId(this.tables, c.table), ch0 = byId(this.chairs, c.chair);
          if (tb0) { tb0.by = c.id; tb0.reserved = null; }
          if (ch0) { ch0.by = c.id; ch0.reserved = null; }     // now OCCUPYING the chair
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
        if (arr) { this.releaseTiles(c.id); this.customers.splice(i, 1); }
      }
    }
  };
  World.prototype._freeChair = function (c) { var ch = byId(this.chairs, c.chair); if (ch) { if (ch.by === c.id) ch.by = null; if (ch.reserved === c.id) ch.reserved = null; } c.chair = null; };
  World.prototype._freeTable = function (c) { var tb = byId(this.tables, c.table); if (tb) { if (tb.by === c.id) tb.by = null; if (tb.reserved === c.id) tb.reserved = null; } this._freeChair(c); };
  // Leaving after eating leaves a dirty table a zombie must clean; an impatient
  // walk-out frees the (still-clean) table and lets the next person sit.
  World.prototype._leave = function (c, ate) {
    var tb = byId(this.tables, c.table);
    if (tb) { if (tb.by === c.id) { tb.by = null; if (ate) tb.dirty = true; } if (tb.reserved === c.id) tb.reserved = null; }
    this._freeChair(c);
    c.state = 'leaving'; c.assigned = null; routeTo(this, c, DOOR.x, DOOR.y);
  };
  // table state enum (Phase 6) for UI / tests
  World.prototype.tableState = function (tb) {
    if (tb.cleaning) return 'beingCleaned';
    if (tb.dirty) return 'dirty';
    if (!this.chairsOf(tb.id).length) return 'invalidNoChairs';
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
  World.W = W; World.H = H; World.PASS = PASS; World.PASS_W = 2; World.DOOR = DOOR; World.STOVE_SLOTS = STOVE_SLOTS; World.CELLS = CELLS;
  World.TILE = TILE; World.COLS = COLS; World.ROWS = ROWS; World.MAX_EXP = MAX_EXP;
  window.createWorld = function (saved) { return new World(saved); };
  window.World = World;
})();
