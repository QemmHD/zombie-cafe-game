/* =====================================================================
 * Zombie Cafe — 2D canvas renderer + sprite drawing.
 *
 * Draws the top-down cafe: tiled floor, kitchen counter with stoves, tables,
 * and procedurally-drawn walking characters (green zombie staff + colourful
 * human customers) with a little walk bob, plus food/coin/think bubbles.
 * Pure drawing — it reads a World and paints it; no game state lives here.
 * ===================================================================== */
(function () {
  'use strict';
  var W = 720, H = 1280;
  var EMOJI = {}; (window.RECIPES || []).forEach(function (r) { EMOJI[r.id] = r.emoji; });

  function Renderer(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.scale = 1; this.ox = 0; this.oy = 0;
    this.resize();
  }
  Renderer.prototype.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var cw = this.cv.clientWidth, ch = this.cv.clientHeight;
    this.cv.width = Math.round(cw * dpr); this.cv.height = Math.round(ch * dpr);
    var s = Math.min(cw / W, ch / H);
    this.scale = s * dpr;
    this.ox = (this.cv.width - W * this.scale) / 2;
    this.oy = (this.cv.height - H * this.scale) / 2;
  };
  // screen (client) point -> world coordinates
  Renderer.prototype.toWorld = function (cx, cy) {
    var dpr = this.cv.width / this.cv.clientWidth;
    return { x: (cx * dpr - this.ox) / this.scale, y: (cy * dpr - this.oy) / this.scale };
  };

  Renderer.prototype.draw = function (world, t, ui) {
    ui = ui || {};
    var c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#0b0f0c'; c.fillRect(0, 0, this.cv.width, this.cv.height);
    c.setTransform(this.scale, 0, 0, this.scale, this.ox, this.oy);
    // clip to room
    c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip();

    this._floor(c);
    if (ui.edit) this._buildGrid(c, world, ui);
    this._kitchen(c, world);
    // draw furniture + actors sorted by y for a little depth
    var sel = ui.selected;
    var items = [];
    world.decors.forEach(function (d) { items.push({ y: d.y, fn: function () { drawDecor(c, d, sel && sel.id === d.id); } }); });
    world.tables.forEach(function (tb) { items.push({ y: tb.y, fn: function () { drawTable(c, tb, sel && sel.id === tb.id); } }); });
    world.stoves.forEach(function (st) { items.push({ y: st.y + 30, fn: function () { drawStove(c, st, world, t, sel && sel.id === st.id); } }); });
    if (!ui.edit) {
      world.customers.forEach(function (cu) { items.push({ y: cu.y, fn: function () { drawCustomer(c, cu, world, t); } }); });
      world.zombies.forEach(function (z) { items.push({ y: z.y, fn: function () { drawZombie(c, z, t); } }); });
    }
    items.sort(function (a, b) { return a.y - b.y; });
    items.forEach(function (it) { it.fn(); });

    this._door(c);
    c.restore();
  };

  // build-mode grid overlay: show every cell, highlight free ones
  Renderer.prototype._buildGrid = function (c, world, ui) {
    var cells = window.World.CELLS;
    for (var i = 0; i < cells.length; i++) {
      var free = world.cellFree(i, ui.selected ? ui.selected.id : null);
      c.fillStyle = free ? 'rgba(124,255,90,.10)' : 'rgba(216,65,58,.08)';
      c.strokeStyle = free ? 'rgba(124,255,90,.45)' : 'rgba(216,65,58,.3)';
      c.lineWidth = 2;
      roundRect(c, cells[i].x - 58, cells[i].y - 40, 116, 80, 12); c.fill(); c.stroke();
    }
  };

  Renderer.prototype._floor = function (c) {
    var tile = 60;
    for (var y = 0; y < H; y += tile) for (var x = 0; x < W; x += tile) {
      var even = ((x / tile) + (y / tile)) % 2 === 0;
      c.fillStyle = even ? '#1a241c' : '#16201a';
      c.fillRect(x, y, tile, tile);
    }
    // outer walls
    c.fillStyle = '#0d140f'; c.fillRect(0, 0, W, 60);
    c.fillStyle = 'rgba(255,255,255,.03)'; c.fillRect(0, 60, W, 4);
  };
  Renderer.prototype._kitchen = function (c, world) {
    // back counter band
    c.fillStyle = '#223026'; c.fillRect(0, 70, W, 150);
    c.fillStyle = '#2c3d31'; c.fillRect(0, 200, W, 22);
    // the "pass" where ready dishes wait
    var P = window.World.PASS;
    c.fillStyle = '#3a5142'; roundRect(c, P.x - 70, P.y - 4, 140, 40, 8); c.fill();
    c.fillStyle = '#daf5dd'; c.font = 'bold 22px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
    var n = world.ready.length;
    if (n > 0) {
      var show = Math.min(n, 5);
      for (var i = 0; i < show; i++) c.fillText(EMOJI[world.ready[world.ready.length - 1 - i]] || '🍽️', P.x - (show - 1) * 13 + i * 26, P.y + 16);
      if (n > 5) { c.fillStyle = '#7cff5a'; c.font = 'bold 14px system-ui'; c.fillText('+' + (n - 5), P.x + 78, P.y + 16); }
    } else {
      c.fillStyle = '#5d7a64'; c.font = '12px system-ui'; c.fillText('pass', P.x, P.y + 16);
    }
  };
  Renderer.prototype._door = function (c) {
    var D = window.World.DOOR;
    c.fillStyle = '#0d140f'; c.fillRect(0, H - 40, W, 40);
    c.fillStyle = '#3a2a1a'; roundRect(c, D.x - 55, H - 64, 110, 60, 8); c.fill();
    c.fillStyle = '#6b4a2a'; roundRect(c, D.x - 46, H - 56, 92, 56, 6); c.fill();
    c.fillStyle = '#ffcf4d'; c.beginPath(); c.arc(D.x + 30, H - 30, 4, 0, 7); c.fill();
    c.fillStyle = '#caa46a'; c.font = 'bold 12px system-ui'; c.textAlign = 'center'; c.fillText('ENTRANCE', D.x, H - 70);
  };

  // ---- sprites --------------------------------------------------------
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  function shadow(c, x, y, w) { c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x, y, w, w * 0.4, 0, 0, 7); c.fill(); }

  function drawTable(c, tb, selected) {
    var lift = selected ? 10 : 0;
    // chairs (top + bottom of the table)
    c.fillStyle = '#42301f';
    roundRect(c, tb.x - 13, tb.y - 40 - lift, 26, 16, 5); c.fill();
    roundRect(c, tb.x - 13, tb.y + 22 - lift, 26, 16, 5); c.fill();
    shadow(c, tb.x, tb.y + 26, 34);
    c.fillStyle = '#5a3d28'; c.beginPath(); c.ellipse(tb.x, tb.y - lift, 34, 26, 0, 0, 7); c.fill();
    c.fillStyle = '#6e4d34'; c.beginPath(); c.ellipse(tb.x, tb.y - 3 - lift, 34, 26, 0, 0, 7); c.fill();
    c.fillStyle = '#825c3f'; c.beginPath(); c.ellipse(tb.x, tb.y - 3 - lift, 24, 17, 0, 0, 7); c.fill();
    if (selected) selRing(c, tb.x, tb.y - lift, 40);
  }

  function drawDecor(c, d, selected) {
    var it = (window.SHOP || []).filter(function (s) { return s.id === d.deco; })[0] || {};
    var x = d.x, y = d.y, lift = selected ? 10 : 0; y -= lift;
    shadow(c, x, y + 22, 22);
    switch (it.art) {
      case 'plant':
        c.fillStyle = '#8a5a36'; roundRect(c, x - 12, y + 4, 24, 18, 4); c.fill();
        c.fillStyle = '#2f8f3a'; c.beginPath(); c.arc(x, y - 4, 16, 0, 7); c.fill();
        c.fillStyle = '#3fb04a'; c.beginPath(); c.arc(x - 7, y - 10, 9, 0, 7); c.arc(x + 7, y - 8, 8, 0, 7); c.fill(); break;
      case 'lamp':
        c.strokeStyle = '#3a3a3a'; c.lineWidth = 4; line(c, x, y + 24, x, y - 6);
        c.fillStyle = '#ffcf4d'; c.beginPath(); c.moveTo(x - 16, y - 4); c.lineTo(x + 16, y - 4); c.lineTo(x + 10, y - 22); c.lineTo(x - 10, y - 22); c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,207,77,.25)'; c.beginPath(); c.arc(x, y, 26, 0, 7); c.fill(); break;
      case 'rug':
        c.fillStyle = '#7a1f24'; roundRect(c, x - 40, y - 26, 80, 52, 10); c.fill();
        c.strokeStyle = '#c0902f'; c.lineWidth = 3; roundRect(c, x - 33, y - 19, 66, 38, 8); c.stroke(); break;
      case 'jukebox':
        c.fillStyle = '#5a2a6a'; roundRect(c, x - 18, y - 26, 36, 50, 8); c.fill();
        c.fillStyle = '#ffcf4d'; roundRect(c, x - 12, y - 20, 24, 14, 4); c.fill();
        c.fillStyle = '#b06bff'; c.beginPath(); c.arc(x, y + 6, 7, 0, 7); c.fill(); break;
      case 'fountain':
        c.fillStyle = '#444'; c.beginPath(); c.ellipse(x, y + 8, 26, 14, 0, 0, 7); c.fill();
        c.fillStyle = '#7a1f24'; c.beginPath(); c.ellipse(x, y + 4, 22, 11, 0, 0, 7); c.fill();
        c.fillStyle = '#d8413a'; roundRect(c, x - 4, y - 18, 8, 22, 3); c.fill();
        c.beginPath(); c.arc(x, y - 18, 6, 0, 7); c.fill(); break;
      default:
        c.fillStyle = '#445'; roundRect(c, x - 14, y - 14, 28, 28, 6); c.fill();
    }
    if (selected) selRing(c, x, y, 30);
  }
  function selRing(c, x, y, r) { c.strokeStyle = '#7cff5a'; c.lineWidth = 3; c.setLineDash([6, 5]); c.beginPath(); c.arc(x, y, r + 6, 0, 7); c.stroke(); c.setLineDash([]); }

  function bob(e) { return Math.sin(e.step) * (e.state === 'idle' || e.state === 'waiting' || e.state === 'eating' || e.state === 'paying' ? 0.6 : 2.4); }

  function drawZombie(c, z, t) {
    var x = z.x, y = z.y, b = bob(z);
    shadow(c, x, y + 18, 16);
    // legs
    c.strokeStyle = '#3f7a36'; c.lineWidth = 6; c.lineCap = 'round';
    var sw = Math.sin(z.step) * (z.state === 'idle' ? 1 : 5);
    line(c, x - 5, y + 8, x - 5 + sw, y + 20); line(c, x + 5, y + 8, x + 5 - sw, y + 20);
    // body
    c.fillStyle = '#6abf4b'; roundRect(c, x - 12, y - 12 - b, 24, 26, 9); c.fill();
    c.fillStyle = 'rgba(0,0,0,.12)'; roundRect(c, x - 12, y + 2 - b, 24, 12, 7); c.fill();
    // arms (carry food forward)
    c.strokeStyle = '#5aa83f'; c.lineWidth = 5;
    if (z.carry) { line(c, x - 9, y - 6 - b, x - 14, y - 14 - b); line(c, x + 9, y - 6 - b, x + 14, y - 14 - b); }
    else { line(c, x - 11, y - 6 - b, x - 15, y + 2 - b); line(c, x + 11, y - 6 - b, x + 15, y + 2 - b); }
    // head
    c.fillStyle = '#7bd35a'; c.beginPath(); c.arc(x, y - 20 - b, 11, 0, 7); c.fill();
    // face
    c.fillStyle = '#13240f';
    var lx = z.face === 'R' ? 1 : z.face === 'L' ? -1 : 0;
    c.beginPath(); c.arc(x - 4 + lx, y - 21 - b, 1.7, 0, 7); c.arc(x + 4 + lx, y - 21 - b, 1.7, 0, 7); c.fill();
    c.strokeStyle = '#13240f'; c.lineWidth = 1.4; line(c, x - 4, y - 15 - b, x + 4, y - 15 - b);
    // stitch on head
    c.lineWidth = 1; line(c, x - 8, y - 24 - b, x - 4, y - 22 - b);
    // carried dish bubble
    if (z.carry) bubble(c, x, y - 38 - b, EMOJI[z.carry] || '🍽️');
  }

  function drawCustomer(c, cu, world, t) {
    var x = cu.x, y = cu.y, b = bob(cu);
    shadow(c, x, y + 18, 15);
    c.strokeStyle = '#222'; c.lineWidth = 6; c.lineCap = 'round';
    var sw = Math.sin(cu.step) * (cu.state === 'toTable' || cu.state === 'leaving' ? 5 : 0.5);
    c.strokeStyle = '#33373a';
    line(c, x - 5, y + 8, x - 5 + sw, y + 20); line(c, x + 5, y + 8, x + 5 - sw, y + 20);
    // body (shirt)
    c.fillStyle = cu.color; roundRect(c, x - 11, y - 11 - b, 22, 24, 8); c.fill();
    // arms
    c.strokeStyle = cu.color; c.lineWidth = 5; line(c, x - 10, y - 5 - b, x - 14, y + 2 - b); line(c, x + 10, y - 5 - b, x + 14, y + 2 - b);
    // head
    c.fillStyle = cu.skin; c.beginPath(); c.arc(x, y - 19 - b, 10, 0, 7); c.fill();
    c.fillStyle = '#2b2b2b'; c.beginPath(); c.arc(x, y - 25 - b, 10, Math.PI, 2 * Math.PI); c.fill(); // hair
    c.fillStyle = '#222';
    var lx = cu.face === 'R' ? 1.5 : cu.face === 'L' ? -1.5 : 0;
    c.beginPath(); c.arc(x - 3.5 + lx, y - 19 - b, 1.5, 0, 7); c.arc(x + 3.5 + lx, y - 19 - b, 1.5, 0, 7); c.fill();
    // state bubble
    if (cu.state === 'waiting') {
      if (cu.infectable) bubble(c, x, y - 40 - b, '🧟', '#7cff5a');
      else bubble(c, x, y - 40 - b, '🍴');
      // patience ring
      var p = 1 - Math.min(1, (world.t - cu.wait) / world.patience());
      ring(c, x + 20, y - 30 - b, 9, p, p > 0.4 ? '#7cff5a' : p > 0.18 ? '#ffcf4d' : '#d8413a');
    } else if (cu.state === 'eating') {
      bubble(c, x, y - 40 - b, EMOJI[cu.dish] || '🍽️');
    } else if (cu.state === 'paying') {
      bubble(c, x, y - 40 - b, '🪙', '#ffcf4d');
    }
  }

  function bubble(c, x, y, txt, ring) {
    c.fillStyle = ring || '#eef6ee';
    c.beginPath(); c.arc(x, y, 13, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 11, 0, 7); c.fill();
    c.font = '15px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#111';
    c.fillText(txt, x, y + 1);
  }
  function ring(c, x, y, r, frac, col) {
    c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
    c.strokeStyle = col; c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + frac * 2 * Math.PI); c.stroke();
  }
  function line(c, x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }

  function drawStove(c, st, world, t, selected) {
    var x = st.x, y = st.y;
    shadow(c, x, y + 22, 26);
    if (st.ready) { c.fillStyle = 'rgba(124,255,90,' + (0.18 + 0.12 * Math.sin(t * 5)) + ')'; roundRect(c, x - 32, y - 30, 64, 62, 12); c.fill(); }
    c.fillStyle = selected ? '#4a5560' : '#3a3f44'; roundRect(c, x - 26, y - 22, 52, 46, 8); c.fill();
    c.fillStyle = '#2a2e32'; roundRect(c, x - 20, y - 16, 40, 24, 6); c.fill();
    c.fillStyle = '#1c1f22'; c.beginPath(); c.arc(x, y - 4, 14, 0, 7); c.fill();
    var r = window.RECIPES.find ? window.RECIPES.find(function (q) { return q.id === st.recipe; }) : null;
    r = r || { time: 1, emoji: '🍳', batch: 0 };
    if (st.ready) {
      // finished food sitting on the stove — tap to serve
      c.fillStyle = '#54585c'; roundRect(c, x - 12, y - 12, 24, 14, 4); c.fill();
      c.font = '18px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(r.emoji, x, y - 4);
      c.fillStyle = '#07210a'; roundRect(c, x - 26, y - 36, 52, 16, 6); c.fillStyle = '#7cff5a'; roundRect(c, x - 26, y - 36, 52, 16, 6); c.fill();
      c.fillStyle = '#07210a'; c.font = 'bold 11px system-ui'; c.fillText('SERVE ▸', x, y - 28);
      c.fillStyle = '#fff'; bubbleCount(c, x + 22, y - 30, st && r.batch ? r.batch : 0);
    } else if (st.recipe) {
      var frac = Math.min(1, (world.t - st.start) / r.time);
      for (var i = -1; i <= 1; i++) { c.fillStyle = i === 0 ? '#ffb43d' : '#ff7a2d'; c.beginPath(); c.arc(x + i * 6, y - 4 + Math.sin(t * 8 + i) * 1.5, 4 + Math.random() * 1.5, 0, 7); c.fill(); }
      c.fillStyle = '#54585c'; roundRect(c, x - 12, y - 12, 24, 14, 4); c.fill();
      c.font = '16px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(r.emoji, x, y - 5);
      c.fillStyle = '#0c140e'; roundRect(c, x - 24, y - 34, 48, 7, 3); c.fill();
      c.fillStyle = '#7cff5a'; roundRect(c, x - 24, y - 34, 48 * frac, 7, 3); c.fill();
    } else {
      c.fillStyle = '#7cff5a'; c.font = 'bold 20px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('+', x, y - 3);
      c.fillStyle = '#5d7a64'; c.font = '10px system-ui'; c.fillText('cook', x, y + 16);
    }
    if (selected) selRing(c, x, y, 32);
  }
  function bubbleCount(c, x, y, n) { if (!n) return; c.fillStyle = '#d8413a'; c.beginPath(); c.arc(x, y, 9, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 11px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(n, x, y + 1); }

  window.Renderer = Renderer;
})();
