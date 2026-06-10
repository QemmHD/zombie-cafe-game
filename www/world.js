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
    this.ready = []; this.spawnAt = 1.2; this.raid = null; this.extraRecipes = []; this.auto = true;
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
    return { id: uid(), x: h.x, y: h.y, hx: h.x, hy: h.y, state: 'idle', tx: h.x, ty: h.y, fx: h.x, fy: h.y, path: [], carry: null, carryBatch: null, job: null, cleanId: null, stoveId: null, face: 'L', step: Math.random() * 6,
      name: pick(ZNAMES), rarity: rar, role: 'auto', energy: 100, speed: s.speed, serve: s.serve, clean: s.clean }; };

  // ---- save / load ----------------------------------------------------
  World.prototype.snapshot = function () {
    return {
      t: this.t, coins: this.coins, toxin: this.toxin, xp: this.xp, level: this.level,
      served: this.served, decor: this.decor, lastRecipe: this.lastRecipe, ready: this.ready,
      spawnAt: this.spawnAt, raid: this.raid, extraRecipes: this.extraRecipes, auto: this.auto,
      stoves: this.stoves, tables: this.tables, decors: this.decors, zombies: this.zombies, customers: this.customers,
    };
  };
  World.prototype._restore = function (s) {
    for (var k in s) this[k] = s[k];
    this.events = []; this.customers = this.customers || []; this.ready = this.ready || [];
    this.decor = this.decor || {}; this.decors = this.decors || [];
    if (this.auto == null) this.auto = true;
    // forward-compat: ensure zombies have home + render fields
    var self = this;
    (this.zombies || []).forEach(function (z, i) { if (z.hx == null) { var h = home(i); z.hx = h.x; z.hy = h.y; } if (z.step == null) z.step = 0; if (!z.face) z.face = 'L'; if (!z.path) z.path = []; if (z.fx == null) { z.fx = z.tx; z.fy = z.ty; } });
    (this.customers || []).forEach(function (c) { if (!c.path) c.path = []; if (c.fx == null) { c.fx = c.tx; c.fy = c.ty; } });
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
      id: uid(), x: DOOR.x, y: DOOR.y, tx: DOOR.x, ty: DOOR.y, fx: DOOR.x, fy: DOOR.y, path: [], table: tb.id,
      state: 'toTable', wait: 0, eat: 0, pay: 0, xp: 0, dish: null,
      assigned: null, infectable: Math.random() < INFECT_CHANCE,
      color: pick(COLORS), skin: pick(SKINS), hair: pick(HAIRS), face: 'U', step: Math.random() * 6,
    };
    tb.by = c.id; this.customers.push(c);
    routeTo(this, c, tb.x, tb.y + 20);
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
  // after the layout changes (build mode), re-route everyone mid-walk
  World.prototype.repathAll = function () {
    var self = this;
    function rp(e) { if (e.fx != null && (e.x !== e.fx || e.y !== e.fy)) routeTo(self, e, e.fx, e.fy); }
    this.zombies.forEach(rp); this.customers.forEach(rp);
  };

  World.prototype._stepZombies = function (dt) {
    for (var i = 0; i < this.zombies.length; i++) {
      var z = this.zombies[i];
      var working = z.state === 'toPass' || z.state === 'toCustomer' || z.state === 'toClean' || z.state === 'cleaning' || z.state === 'toStove' || z.state === 'toDeposit';
      if (working) z.energy = Math.max(0, z.energy - DRAIN * dt);
      else if (z.state === 'resting') z.energy = Math.min(100, z.energy + REGEN_REST * dt);
      else z.energy = Math.min(100, z.energy + REGEN_IDLE * dt);

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
        // commanded carry: pick the finished batch up off the stove
        var sst = byId(this.stoves, z.stoveId);
        if (sst && sst.ready && sst.recipe) {
          var rr2 = RECIPES[sst.recipe];
          z.carryBatch = { id: sst.recipe, n: rr2.batch };
          sst.recipe = null; sst.start = 0; sst.ready = false; sst.readyAt = 0;
          z.state = 'toDeposit'; routeTo(this, z, PASS.x, PASS.y + 22);
        } else { z.stoveId = null; z.state = 'returning'; routeTo(this, z, z.hx, z.hy); }
      } else if (z.state === 'toDeposit') {
        if (z.carryBatch) {
          var added = 0;
          for (var b = 0; b < z.carryBatch.n && this.ready.length < POOL_CAP; b++) { this.ready.push(z.carryBatch.id); added++; }
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
    if (z.carryBatch) { for (var b = 0; b < z.carryBatch.n && this.ready.length < POOL_CAP; b++) this.ready.push(z.carryBatch.id); z.carryBatch = null; }
    if (z.cleanId) { var tb = byId(this.tables, z.cleanId); if (tb && tb.cleaning === z.id) tb.cleaning = null; z.cleanId = null; }
    z.stoveId = null;
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
          z.state = 'toPass'; routeTo(this, z, PASS.x, PASS.y + 22); return;
        }
      }
    }
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
      if (!st.ready) return { ok: false, msg: st.recipe ? 'Still cooking' : 'Nothing to pick up — start a cook first' };
      this._releaseJob(z);
      z.state = 'toStove'; z.stoveId = st.id; routeTo(this, z, st.x, st.y + 40);
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
    for (i = 0; i < this.stoves.length; i++) { var s = this.stoves[i]; if (dist(x, y, s.x, s.y) < 55) return { kind: 'stove', id: s.id, ready: s.ready, cooking: !!s.recipe }; }
    for (i = 0; i < this.tables.length; i++) { var tb = this.tables[i]; if (tb.dirty && dist(x, y, tb.x, tb.y) < 55) return { kind: 'table', id: tb.id }; }
    return null;
  };

  World.prototype._stepCustomers = function (dt) {
    for (var i = this.customers.length - 1; i >= 0; i--) {
      var c = this.customers[i], arr = step(this, c, dt, SPEED);
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
  World.prototype._leave = function (c, ate) { var tb = byId(this.tables, c.table); if (tb && tb.by === c.id) { tb.by = null; if (ate) tb.dirty = true; } c.state = 'leaving'; c.assigned = null; routeTo(this, c, DOOR.x, DOOR.y); };

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
