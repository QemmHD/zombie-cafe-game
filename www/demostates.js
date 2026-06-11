/* =====================================================================
 * Deterministic demo states for screenshot capture + in-game debug.
 *
 * applyDemo(world, name) mutates a freshly-created world into a fixed,
 * reproducible scene and returns a `ui` object for the renderer (e.g. a
 * selected zombie). Used by tools/shoot.js (node-canvas capture) and by the
 * in-game debug loader (#demo=NAME / #debug). No DOM dependencies.
 * ===================================================================== */
(function () {
  'use strict';
  var W = window.World || {};
  var PASS = (W && W.PASS) || { x: 420, y: 168 };
  var COLORS = window.CUSTOMER_COLORS || ['#6fa8dc'];
  var SKINS = window.SKIN_TONES || ['#e0ac69'];
  var TYPES = window.CUSTOMER_TYPES || [{ id: 'civilian', shirt: '#6fa8dc', hat: null, rarity: 'common' }];

  function seat(world, tb, state, typeIdx, face) {
    var ty = TYPES[typeIdx % TYPES.length];
    var cx = tb.x, cy = tb.y + 20;
    var c = {
      id: 'demo-' + tb.id, x: cx, y: cy, tx: cx, ty: cy, fx: cx, fy: cy, path: [], table: tb.id,
      state: state, wait: world.t - 3, eat: world.t - 2, payAt: world.t - 1, pay: 14, xp: 6, dish: 'burger',
      serveWait: 2, mood: state === 'paying' ? 'happy' : null, assigned: null,
      type: ty.id, rarity: ty.rarity, infectable: state === 'waiting',
      color: ty.shirt || COLORS[typeIdx % COLORS.length], skin: SKINS[typeIdx % SKINS.length],
      hair: ['#2b2b2b', '#5a3a1a', '#7a5230', '#b04a2a'][typeIdx % 4], hat: ty.hat || null,
      face: face || 'U', step: typeIdx * 1.3,
    };
    tb.by = c.id; world.customers.push(c);
    return c;
  }
  function queue(world, n, typeIdx) {
    var qx = 420 - 120 + (n % 4) * 80, qy = 930 + 6 - Math.floor(n / 4) * 60;
    var ty = TYPES[(typeIdx + 3) % TYPES.length];
    world.customers.push({ id: 'q-' + n, x: qx, y: qy, tx: qx, ty: qy, fx: qx, fy: qy, path: [], table: null,
      state: 'queued', wait: world.t - 4, annoyed: n === 0, type: ty.id, rarity: ty.rarity, infectable: false,
      color: ty.shirt, skin: SKINS[n % SKINS.length], hair: '#3a2a1a', hat: ty.hat, face: 'U', step: n });
  }

  var DEMOS = {
    starter: function (w) { return {}; },

    busy: function (w) {
      // A HAND-COMPOSED café (Stage 4.6E): a wall-anchored kitchen line along the
      // back, spaced dining sets in the middle with aisles, decor in the corners.
      w.coins = 5000; w.toxin = 20;
      w.buy('counter'); w.buy('fridge'); w.buy('sink'); w.buy('plant'); w.buy('lamp');
      var put = function (art, x, y) { var d = w.decors.filter(function (dd) { var it = (window.SHOP || []).filter(function (s) { return s.id === dd.deco; })[0] || {}; return it.art === art && !dd._placed; })[0]; if (d) { d.x = x; d.y = y; d.c = Math.floor(x / 120); d.r = Math.floor(y / 120); d._placed = 1; } };
      // kitchen line flush along the back wall (row 0, tile centers) — keep the
      // tiles directly BEHIND the 2x1 pass empty so the silhouette stays clean
      put('counter', 300, 60); put('sink', 660, 60); put('fridge', 780, 60);
      // decor against the side walls, away from the service area
      put('plant', 60, 300); put('lamp', 660, 660);
      // dining sets on tile centers, with full-tile walking aisles between
      var moveTbl = function (tb, x, y) { tb.x = x; tb.y = y; tb.cell = -1; }; var T = w.tables;
      if (T[0]) moveTbl(T[0], 180, 540); if (T[1]) moveTbl(T[1], 540, 540); if (T[2]) moveTbl(T[2], 300, 780);
      w._syncChairs();
      // cooking + a full pass
      w.startCook(w.stoves[0].id, 'burger'); w.stoves[0].start = w.t - 25;
      w.startCook(w.stoves[1].id, 'coffee'); w.stoves[1].ready = true; w.stoves[1].readyAt = w.t;
      w.ready = ['coffee', 'coffee', 'burger', 'soup'];
      // seat diners at their chairs (varied types/states)
      var states = ['waiting', 'eating', 'paying'];
      T.forEach(function (tb, i) { if (i < 3) seat(w, tb, states[i], i + 1, 'U'); });
      for (var q = 0; q < 3; q++) queue(w, q, q);
      // a zombie carrying a plate down the aisle toward a diner
      var z = w.zombies[0]; z.carry = 'coffee'; z.state = 'toCustomer'; z.face = 'D';
      z.x = 430; z.y = 360; z.fx = 430; z.fy = 360; z.step = 1.2;
      return {};
    },

    dirty: function (w) {
      w.rep = 18;
      w.tables.forEach(function (t, i) { if (i < 2) { t.dirty = true; } });
      w.startCook(w.stoves[0].id, 'coffee'); w.stoves[0].ready = false; w.stoves[0].burned = true; w.stoves[0].recipe = 'coffee';
      var z = w.zombies[0]; z.energy = 12; z.state = 'idle'; z.face = 'D';
      return {};
    },

    cooking: function (w) {
      w.startCook(w.stoves[0].id, 'pizza'); w.stoves[0].start = w.t - 60;       // halfway through 120s
      var z = w.zombies[0]; z.state = 'toStove'; z.stoveId = w.stoves[0].id;
      z.x = w.stoves[0].x - 4; z.y = w.stoves[0].y + 46; z.face = 'U'; z.step = 0.4;
      return {};
    },

    foodReady: function (w) {
      w.startCook(w.stoves[0].id, 'burger'); w.stoves[0].ready = true; w.stoves[0].readyAt = w.t;
      w.ready = ['burger', 'burger', 'coffee', 'coffee'];
      return {};
    },

    eating: function (w) {
      w.ready = ['burger'];
      var tb = w.tables[0]; seat(w, tb, 'eating', 2, 'D');
      var z = w.zombies[0]; z.state = 'idle'; z.x = w.zombies[0].hx; z.y = w.zombies[0].hy; z.face = 'D';
      return {};
    },

    infection: function (w) {
      w.toxin = 10;
      var tb = w.tables[0]; var c = seat(w, tb, 'waiting', 4, 'D'); c.infectable = true;
      return {};
    },

    selected: function (w) {
      w.ready = ['burger', 'coffee'];
      var tb = w.tables[0]; seat(w, tb, 'waiting', 1, 'D');
      w.tables[1].dirty = true;
      w.startCook(w.stoves[1].id, 'coffee'); w.stoves[1].ready = true; w.stoves[1].readyAt = w.t;
      var z = w.zombies[0]; z.state = 'idle'; z.face = 'R';
      return { selZ: z.id };
    },

    // ---- art-review states (inspect projection/scale/direction) --------
    artReview_emptyRoom: function (w) { w.zombies[0].stored = true; return {}; },
    artReview_kitchenZone: function (w) {
      w.coins = 9999; w.buy('counter'); w.buy('sink'); w.buy('fridge');
      var put = function (art, x, y) { var d = w.decors.filter(function (dd) { var it = (window.SHOP || []).filter(function (s) { return s.id === dd.deco; })[0] || {}; return it.art === art && !dd._p; })[0]; if (d) { d.x = x; d.y = y; d.c = Math.floor(x / 120); d.r = Math.floor(y / 120); d._p = 1; } };
      put('counter', 300, 60); put('sink', 660, 60); put('fridge', 780, 60);
      w.startCook(w.stoves[0].id, 'burger'); w.stoves[0].start = w.t - 20;
      w.zombies[0].stored = true; return {};
    },
    artReview_tableSet: function (w) {
      w.tables.slice(1).forEach(function (tb) { tb.x = -999; });            // hide extras
      var tb = w.tables[0]; tb.x = 420; tb.y = 540; w._syncChairs();        // exact tile center
      seat(w, tb, 'eating', 3, 'U'); w.zombies[0].stored = true; return {};
    },
    artReview_allObjects: function (w) {
      w.coins = 99999; ['counter', 'sink', 'fridge', 'plant', 'lamp', 'trash', 'jukebox', 'rest'].forEach(function (id) { w.buy(id); });
      var xs = [180, 300, 420, 540], i = 0;                                  // tile centers
      w.decors.forEach(function (d) { var x = xs[i % 4], y = [300, 540][Math.floor(i / 4)] || 300; d.x = x; d.y = y; d.c = Math.floor(x / 120); d.r = Math.floor(y / 120); i++; });
      w.zombies[0].stored = true; return {};
    },
    artReview_spriteDebug: function (w) { DEMOS.busy(w); return { debugSprites: true }; },
    artReview_boundsDebug: function (w) { DEMOS.busy(w); return { debugBounds: true }; },
    // mobile-framed proofs: the same scenes WITH the canvas-painted UI shell
    artReview_uiShell: function (w) { DEMOS.starter(w); return { shell: true }; },
    artReview_mobileFrame: function (w) { DEMOS.busy(w); return { shell: true }; },
    artReview_charactersDirections: function (w) {
      w.tables.forEach(function (tb) { tb.x = -999; }); w.zombies[0].stored = true;
      var faces = ['U', 'D', 'L', 'R'], TY = window.CUSTOMER_TYPES || [];
      faces.forEach(function (f, i) {
        var zx = 220 + i * 130, zy = 360;
        var z = w._mkZombie(i + 5); z.x = zx; z.y = zy; z.fx = zx; z.fy = zy; z.face = f; z.state = 'toPass'; z.step = i; z.stored = false; w.zombies.push(z);
        var cx = 220 + i * 130, cy = 640, ty = TY[i + 1] || TY[0] || {};
        w.customers.push({ id: 'd' + i, x: cx, y: cy, tx: cx, ty: cy, fx: cx, fy: cy, path: [], state: 'queued', wait: w.t, type: ty.id, color: ty.shirt || '#6fa8dc', skin: '#e0ac69', hair: '#3a2a1a', hat: ty.hat, face: f, step: i });
      });
      return {};
    },
  };

  window.DEMO_LIST = Object.keys(DEMOS);
  window.applyDemo = function (world, name) {
    var fn = DEMOS[name]; if (!fn) return {};
    return fn(world) || {};
  };
})();
