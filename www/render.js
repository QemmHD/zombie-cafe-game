/* =====================================================================
 * Zombie Cafe — isometric 2.5D renderer.
 *
 * The world is a flat COLS x ROWS tile plane; this projects it into a chunky
 * isometric room and paints outlined cartoon sprites: hunched zombie staff
 * (chef hats, aprons, drool), big-headed human customers with expressions,
 * tables with cloths + chairs, ovens, a serving counter, a fridge, plus floor
 * grime, plants and props. Everything is depth-sorted by tile (x+y).
 *
 * Sprites are drawn as upright "billboards" sized to the on-screen tile, so
 * characters stay big and readable regardless of the iso squish. All drawing
 * is in device pixels; project()/unproject() bridge plane <-> screen.
 * ===================================================================== */
(function () {
  'use strict';
  var Wld = window.World;
  function recipe(id) { for (var i = 0; i < (window.RECIPES || []).length; i++) if (window.RECIPES[i].id === id) return window.RECIPES[i]; return null; }
  function shop(id) { for (var i = 0; i < (window.SHOP || []).length; i++) if (window.SHOP[i].id === id) return window.SHOP[i]; return null; }

  // palette
  var C = {
    out: '#15160f', floorL: '#8b9088', floorD: '#7c827a', grout: '#5f655d',
    wallL: '#6e8a72', wallR: '#566e5b', wallTop: '#84a085', skirt: '#3c4d40',
    outside: '#1b2a1c', street: '#2a2c25',
    zSkin: '#7fcf57', zSkinD: '#5aa83f', apron: '#d8d2c0', hat: '#f4f1e8',
    cloth1: '#c44', cloth2: '#eee', wood: '#7a5436', woodD: '#5d3f28',
    steel: '#9aa0a6', steelD: '#6c7176', gold: '#ffcf4d', toxic: '#7cff5a', blood: '#d8413a',
  };

  function Renderer(canvas) { this.cv = canvas; this.ctx = canvas.getContext('2d'); this.resize(); }

  Renderer.prototype.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.dpr = dpr;
    var cw = this.cv.clientWidth || 360, ch = this.cv.clientHeight || 640;
    this.cv.width = Math.round(cw * dpr); this.cv.height = Math.round(ch * dpr);
    var cvW = this.cv.width, cvH = this.cv.height, W = Wld.W, H = Wld.H;
    var spanX = W + H;                                  // isoX ranges over [-H, W]
    var wallU = 210;                                    // wall height in KX units
    var KXw = (cvW * 0.99) / spanX;                     // scale that fits the width
    var KXh = (cvH * 0.95) / (spanX * 0.56 + wallU);    // scale that fills the height
    // COVER the screen: fill the height (so the cafe is the whole screen, not a
    // small diamond floating in black), but cap how much we zoom past the
    // width-fit so we never crop the side walls too aggressively.
    var KX = Math.min(Math.max(KXw, KXh), KXw * 1.5);
    var KY = KX * 0.56, wall = KX * wallU;
    var contentH = spanX * KY + wall;
    this.KX = KX; this.KY = KY; this.wall = wall;
    this.OX = cvW / 2 + ((H - W) / 2) * KX;             // centre the diamond horizontally
    this.OY = (cvH - contentH) / 2 + wall + cvH * 0.02; // centre vertically, nudged down a touch
    this.S = this.TW = Wld.TILE * KX * 2;
    this.TH = Wld.TILE * KY * 2;
    this.TW = Wld.TILE * KX * 2;                        // on-screen tile diamond size
    this.TH = Wld.TILE * KY * 2;
    this.S = this.TW;                                   // sprite scale reference
  };
  Renderer.prototype.project = function (x, y) { return { x: this.OX + (x - y) * this.KX, y: this.OY + (x + y) * this.KY }; };
  Renderer.prototype.unproject = function (px, py) { var ix = (px - this.OX) / this.KX, iy = (py - this.OY) / this.KY; return { x: (ix + iy) / 2, y: (iy - ix) / 2 }; };
  Renderer.prototype.toWorld = function (cx, cy) { return this.unproject(cx * this.dpr, cy * this.dpr); };
  Renderer.prototype.toClient = function (x, y) { var p = this.project(x, y); return { x: p.x / this.dpr, y: p.y / this.dpr }; };

  // ---- main draw ------------------------------------------------------
  Renderer.prototype.draw = function (world, t, ui) {
    ui = ui || {};
    this._selZ = ui.selZ || null;                       // tap-command selection
    this._foodReady = world.ready.length > 0;
    this._t = t;
    var c = this.ctx, cvW = this.cv.width, cvH = this.cv.height;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = C.outside; c.fillRect(0, 0, cvW, cvH);
    this._outside(c);
    this._walls(c);
    this._floor(c);
    if (ui.edit) this._grid(c, world, ui);

    // depth-sorted drawables
    var self = this, items = [];
    function add(x, y, fn) { items.push({ d: x + y, fn: fn }); }
    add(Wld.PASS.x, Wld.PASS.y - 1, function () { self._pass(c, world); });
    world.decors.forEach(function (d) { add(d.x, d.y, function () { self._decor(c, d, ui.selected && ui.selected.id === d.id); }); });
    world.tables.forEach(function (tb) { add(tb.x, tb.y, function () { self._table(c, tb, ui.selected && ui.selected.id === tb.id, t); }); });
    world.stoves.forEach(function (st) { add(st.x, st.y, function () { self._stove(c, st, world, t, ui.selected && ui.selected.id === st.id); }); });
    if (!ui.edit) {
      world.customers.forEach(function (cu) { add(cu.x, cu.y, function () { self._customer(c, cu, world, t); }); });
      world.zombies.forEach(function (z) { add(z.x, z.y, function () { self._zombie(c, z, t); }); });
    }
    items.sort(function (a, b) { return a.d - b.d; });
    items.forEach(function (it) { it.fn(); });
    this._door(c);
  };

  // ---- environment ----------------------------------------------------
  Renderer.prototype._diamond = function (c, x, y) { var p = this.project(x, y); c.lineTo(p.x, p.y); };
  Renderer.prototype._roomPath = function (c) {
    var W = Wld.W, H = Wld.H; c.beginPath();
    var a = this.project(0, 0); c.moveTo(a.x, a.y);
    this._diamond(c, W, 0); this._diamond(c, W, H); this._diamond(c, 0, H); c.closePath();
  };
  Renderer.prototype._outside = function (c) {
    // a paved street margin just outside the room (front-left & front-right)
    var W = Wld.W, H = Wld.H, m = Wld.TILE * 0.7;
    c.fillStyle = C.street;
    c.beginPath();
    var pts = [ [0, H], [W, H], [W + m, H + m], [-m, H + m] ].map(function (p) { return this.project(p[0], p[1]); }, this);
    c.moveTo(pts[0].x, pts[0].y); for (var i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y); c.closePath(); c.fill();
  };
  Renderer.prototype._walls = function (c) {
    var W = Wld.W, H = Wld.H, wall = this.wall;
    var A = this.project(0, 0), B = this.project(W, 0), D = this.project(0, H);
    // right-back wall (edge A-B)
    c.fillStyle = C.wallR;
    c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.lineTo(B.x, B.y - wall); c.lineTo(A.x, A.y - wall); c.closePath(); c.fill();
    // left-back wall (edge A-D)
    c.fillStyle = C.wallL;
    c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(D.x, D.y); c.lineTo(D.x, D.y - wall); c.lineTo(A.x, A.y - wall); c.closePath(); c.fill();
    // top trims
    c.fillStyle = C.wallTop;
    c.beginPath(); c.moveTo(A.x, A.y - wall); c.lineTo(B.x, B.y - wall); c.lineTo(B.x, B.y - wall - 10); c.lineTo(A.x, A.y - wall - 10); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(A.x, A.y - wall); c.lineTo(D.x, D.y - wall); c.lineTo(D.x, D.y - wall - 10); c.lineTo(A.x, A.y - wall - 10); c.closePath(); c.fill();
    // a window + a crooked picture on the walls for life
    this._wallWindow(c, B, A, wall, 0.5);
    this._wallPic(c, A, D, wall, 0.55);
    // skirting
    c.strokeStyle = C.skirt; c.lineWidth = Math.max(2, this.KX * 14);
    c.beginPath(); c.moveTo(B.x, B.y); c.lineTo(A.x, A.y); c.lineTo(D.x, D.y); c.stroke();
  };
  Renderer.prototype._wallWindow = function (c, P0, P1, wall, f) {
    var x = P0.x + (P1.x - P0.x) * f, y = P0.y + (P1.y - P0.y) * f, w = this.TW * 0.7, h = wall * 0.42;
    c.save(); c.translate(x, y - wall * 0.62);
    c.fillStyle = '#2a3b44'; c.fillRect(-w / 2, -h / 2, w, h);
    c.fillStyle = '#3f5a66'; c.fillRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8);
    c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.moveTo(-w / 2 + 4, h / 2 - 4); c.lineTo(2, -h / 2 + 4); c.lineTo(w / 2 - 4, -h / 2 + 4); c.closePath(); c.fill();
    c.strokeStyle = C.out; c.lineWidth = 3; c.strokeRect(-w / 2, -h / 2, w, h); c.beginPath(); c.moveTo(0, -h / 2); c.lineTo(0, h / 2); c.moveTo(-w / 2, 0); c.lineTo(w / 2, 0); c.stroke();
    c.restore();
  };
  Renderer.prototype._wallPic = function (c, P0, P1, wall, f) {
    var x = P0.x + (P1.x - P0.x) * f, y = P0.y + (P1.y - P0.y) * f, s = this.TW * 0.4;
    c.save(); c.translate(x, y - wall * 0.6); c.rotate(-0.06);
    c.fillStyle = '#caa46a'; c.fillRect(-s / 2, -s / 2, s, s);
    c.fillStyle = '#3a2c4a'; c.fillRect(-s / 2 + 5, -s / 2 + 5, s - 10, s - 10);
    c.fillStyle = C.toxic; c.font = 'bold ' + (s * 0.5) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('☠', 0, 2);
    c.strokeStyle = C.out; c.lineWidth = 3; c.strokeRect(-s / 2, -s / 2, s, s); c.restore();
  };
  Renderer.prototype._floor = function (c) {
    var W = Wld.W, H = Wld.H, T = Wld.TILE;
    c.save(); this._roomPath(c); c.clip();
    for (var gy = 0; gy < H; gy += T) for (var gx = 0; gx < W; gx += T) {
      var cx = gx + T / 2, cy = gy + T / 2, p = this.project(cx, cy);
      var even = ((gx / T) + (gy / T)) % 2 === 0;
      c.fillStyle = even ? C.floorL : C.floorD;
      c.beginPath();
      c.moveTo(p.x, p.y - this.TH / 2); c.lineTo(p.x + this.TW / 2, p.y); c.lineTo(p.x, p.y + this.TH / 2); c.lineTo(p.x - this.TW / 2, p.y); c.closePath(); c.fill();
      c.strokeStyle = C.grout; c.lineWidth = 1.2; c.stroke();
      // a little grime / slime per some tiles (deterministic by tile)
      var n = (gx * 13 + gy * 7) % 11;
      if (n === 0) { c.fillStyle = 'rgba(60,90,40,.35)'; blob(c, p.x + 6, p.y + 3, this.TW * 0.12); }
      else if (n === 3) { c.fillStyle = 'rgba(40,30,20,.30)'; blob(c, p.x - 8, p.y - 2, this.TW * 0.09); }
    }
    c.restore();
  };
  Renderer.prototype._grid = function (c, world, ui) {
    var cells = Wld.CELLS, sel = ui.selected ? ui.selected.id : null;
    for (var i = 0; i < cells.length; i++) {
      var p = this.project(cells[i].x, cells[i].y), free = world.cellFree(i, sel);
      c.fillStyle = free ? 'rgba(124,255,90,.16)' : 'rgba(216,65,58,.14)';
      c.strokeStyle = free ? 'rgba(124,255,90,.7)' : 'rgba(216,65,58,.5)';
      c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(p.x, p.y - this.TH / 2); c.lineTo(p.x + this.TW / 2, p.y); c.lineTo(p.x, p.y + this.TH / 2); c.lineTo(p.x - this.TW / 2, p.y); c.closePath(); c.fill(); c.stroke();
    }
  };
  Renderer.prototype._door = function (c) {
    var p = this.project(Wld.DOOR.x, Wld.DOOR.y), w = this.TW * 0.6, h = this.TW * 0.7;
    c.fillStyle = C.woodD; rr(c, p.x - w / 2, p.y - h, w, h, 6); c.fill();
    c.fillStyle = C.wood; rr(c, p.x - w / 2 + 5, p.y - h + 5, w - 10, h - 5, 4); c.fill();
    c.fillStyle = C.gold; circle(c, p.x + w / 2 - 12, p.y - h / 2, 3);
    c.fillStyle = '#caa46a'; c.font = 'bold ' + (this.TW * 0.14) + 'px system-ui'; c.textAlign = 'center'; c.fillText('OPEN', p.x, p.y - h - 6);
  };

  // ---- furniture ------------------------------------------------------
  Renderer.prototype._shadow = function (c, x, y, w) { c.fillStyle = 'rgba(0,0,0,.26)'; c.beginPath(); c.ellipse(x, y, w, w * 0.45, 0, 0, 7); c.fill(); };

  Renderer.prototype._pass = function (c, world) {
    var p = this.project(Wld.PASS.x, Wld.PASS.y), w = this.TW * 1.5, h = this.TH * 0.9, S = this.S;
    this._shadow(c, p.x, p.y + h * 0.5, w * 0.5);
    // steel counter (iso slab)
    c.fillStyle = C.steelD; iso(c, p.x, p.y + 8, w, h); c.fill();
    c.fillStyle = C.steel; iso(c, p.x, p.y, w, h); c.fill(); c.strokeStyle = C.out; c.lineWidth = S * 0.03; c.stroke();
    // ready dishes stacked
    var n = world.ready.length, show = Math.min(n, 5);
    for (var i = 0; i < show; i++) {
      var dx = p.x - (show - 1) * S * 0.16 + i * S * 0.32;
      c.fillStyle = '#eee'; c.beginPath(); c.ellipse(dx, p.y - 6, S * 0.13, S * 0.07, 0, 0, 7); c.fill();
      c.font = (S * 0.22) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText((recipe(world.ready[world.ready.length - 1 - i]) || {}).emoji || '🍽️', dx, p.y - 12);
    }
    if (n > 5) badge(c, p.x + w * 0.42, p.y - 14, '+' + (n - 5), C.blood, S);
    if (n === 0) { c.fillStyle = 'rgba(20,30,20,.5)'; c.font = 'bold ' + (S * 0.13) + 'px system-ui'; c.textAlign = 'center'; c.fillText('PASS', p.x, p.y); }
  };

  // pulsing valid-target marker shown while a zombie is selected
  Renderer.prototype._hl = function (c, x, y, w, t) {
    c.fillStyle = 'rgba(124,255,90,' + (0.16 + 0.1 * Math.sin(t * 5)) + ')';
    c.strokeStyle = 'rgba(124,255,90,.8)'; c.lineWidth = 2.5;
    iso(c, x, y, w, w * 0.5); c.fill(); c.stroke();
  };

  Renderer.prototype._table = function (c, tb, sel, t) {
    var p = this.project(tb.x, tb.y), S = this.S, lift = sel ? S * 0.18 : 0; var y = p.y - lift;
    if (this._selZ && tb.dirty && !tb.cleaning) this._hl(c, p.x, p.y + S * 0.08, S * 1.1, t || 0);
    // chairs (back then front drawn around)
    chair(c, p.x - S * 0.5, y - S * 0.12, S, 1);
    chair(c, p.x + S * 0.5, y - S * 0.12, S, 1);
    this._shadow(c, p.x, p.y + S * 0.18, S * 0.5);
    chair(c, p.x, y + S * 0.34, S, 0);
    // pedestal
    c.fillStyle = C.woodD; rr(c, p.x - S * 0.06, y - S * 0.05, S * 0.12, S * 0.32, 3); c.fill();
    // round top with cloth + checker
    c.fillStyle = C.woodD; c.beginPath(); c.ellipse(p.x, y + 4, S * 0.42, S * 0.22, 0, 0, 7); c.fill();
    c.fillStyle = C.cloth1; c.beginPath(); c.ellipse(p.x, y, S * 0.42, S * 0.22, 0, 0, 7); c.fill();
    c.save(); c.beginPath(); c.ellipse(p.x, y, S * 0.42, S * 0.22, 0, 0, 7); c.clip();
    c.fillStyle = 'rgba(255,255,255,.85)';
    for (var i = -3; i <= 3; i++) for (var j = -3; j <= 3; j++) if ((i + j) % 2 === 0) c.fillRect(p.x + i * S * 0.12, y + j * S * 0.07 - S * 0.03, S * 0.12, S * 0.07);
    c.restore();
    c.strokeStyle = C.out; c.lineWidth = S * 0.03; c.beginPath(); c.ellipse(p.x, y, S * 0.42, S * 0.22, 0, 0, 7); c.stroke();
    // a plate on top
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(p.x, y - 2, S * 0.12, S * 0.06, 0, 0, 7); c.fill();
    if (tb.dirty) {
      // grimy plate, scraps, green stain + buzzing flies
      c.fillStyle = '#7a5a2a'; circle(c, p.x, y - 3, S * 0.05); c.fillStyle = '#9bbf4a'; circle(c, p.x + S * 0.05, y - 1, S * 0.025);
      c.fillStyle = 'rgba(120,200,90,.22)'; c.beginPath(); c.ellipse(p.x, y, S * 0.2, S * 0.1, 0, 0, 7); c.fill();
      c.fillStyle = C.out; for (var fi = 0; fi < 3; fi++) { var a = (t || 0) * 3 + fi * 2.1; circle(c, p.x + Math.cos(a) * S * 0.16, y - S * 0.12 + Math.sin(a * 1.4) * S * 0.07, S * 0.013); }
      if (tb.cleaning) { c.fillStyle = '#bfe6ff'; c.font = (S * 0.18) + 'px system-ui'; c.textAlign = 'center'; c.fillText('✦', p.x - S * 0.12, y - S * 0.14); }
    }
    if (sel) selRing(c, p.x, y, S * 0.5);
  };

  Renderer.prototype._decor = function (c, d, sel) {
    var p = this.project(d.x, d.y), S = this.S, it = shop(d.deco) || {}, lift = sel ? S * 0.18 : 0, y = p.y - lift;
    this._shadow(c, p.x, p.y + S * 0.12, S * 0.32);
    c.lineWidth = S * 0.03; c.strokeStyle = C.out;
    switch (it.art) {
      case 'plant':
        c.fillStyle = '#7a4b2a'; rr(c, p.x - S * 0.16, y - S * 0.02, S * 0.32, S * 0.28, 4); c.fill(); c.stroke();
        c.fillStyle = '#2f8f3a'; circle(c, p.x, y - S * 0.28, S * 0.26); c.fillStyle = '#3fb04a'; circle(c, p.x - S * 0.14, y - S * 0.42, S * 0.16); circle(c, p.x + S * 0.14, y - S * 0.38, S * 0.14); c.strokeStyle = C.out; c.beginPath(); c.arc(p.x, y - S * 0.28, S * 0.26, 0, 7); c.stroke(); break;
      case 'lamp':
        c.strokeStyle = '#2a2a2a'; c.lineWidth = S * 0.05; line(c, p.x, y + S * 0.3, p.x, y - S * 0.4);
        c.fillStyle = C.gold; c.beginPath(); c.moveTo(p.x - S * 0.26, y - S * 0.34); c.lineTo(p.x + S * 0.26, y - S * 0.34); c.lineTo(p.x + S * 0.16, y - S * 0.64); c.lineTo(p.x - S * 0.16, y - S * 0.64); c.closePath(); c.fill(); c.strokeStyle = C.out; c.lineWidth = S * 0.03; c.stroke();
        c.fillStyle = 'rgba(255,207,77,.22)'; circle(c, p.x, y - S * 0.3, S * 0.5); break;
      case 'rug':
        c.fillStyle = '#7a1f24'; iso(c, p.x, y, S * 1.1, S * 0.55); c.fill(); c.stroke();
        c.strokeStyle = C.gold; c.lineWidth = S * 0.04; iso(c, p.x, y, S * 0.8, S * 0.4); c.stroke(); break;
      case 'jukebox':
        c.fillStyle = '#5a2a6a'; rr(c, p.x - S * 0.24, y - S * 0.66, S * 0.48, S * 0.84, 8); c.fill(); c.stroke();
        c.fillStyle = C.gold; rr(c, p.x - S * 0.16, y - S * 0.58, S * 0.32, S * 0.22, 4); c.fill();
        c.fillStyle = '#b06bff'; circle(c, p.x, y - S * 0.12, S * 0.12); break;
      case 'fountain':
        c.fillStyle = '#555'; c.beginPath(); c.ellipse(p.x, y + S * 0.1, S * 0.38, S * 0.2, 0, 0, 7); c.fill(); c.stroke();
        c.fillStyle = '#7a1f24'; c.beginPath(); c.ellipse(p.x, y + S * 0.04, S * 0.3, S * 0.15, 0, 0, 7); c.fill();
        c.fillStyle = C.blood; rr(c, p.x - S * 0.05, y - S * 0.34, S * 0.1, S * 0.4, 3); c.fill(); circle(c, p.x, y - S * 0.34, S * 0.09); break;
      case 'counter':
        c.fillStyle = C.steelD; rr(c, p.x - S * 0.34, y - S * 0.18, S * 0.68, S * 0.34, 5); c.fill(); c.stroke();
        c.fillStyle = C.steel; rr(c, p.x - S * 0.34, y - S * 0.18, S * 0.68, S * 0.1, 5); c.fill();
        c.fillStyle = '#7a5a2a'; circle(c, p.x - S * 0.12, y - S * 0.08, S * 0.04); c.fillStyle = '#9bbf4a'; circle(c, p.x + S * 0.1, y - S * 0.05, S * 0.03); break;
      case 'sink':
        c.fillStyle = C.steelD; rr(c, p.x - S * 0.3, y - S * 0.2, S * 0.6, S * 0.36, 5); c.fill(); c.stroke();
        c.fillStyle = '#2c3a3f'; rr(c, p.x - S * 0.2, y - S * 0.12, S * 0.4, S * 0.18, 4); c.fill();
        c.strokeStyle = C.steel; c.lineWidth = S * 0.04; c.beginPath(); c.moveTo(p.x, y - S * 0.12); c.lineTo(p.x, y - S * 0.3); c.lineTo(p.x + S * 0.1, y - S * 0.3); c.stroke();
        c.fillStyle = 'rgba(120,200,255,.5)'; circle(c, p.x, y - S * 0.02, S * 0.05); break;
      case 'trash':
        c.fillStyle = '#3a4a32'; rr(c, p.x - S * 0.16, y - S * 0.2, S * 0.32, S * 0.36, 4); c.fill(); c.stroke();
        c.fillStyle = '#5a6a42'; rr(c, p.x - S * 0.19, y - S * 0.24, S * 0.38, S * 0.07, 3); c.fill();
        c.fillStyle = '#9bbf4a'; circle(c, p.x + S * 0.04, y - S * 0.28, S * 0.05); c.fillStyle = '#b04a2a'; circle(c, p.x - S * 0.06, y - S * 0.27, S * 0.04);
        c.fillStyle = C.out; for (var ti = 0; ti < 2; ti++) { var ta = (this._t || 0) * 3 + ti * 3; circle(c, p.x + Math.cos(ta) * S * 0.16, y - S * 0.3 + Math.sin(ta * 1.4) * S * 0.06, S * 0.012); } break;
      case 'rest':
        c.fillStyle = C.woodD; iso(c, p.x, y + S * 0.02, S * 0.9, S * 0.42); c.fill(); c.stroke();
        c.fillStyle = '#3a2a44'; rr(c, p.x - S * 0.28, y - S * 0.14, S * 0.56, S * 0.18, 5); c.fill();
        c.fillStyle = '#cfc0e0'; rr(c, p.x + S * 0.12, y - S * 0.18, S * 0.16, S * 0.1, 3); c.fill();    // pillow
        c.fillStyle = C.gold; c.font = (S * 0.16) + 'px system-ui'; c.textAlign = 'center'; c.fillText('✝', p.x - S * 0.18, y - S * 0.16); break;
      default: c.fillStyle = '#556'; rr(c, p.x - S * 0.2, y - S * 0.2, S * 0.4, S * 0.4, 6); c.fill(); c.stroke();
    }
    if (sel) selRing(c, p.x, y, S * 0.4);
  };

  Renderer.prototype._stove = function (c, st, world, t, sel) {
    var p = this.project(st.x, st.y), S = this.S, x = p.x, y = p.y;
    if (this._selZ && (st.ready || st.burned)) this._hl(c, x, y + S * 0.2, S * 1.05, t);
    this._shadow(c, x, y + S * 0.16, S * 0.4);
    if (st.ready && !st.burning) { c.fillStyle = 'rgba(124,255,90,' + (0.2 + 0.12 * Math.sin(t * 5)) + ')'; rr(c, x - S * 0.5, y - S * 0.72, S, S * 0.95, 12); c.fill(); }
    if (st.burning || st.burned) { c.fillStyle = 'rgba(216,65,58,' + (0.22 + 0.14 * Math.sin(t * 7)) + ')'; rr(c, x - S * 0.5, y - S * 0.72, S, S * 0.95, 12); c.fill(); }
    // body
    c.fillStyle = sel ? '#566' : C.steelD; rr(c, x - S * 0.42, y - S * 0.5, S * 0.84, S * 0.66, 8); c.fill();
    c.fillStyle = C.steel; rr(c, x - S * 0.42, y - S * 0.5, S * 0.84, S * 0.2, 8); c.fill();
    c.strokeStyle = C.out; c.lineWidth = S * 0.035; rr(c, x - S * 0.42, y - S * 0.5, S * 0.84, S * 0.66, 8); c.stroke();
    // oven door + window
    c.fillStyle = '#23262a'; rr(c, x - S * 0.3, y - S * 0.26, S * 0.6, S * 0.36, 5); c.fill();
    c.fillStyle = '#3a3f45'; rr(c, x - S * 0.22, y - S * 0.2, S * 0.44, S * 0.24, 4); c.fill();
    // knobs
    c.fillStyle = C.gold; circle(c, x - S * 0.28, y - S * 0.4, S * 0.04); circle(c, x - S * 0.14, y - S * 0.4, S * 0.04);
    var r = recipe(st.recipe) || { time: 1, emoji: '🍳', batch: 0 };
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (st.burned) {
      // charred lump + rising smoke + a red CLEAR tag (Phase 4 burn state)
      smoke(c, x, y - S * 0.3, S, t, '#555');
      c.fillStyle = '#1c1c1c'; circle(c, x, y - S * 0.26, S * 0.12); c.fillStyle = '#333'; circle(c, x - S * 0.06, y - S * 0.3, S * 0.06);
      c.fillStyle = C.blood; rr(c, x - S * 0.4, y - S * 0.7, S * 0.8, S * 0.2, 6); c.fill();
      c.fillStyle = '#fff'; c.font = 'bold ' + (S * 0.13) + 'px system-ui'; c.fillText('🔥 CLEAR', x, y - S * 0.6);
    } else if (st.ready) {
      if (st.burning) smoke(c, x, y - S * 0.34, S, t, '#777');
      c.fillStyle = '#54585c'; rr(c, x - S * 0.16, y - S * 0.36, S * 0.32, S * 0.16, 4); c.fill();
      c.font = (S * 0.26) + 'px system-ui'; c.fillStyle = '#fff'; c.fillText(r.emoji, x, y - S * 0.28);
      var rdy = st.burning ? C.blood : C.toxic;
      c.fillStyle = rdy; rr(c, x - S * 0.36, y - S * 0.7, S * 0.72, S * 0.2, 6); c.fill();
      c.fillStyle = st.burning ? '#fff' : '#07210a'; c.font = 'bold ' + (S * 0.13) + 'px system-ui'; c.fillText(st.burning ? '⚠ BURNING' : 'SERVE ▸', x, y - S * 0.6);
      if (r.batch) badge(c, x + S * 0.34, y - S * 0.66, '' + r.batch, C.blood, S);
    } else if (st.recipe) {
      for (var i = -1; i <= 1; i++) { c.fillStyle = i === 0 ? '#ffb43d' : '#ff7a2d'; circle(c, x + i * S * 0.1, y - S * 0.18 + Math.sin(t * 9 + i) * 2, S * 0.07); }
      c.fillStyle = '#54585c'; rr(c, x - S * 0.16, y - S * 0.34, S * 0.32, S * 0.16, 4); c.fill();
      c.font = (S * 0.22) + 'px system-ui'; c.fillStyle = '#fff'; c.fillText(r.emoji, x, y - S * 0.26);
      var frac = Math.min(1, (world.t - st.start) / r.time);
      c.fillStyle = '#0c140e'; rr(c, x - S * 0.36, y - S * 0.66, S * 0.72, S * 0.1, 4); c.fill();
      c.fillStyle = C.toxic; rr(c, x - S * 0.36, y - S * 0.66, S * 0.72 * frac, S * 0.1, 4); c.fill();
    } else {
      c.fillStyle = C.toxic; c.font = 'bold ' + (S * 0.3) + 'px system-ui'; c.fillText('+', x, y - S * 0.2);
      c.fillStyle = 'rgba(230,243,231,.6)'; c.font = 'bold ' + (S * 0.12) + 'px system-ui'; c.fillText('COOK', x, y - S * 0.02);
    }
    if (sel) selRing(c, x, y - S * 0.15, S * 0.5);
  };

  // ---- characters -----------------------------------------------------
  function facing(e) { return e.face === 'L' ? -1 : e.face === 'R' ? 1 : 0; }

  Renderer.prototype._zombie = function (c, z, t) {
    var p = this.project(z.x, z.y), S = this.S, walk = (z.state !== 'idle');
    var selMe = this._selZ === z.id;
    var bob = Math.sin(z.step * 2) * (walk ? S * 0.04 : S * 0.012) + (selMe ? Math.abs(Math.sin(t * 6)) * S * 0.05 : 0);
    var x = p.x, y = p.y - bob, lx = facing(z);
    if (selMe) {
      c.strokeStyle = C.toxic; c.lineWidth = S * 0.06;
      c.beginPath(); c.ellipse(p.x, p.y + S * 0.05, S * 0.3 + Math.sin(t * 5) * S * 0.02, S * 0.15, 0, 0, 7); c.stroke();
    }
    this._shadow(c, p.x, p.y + S * 0.04, S * 0.26);
    var sw = Math.sin(z.step * 2) * (walk ? S * 0.08 : 0);
    // legs
    stroke(c, C.zSkinD, S * 0.1); line(c, x - S * 0.07, y - S * 0.02, x - S * 0.07 + sw, y + S * 0.16); line(c, x + S * 0.07, y - S * 0.02, x + S * 0.07 - sw, y + S * 0.16);
    // body (apron)
    body(c, x, y - S * 0.18, S * 0.34, S * 0.4, C.zSkin);
    c.fillStyle = C.apron; rr(c, x - S * 0.13, y - S * 0.28, S * 0.26, S * 0.34, 5); c.fill(); c.strokeStyle = C.out; c.lineWidth = S * 0.025; c.stroke();
    // arms (carry forward if holding a plate)
    stroke(c, C.zSkin, S * 0.085);
    if (z.carry || z.carryBatch) { line(c, x - S * 0.16, y - S * 0.3, x - S * 0.24, y - S * 0.42); line(c, x + S * 0.16, y - S * 0.3, x + S * 0.24, y - S * 0.42); }
    else { line(c, x - S * 0.16, y - S * 0.3, x - S * 0.22, y - S * 0.12); line(c, x + S * 0.16, y - S * 0.3, x + S * 0.22, y - S * 0.12); }
    // big head
    var hy = y - S * 0.56;
    c.fillStyle = C.zSkin; circle(c, x, hy, S * 0.22); c.strokeStyle = C.out; c.lineWidth = S * 0.03; c.beginPath(); c.arc(x, hy, S * 0.22, 0, 7); c.stroke();
    c.fillStyle = C.zSkinD; c.beginPath(); c.arc(x, hy, S * 0.22, 0.3, Math.PI - 0.3); c.fill();      // jaw shade
    // tired eyes
    c.fillStyle = '#fff'; circle(c, x - S * 0.08 + lx * S * 0.02, hy - S * 0.02, S * 0.055); circle(c, x + S * 0.08 + lx * S * 0.02, hy - S * 0.02, S * 0.055);
    c.fillStyle = C.out; circle(c, x - S * 0.08 + lx * S * 0.03, hy - S * 0.01, S * 0.025); circle(c, x + S * 0.08 + lx * S * 0.03, hy - S * 0.01, S * 0.025);
    c.strokeStyle = C.out; c.lineWidth = S * 0.018; line(c, x - S * 0.13, hy - S * 0.08, x - S * 0.03, hy - S * 0.06); line(c, x + 0.03 * S, hy - S * 0.06, x + S * 0.13, hy - S * 0.08);
    // teeth grin + drool
    c.fillStyle = '#2a160f'; rr(c, x - S * 0.08, hy + S * 0.06, S * 0.16, S * 0.05, 2); c.fill();
    c.fillStyle = '#fff'; for (var i = 0; i < 3; i++) c.fillRect(x - S * 0.07 + i * S * 0.05, hy + S * 0.06, S * 0.03, S * 0.05);
    c.fillStyle = '#bfe6c0'; circle(c, x + S * 0.06, hy + S * 0.13, S * 0.018);
    // chef hat
    c.fillStyle = C.hat; rr(c, x - S * 0.14, hy - S * 0.3, S * 0.28, S * 0.12, 4); c.fill(); circle(c, x - S * 0.1, hy - S * 0.32, S * 0.07); circle(c, x, hy - S * 0.35, S * 0.08); circle(c, x + S * 0.1, hy - S * 0.32, S * 0.07); c.strokeStyle = C.out; c.lineWidth = S * 0.02; c.beginPath(); c.rect(x - S * 0.14, hy - S * 0.22, S * 0.28, S * 0.05); c.stroke();
    // rarity gem on the apron
    if (z.rarity && z.rarity !== 'common') { c.fillStyle = z.rarity === 'elite' ? C.gold : '#7fd0ff'; circle(c, x, y - S * 0.2, S * 0.035); }
    // energy bar when tired-ish
    if (z.energy < 65) { var bw = S * 0.42; c.fillStyle = 'rgba(0,0,0,.55)'; rr(c, x - bw / 2, hy - S * 0.42, bw, S * 0.07, 3); c.fill(); var ef = Math.max(0, z.energy) / 100; c.fillStyle = z.energy > 45 ? C.toxic : z.energy > 22 ? C.gold : C.blood; rr(c, x - bw / 2, hy - S * 0.42, bw * ef, S * 0.07, 3); c.fill(); }
    // status / carry bubble
    if (z.state === 'daydream') bubble(c, x, y - S * 0.95, '💭', '#cfe', S);
    else if (z.state === 'resting') bubble(c, x, y - S * 0.95, '💤', '#cfe', S);
    else if (z.state === 'cleaning' || z.state === 'toClean') bubble(c, x, y - S * 0.95, '🧽', '#fff', S);
    else if (z.carry) bubble(c, x, y - S * 0.95, (recipe(z.carry) || {}).emoji || '🍽️', '#fff', S);
    else if (z.carryBatch) bubble(c, x, y - S * 0.95, (recipe(z.carryBatch.id) || {}).emoji || '🍽️', '#fff', S);
  };

  Renderer.prototype._customer = function (c, cu, world, t) {
    var p = this.project(cu.x, cu.y), S = this.S, sitting = (cu.state === 'eating' || cu.state === 'paying' || cu.state === 'waiting');
    var walk = (cu.state === 'toTable' || cu.state === 'leaving');
    var bob = Math.sin(cu.step * 2) * (walk ? S * 0.04 : 0);
    var x = p.x, y = p.y - bob - (sitting ? S * 0.04 : 0), lx = facing(cu);
    if (this._selZ && cu.state === 'waiting' && !cu.assigned && this._foodReady) this._hl(c, p.x, p.y + S * 0.06, S * 0.8, t);
    this._shadow(c, p.x, p.y + S * 0.04, S * 0.24);
    var sw = Math.sin(cu.step * 2) * (walk ? S * 0.08 : 0);
    stroke(c, '#33363a', S * 0.09); line(c, x - S * 0.06, y - S * 0.02, x - S * 0.06 + sw, y + S * 0.15); line(c, x + S * 0.06, y - S * 0.02, x + S * 0.06 - sw, y + S * 0.15);
    body(c, x, y - S * 0.18, S * 0.3, S * 0.36, cu.color);
    stroke(c, cu.color, S * 0.08); line(c, x - S * 0.14, y - S * 0.28, x - S * 0.2, y - S * 0.12); line(c, x + S * 0.14, y - S * 0.28, x + S * 0.2, y - S * 0.12);
    var hy = y - S * 0.52;
    c.fillStyle = cu.skin; circle(c, x, hy, S * 0.2); c.strokeStyle = C.out; c.lineWidth = S * 0.03; c.beginPath(); c.arc(x, hy, S * 0.2, 0, 7); c.stroke();
    // hair
    c.fillStyle = cu.hair || '#2b2b2b'; c.beginPath(); c.arc(x, hy - S * 0.04, S * 0.2, Math.PI + 0.3, 2 * Math.PI - 0.3); c.fill();
    this._hat(c, cu.hat, x, hy, S);
    // eyes + expression
    c.fillStyle = '#fff'; circle(c, x - S * 0.07 + lx * S * 0.02, hy, S * 0.05); circle(c, x + S * 0.07 + lx * S * 0.02, hy, S * 0.05);
    c.fillStyle = C.out; circle(c, x - S * 0.07 + lx * S * 0.03, hy + S * 0.005, S * 0.022); circle(c, x + S * 0.07 + lx * S * 0.03, hy + S * 0.005, S * 0.022);
    var angry = cu.state === 'waiting' && (world.t - cu.wait) > world.patience() * 0.6;
    c.strokeStyle = C.out; c.lineWidth = S * 0.022; c.beginPath();
    if (cu.state === 'paying' || cu.state === 'eating') { c.arc(x, hy + S * 0.06, S * 0.06, 0.15 * Math.PI, 0.85 * Math.PI); }      // smile
    else if (angry) { c.moveTo(x - S * 0.06, hy + S * 0.1); c.lineTo(x + S * 0.06, hy + S * 0.1); c.moveTo(x - S * 0.11, hy - S * 0.06); c.lineTo(x - S * 0.03, hy - S * 0.03); c.moveTo(x + S * 0.03, hy - S * 0.03); c.lineTo(x + S * 0.11, hy - S * 0.06); }
    else { c.moveTo(x - S * 0.04, hy + S * 0.08); c.lineTo(x + S * 0.04, hy + S * 0.08); }
    c.stroke();
    // thought bubble
    if (cu.state === 'waiting') {
      var pat0 = world.custPatience ? world.custPatience(cu) : world.patience();
      bubble(c, x + S * 0.28, y - S * 0.78, cu.infectable ? '🧟' : (angry ? '😠' : '🍴'), cu.infectable ? C.toxic : '#fff', S);
      var pat = 1 - Math.min(1, (world.t - cu.wait) / pat0);
      ring(c, x + S * 0.28, y - S * 0.55, S * 0.1, pat, pat > 0.4 ? C.toxic : pat > 0.18 ? C.gold : C.blood, S);
    } else if (cu.state === 'queued') bubble(c, x + S * 0.28, y - S * 0.78, cu.annoyed ? '😠' : '🪑', cu.annoyed ? C.blood : '#fff', S);
    else if (cu.state === 'eating') bubble(c, x + S * 0.28, y - S * 0.78, (recipe(cu.dish) || {}).emoji || '🍽️', '#fff', S);
    else if (cu.state === 'paying') bubble(c, x + S * 0.28, y - S * 0.78, cu.tipped ? '💰' : '🪙', C.gold, S);
  };

  // little type-defining hats, drawn over the head at (x, hy)
  Renderer.prototype._hat = function (c, hat, x, hy, S) {
    if (!hat) return;
    c.strokeStyle = C.out; c.lineWidth = S * 0.025;
    if (hat === 'hardhat') { c.fillStyle = '#ffcf3a'; c.beginPath(); c.arc(x, hy - S * 0.06, S * 0.19, Math.PI, 2 * Math.PI); c.fill(); c.fillRect(x - S * 0.22, hy - S * 0.08, S * 0.44, S * 0.04); }
    else if (hat === 'chef') { c.fillStyle = '#fff'; rr(c, x - S * 0.16, hy - S * 0.26, S * 0.32, S * 0.16, 4); c.fill(); circle(c, x - S * 0.1, hy - S * 0.28, S * 0.08); circle(c, x + S * 0.1, hy - S * 0.28, S * 0.08); circle(c, x, hy - S * 0.32, S * 0.09); }
    else if (hat === 'visor') { c.fillStyle = '#2fa84f'; c.beginPath(); c.arc(x, hy - S * 0.02, S * 0.2, Math.PI, 2 * Math.PI); c.fill(); c.fillStyle = '#1b6e33'; rr(c, x - S * 0.04, hy - S * 0.2, S * 0.28, S * 0.06, 3); c.fill(); }
    else if (hat === 'sun') { c.fillStyle = '#f2d06b'; c.beginPath(); c.ellipse(x, hy - S * 0.06, S * 0.3, S * 0.09, 0, 0, 7); c.fill(); c.stroke(); circle(c, x, hy - S * 0.14, S * 0.13); }
    else if (hat === 'mohawk') { c.fillStyle = '#d8413a'; for (var i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + i * S * 0.05, hy - S * 0.16); c.lineTo(x + i * S * 0.05 - S * 0.02, hy - S * 0.34); c.lineTo(x + i * S * 0.05 + S * 0.03, hy - S * 0.16); c.fill(); } }
    else if (hat === 'tophat') { c.fillStyle = '#1c1c22'; c.fillRect(x - S * 0.22, hy - S * 0.12, S * 0.44, S * 0.04); rr(c, x - S * 0.14, hy - S * 0.4, S * 0.28, S * 0.3, 3); c.fill(); }
    else if (hat === 'wizard') { c.fillStyle = '#6a3fb0'; c.beginPath(); c.moveTo(x - S * 0.18, hy - S * 0.08); c.lineTo(x + S * 0.18, hy - S * 0.08); c.lineTo(x + S * 0.02, hy - S * 0.5); c.closePath(); c.fill(); c.fillStyle = C.gold; circle(c, x + S * 0.06, hy - S * 0.26, S * 0.025); }
  };

  // ---- primitives -----------------------------------------------------
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function iso(c, x, y, w, h) { c.beginPath(); c.moveTo(x, y - h / 2); c.lineTo(x + w / 2, y); c.lineTo(x, y + h / 2); c.lineTo(x - w / 2, y); c.closePath(); }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  function blob(c, x, y, r) { c.beginPath(); c.ellipse(x, y, r, r * 0.6, 0, 0, 7); c.fill(); }
  function line(c, x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  // rising puffs of smoke for burning/burnt food
  function smoke(c, x, y, S, t, col) {
    for (var i = 0; i < 3; i++) {
      var ph = (t * 0.9 + i * 0.5) % 1, yy = y - ph * S * 0.7, xx = x + Math.sin((t + i) * 2) * S * 0.1;
      c.fillStyle = 'rgba(' + (col === '#555' ? '70,70,70,' : '120,120,120,') + (0.5 * (1 - ph)) + ')';
      circle(c, xx, yy, S * (0.07 + ph * 0.12));
    }
  }
  function stroke(c, col, w) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; }
  function body(c, x, y, w, h, col) { c.fillStyle = col; rr(c, x - w / 2, y - h / 2, w, h, w * 0.4); c.fill(); c.strokeStyle = C.out; c.lineWidth = w * 0.09; c.stroke(); }
  function chair(c, x, y, S, back) { c.fillStyle = C.woodD; rr(c, x - S * 0.13, y - S * 0.1, S * 0.26, S * 0.18, 4); c.fill(); if (back) { c.fillStyle = C.wood; rr(c, x - S * 0.13, y - S * 0.32, S * 0.26, S * 0.12, 4); c.fill(); } c.strokeStyle = C.out; c.lineWidth = S * 0.02; rr(c, x - S * 0.13, y - S * 0.1, S * 0.26, S * 0.18, 4); c.stroke(); }
  function selRing(c, x, y, r) { c.strokeStyle = C.toxic; c.lineWidth = 3; c.setLineDash([7, 5]); c.beginPath(); c.arc(x, y, r + 6, 0, 7); c.stroke(); c.setLineDash([]); }
  function ring(c, x, y, r, frac, col, S) { c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = S * 0.04; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke(); c.strokeStyle = col; c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + frac * 2 * Math.PI); c.stroke(); }
  function bubble(c, x, y, txt, col, S) {
    c.fillStyle = col; circle(c, x, y, S * 0.18); c.fillStyle = '#fff'; circle(c, x, y, S * 0.15);
    c.fillStyle = col === '#fff' ? '#fff' : col; circle(c, x, y, S * 0.155); c.strokeStyle = C.out; c.lineWidth = S * 0.02; c.beginPath(); c.arc(x, y, S * 0.16, 0, 7); c.stroke();
    c.fillStyle = '#111'; c.font = (S * 0.2) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, x, y + 1);
    c.fillStyle = '#fff'; circle(c, x - S * 0.16, y + S * 0.16, S * 0.03); circle(c, x - S * 0.22, y + S * 0.22, S * 0.02);
  }
  function badge(c, x, y, txt, col, S) { c.fillStyle = col; circle(c, x, y, S * 0.13); c.strokeStyle = '#fff'; c.lineWidth = S * 0.02; c.beginPath(); c.arc(x, y, S * 0.13, 0, 7); c.stroke(); c.fillStyle = '#fff'; c.font = 'bold ' + (S * 0.16) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, x, y + 1); }

  window.Renderer = Renderer;
})();
