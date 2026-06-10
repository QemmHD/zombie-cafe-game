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
      w.coins = 5000; w.toxin = 20;
      w.buy('table'); w.buy('table'); w.buy('plant'); w.buy('lamp'); w.buy('counter'); w.buy('fridge'); w.buy('sink');
      w.startCook(w.stoves[0].id, 'burger'); w.stoves[0].start = w.t - 25;     // mid-cook
      w.startCook(w.stoves[1].id, 'coffee'); w.stoves[1].ready = true; w.stoves[1].readyAt = w.t;
      w.ready = ['coffee', 'coffee', 'burger'];
      var free = w.tables.filter(function (t) { return !t.by; });
      var states = ['waiting', 'eating', 'paying', 'waiting'];
      free.forEach(function (tb, i) { if (i < 4) seat(w, tb, states[i], i + 1, ['U', 'D', 'L', 'R'][i % 4]); });
      for (var q = 0; q < 3; q++) queue(w, q, q);
      var z = w.zombies[0]; z.carry = 'coffee'; z.state = 'toCustomer'; z.face = 'R';
      z.x = PASS.x + 40; z.y = PASS.y + 120; z.step = 1.2;
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
  };

  window.DEMO_LIST = Object.keys(DEMOS);
  window.applyDemo = function (world, name) {
    var fn = DEMOS[name]; if (!fn) return {};
    return fn(world) || {};
  };
})();
