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
    out: '#15160f', floorL: '#8b9088', floorD: '#7c827a', grout: '#4f554c',
    // grimy warm walls (left lighter / right darker) like a dingy diner
    wallL: '#b89a3e', wallR: '#917529', wallTop: '#caa94a', skirt: '#2c3a2f',
    // exterior block
    grass: '#46622f', grassD: '#3a5328', grassL: '#577a39',
    road: '#5f625b', roadD: '#4d504a', roadLine: '#e3c14a',
    walk: '#9a9d92', walkD: '#80847b', walkSeam: '#6a6e64',
    slime: '#8fd13a', stain: '#6a4a26',
    zSkin: '#7fcf57', zSkinD: '#5aa83f', apron: '#d8d2c0', hat: '#f4f1e8',
    cloth1: '#c44', cloth2: '#eee', wood: '#7a5436', woodD: '#5d3f28',
    steel: '#9aa0a6', steelD: '#6c7176', gold: '#ffcf4d', toxic: '#7cff5a', blood: '#d8413a',
  };
  // deterministic value-noise rng (stable demo screenshots)
  function rnd(s) { var x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  function Renderer(canvas) { this.cv = canvas; this.ctx = canvas.getContext('2d'); this.resize(); }

  Renderer.prototype.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.dpr = dpr;
    var cw = this.cv.clientWidth || 360, ch = this.cv.clientHeight || 640;
    this.cv.width = Math.round(cw * dpr); this.cv.height = Math.round(ch * dpr);
    var cvW = this.cv.width, cvH = this.cv.height, W = Wld.W, H = Wld.H;
    var spanX = W + H;                                  // isoX ranges over [-H, W]
    var wallU = 210;                                    // wall height in KX units
    // Fill the screen: the world canvas is full-bleed and the HUD/rail/toolbar
    // overlay it, so the café is large with the block framing it (no black bars).
    var KXw = (cvW * 0.98) / spanX;                     // diamond width <= 98% screen
    var KXh = (cvH * 0.88) / (spanX * 0.56 + wallU);    // content height <= 88% screen
    var KX = Math.min(KXw, KXh);
    var KY = KX * 0.56, wall = KX * wallU;
    var contentH = spanX * KY + wall;
    this.KX = KX; this.KY = KY; this.wall = wall;
    this.OX = cvW / 2 + ((H - W) / 2) * KX;             // centre the diamond horizontally
    this.OY = (cvH - contentH) / 2 + wall + cvH * 0.03; // centre vertically, nudged down a touch
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
    this._ground(c);            // exterior: grass + road + sidewalk (textured)
    this._floor(c);             // grimy tiled floor + cutaway edge
    this._walls(c);             // grimy walls with thickness
    if (ui.edit) this._grid(c, world, ui);

    // depth-sorted drawables (sorted by base/foot Y so things overlap right)
    var self = this, items = [];
    this._custs = world.customers;
    function add(x, y, fn) { items.push({ d: x + y, fn: fn }); }
    function addD(d, fn) { items.push({ d: d, fn: fn }); }
    add(Wld.PASS.x, Wld.PASS.y - 1, function () { self._pass(c, world); });
    world.decors.forEach(function (d) { add(d.x, d.y, function () { self._decor(c, d, ui.selected && ui.selected.id === d.id); }); });
    world.tables.forEach(function (tb) {
      var selT = ui.selected && ui.selected.id === tb.id, d0 = tb.x + tb.y;
      addD(d0 - 6, function () { self._table(c, tb, selT, t); });             // legs + chairs
      addD(d0 + (tb.by ? 30 : 4), function () { self._tableTop(c, tb, selT, t); }); // top (occludes diner)
    });
    world.stoves.forEach(function (st) { add(st.x, st.y, function () { self._stove(c, st, world, t, ui.selected && ui.selected.id === st.id); }); });
    if (!ui.edit) {
      world.customers.forEach(function (cu) { add(cu.x, cu.y, function () { self._customer(c, cu, world, t); }); });
      world.zombies.forEach(function (z) { add(z.x, z.y, function () { self._zombie(c, z, t); }); });
    }
    items.sort(function (a, b) { return a.d - b.d; });
    items.forEach(function (it) { it.fn(); });
    if (ui.edit && ui.ghost && ui.ghost.cell >= 0) this._ghostCell(c, world, ui.ghost, t);
    if (ui.debugGrid) this._gridOverlay(c, world);
  };

  // ---- environment ----------------------------------------------------
  Renderer.prototype._diamond = function (c, x, y) { var p = this.project(x, y); c.lineTo(p.x, p.y); };
  Renderer.prototype._roomPath = function (c) {
    var W = Wld.W, H = Wld.H; c.beginPath();
    var a = this.project(0, 0); c.moveTo(a.x, a.y);
    this._diamond(c, W, 0); this._diamond(c, W, H); this._diamond(c, 0, H); c.closePath();
  };
  // fill a plane-aligned rectangle (projected to an iso quad)
  Renderer.prototype._planeRect = function (c, x0, y0, x1, y1) {
    var a = this.project(x0, y0), b = this.project(x1, y0), d = this.project(x1, y1), e = this.project(x0, y1);
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.lineTo(e.x, e.y); c.closePath();
  };
  // clip to a path, run a texture callback (bbox = whole canvas), then restore
  Renderer.prototype._tex = function (c, pathFn, texFn) {
    c.save(); pathFn.call(this); c.clip();
    texFn.call(this, { x: 0, y: 0, w: this.cv.width, h: this.cv.height });
    c.restore();
  };
  // The café sits inside a city block: concentric iso bands of grass → road →
  // grass verge → sidewalk → floor, so it never floats in empty space.
  Renderer.prototype._ground = function (c) {
    var self = this, W = Wld.W, H = Wld.H, cvW = this.cv.width, cvH = this.cv.height, T = Wld.TILE, S = this.S;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = C.grassD; c.fillRect(0, 0, cvW, cvH);   // grass base (no dark corners)
    // outer grass
    c.fillStyle = C.grass; this._planeRect(c, -T * 30, -T * 30, W + T * 30, H + T * 30); c.fill();
    this._tex(c, function () { this._planeRect(c, -T * 12, -T * 12, W + T * 12, H + T * 12); }, function (bb) {
      scatter(c, bb, 140, 7, function (x, y, r, i) { speck(c, x, y, S * (0.025 + r * 0.04), i % 3 ? C.grassD : C.grassL); });
    });
    // road ring (asphalt) + speckle
    c.fillStyle = C.road; this._planeRect(c, -T * 3.2, -T * 3.2, W + T * 3.2, H + T * 3.2); c.fill();
    this._tex(c, function () { this._planeRect(c, -T * 3.2, -T * 3.2, W + T * 3.2, H + T * 3.2); }, function (bb) {
      scatter(c, bb, 90, 21, function (x, y, r) { speck(c, x, y, S * 0.025, r > 0.5 ? C.roadD : '#6c6f68'); });
    });
    // dashed centre line around the block
    c.save(); c.strokeStyle = C.roadLine; c.lineWidth = Math.max(2, S * 0.05); c.setLineDash([S * 0.32, S * 0.34]);
    this._planeRect(c, -T * 2.0, -T * 2.0, W + T * 2.0, H + T * 2.0); c.stroke(); c.setLineDash([]); c.restore();
    // grass verge
    c.fillStyle = C.grassD; this._planeRect(c, -T * 1.1, -T * 1.1, W + T * 1.1, H + T * 1.1); c.fill();
    // sidewalk ring with slab seams + cracks
    c.fillStyle = C.walk; this._planeRect(c, -T * 0.55, -T * 0.55, W + T * 0.55, H + T * 0.55); c.fill();
    this._tex(c, function () { this._planeRect(c, -T * 0.55, -T * 0.55, W + T * 0.55, H + T * 0.55); }, function (bb) {
      c.strokeStyle = C.walkSeam; c.lineWidth = Math.max(1.2, S * 0.02);
      for (var s = -1; s <= Math.ceil((W + T) / T) + 1; s++) { var p = self.project(s * T, -T); var q = self.project(s * T, H + T); line(c, p.x, p.y, q.x, q.y); var p2 = self.project(-T, s * T); var q2 = self.project(W + T, s * T); line(c, p2.x, p2.y, q2.x, q2.y); }
      scatter(c, bb, 16, 33, function (x, y, r) { crackLine(c, x, y, S * 0.5, r * 6.28, S * 0.015, C.walkD); });
    });
    // a contact drop-shadow just inside the sidewalk so the building sits down
    c.fillStyle = 'rgba(0,0,0,.18)'; this._planeRect(c, -T * 0.18, -T * 0.18, W + T * 0.18, H + T * 0.18); c.fill();
  };
  Renderer.prototype._walls = function (c) {
    var self = this, W = Wld.W, H = Wld.H, wall = this.wall, S = this.S, th = S * 0.12;
    var A = this.project(0, 0), B = this.project(W, 0), D = this.project(0, H);
    // wall TOP caps (thickness slabs) so the walls read as solid
    c.fillStyle = '#7b6320';
    c.beginPath(); c.moveTo(A.x, A.y - wall); c.lineTo(B.x, B.y - wall); c.lineTo(B.x + th, B.y - wall - th * 0.5); c.lineTo(A.x, A.y - wall - th); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(A.x, A.y - wall); c.lineTo(D.x, D.y - wall); c.lineTo(D.x - th, D.y - wall - th * 0.5); c.lineTo(A.x, A.y - wall - th); c.closePath(); c.fill();
    // right-back wall (edge A-B) — grimy
    c.fillStyle = C.wallR;
    c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.lineTo(B.x, B.y - wall); c.lineTo(A.x, A.y - wall); c.closePath(); c.fill();
    this._wallGrime(c, A, B, wall, 71);
    this._wallWindow(c, B, A, wall, 0.55);
    // left-back wall (edge A-D) — grimier (it's the darker/shaded side)
    c.fillStyle = C.wallL;
    c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(D.x, D.y); c.lineTo(D.x, D.y - wall); c.lineTo(A.x, A.y - wall); c.closePath(); c.fill();
    this._wallGrime(c, A, D, wall, 97);
    this._wallBoards(c, A, D, wall, 0.28);
    this._doorway(c);                                   // entrance cut into the left wall
    // ambient occlusion in the inner corner
    var g = c.createLinearGradient(A.x, A.y - wall, A.x, A.y); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.28)');
    c.fillStyle = g; c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.lineTo(B.x, B.y - wall); c.lineTo(A.x, A.y - wall); c.lineTo(D.x, D.y - wall); c.lineTo(D.x, D.y); c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(A.x - th * 0.5, A.y - wall, th, wall);   // corner seam shadow
    // skirting
    c.strokeStyle = C.skirt; c.lineWidth = Math.max(3, this.KX * 16);
    c.beginPath(); c.moveTo(B.x, B.y); c.lineTo(A.x, A.y); c.lineTo(D.x, D.y); c.stroke();
  };
  // grime on one wall face (edge P0->P1, extruded up by `wall`): stains, cracks, slime drips
  Renderer.prototype._wallGrime = function (c, P0, P1, wall, seed) {
    var self = this, S = this.S;
    c.save();
    c.beginPath(); c.moveTo(P0.x, P0.y); c.lineTo(P1.x, P1.y); c.lineTo(P1.x, P1.y - wall); c.lineTo(P0.x, P0.y - wall); c.closePath(); c.clip();
    for (var i = 0; i < 7; i++) {
      var f = rnd(seed + i), x = P0.x + (P1.x - P0.x) * f, y0 = P0.y + (P1.y - P0.y) * f;
      var yy = y0 - wall * (0.2 + rnd(seed + i + 3) * 0.7);
      if (i % 3 === 0) drip(c, x, yy - wall * 0.1, wall * (0.2 + rnd(seed + i) * 0.3), S * 0.04, 'rgba(110,170,40,.55)');   // slime drip
      else if (i % 3 === 1) crackLine(c, x, yy, wall * 0.5, 1.3 + rnd(seed + i), S * 0.014, 'rgba(20,16,8,.5)');           // crack
      else stainBlob(c, x, yy, S * (0.12 + rnd(seed + i) * 0.16), 'rgba(60,42,20,.32)');                                    // brown stain
    }
    // chipped plaster patches (lighter)
    c.fillStyle = 'rgba(220,205,150,.18)'; stainBlob(c, P0.x + (P1.x - P0.x) * 0.3, P0.y - wall * 0.5, S * 0.18, 'rgba(220,205,150,.16)');
    c.restore();
  };
  // boarded-up patch on a wall (planks over a hole)
  Renderer.prototype._wallBoards = function (c, P0, P1, wall, f) {
    var x = P0.x + (P1.x - P0.x) * f, y = P0.y + (P1.y - P0.y) * f - wall * 0.42, S = this.S;
    c.save(); c.translate(x, y); c.rotate(((P1.y - P0.y) < 0 ? 1 : -1) * 0.0);
    for (var i = -1; i <= 1; i++) { c.save(); c.rotate(i * 0.08); c.fillStyle = i ? C.woodD : C.wood; rr(c, -S * 0.26, i * S * 0.14 - S * 0.05, S * 0.52, S * 0.12, 2); c.fill(); c.strokeStyle = C.out; c.lineWidth = S * 0.018; c.stroke(); c.fillStyle = '#2a2018'; circle(c, -S * 0.2, i * S * 0.14 + S * 0.01, S * 0.015); circle(c, S * 0.2, i * S * 0.14 + S * 0.01, S * 0.015); c.restore(); }
    c.restore();
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
    var self = this, W = Wld.W, H = Wld.H, T = Wld.TILE, S = this.S;
    // cutaway edge: a dark slab dropping below the two open front edges
    var drop = S * 0.22, fl = this.project(0, H), fr = this.project(W, H), fb = this.project(W, H);
    var lEdge = this.project(0, H), bot = this.project(W, H), rEdge = this.project(W, H);
    var pL = this.project(0, H), pB = this.project(W, H);
    // front-left face (edge from (0,H) to (W,H)) and front-right (W,0)->(W,H)
    c.fillStyle = '#3a4038';
    var aa = this.project(0, H), bb2 = this.project(W, H), cc = this.project(W, 0);
    c.beginPath(); c.moveTo(aa.x, aa.y); c.lineTo(bb2.x, bb2.y); c.lineTo(bb2.x, bb2.y + drop); c.lineTo(aa.x, aa.y + drop); c.closePath(); c.fill();
    c.fillStyle = '#2f342d';
    c.beginPath(); c.moveTo(bb2.x, bb2.y); c.lineTo(cc.x, cc.y); c.lineTo(cc.x, cc.y + drop); c.lineTo(bb2.x, bb2.y + drop); c.closePath(); c.fill();

    c.save(); this._roomPath(c); c.clip();
    for (var gy = 0; gy < H; gy += T) for (var gx = 0; gx < W; gx += T) {
      var cx = gx + T / 2, cy = gy + T / 2, p = this.project(cx, cy);
      var even = ((gx / T) + (gy / T)) % 2 === 0, wear = rnd(gx * 1.3 + gy * 0.7);
      c.fillStyle = even ? C.floorL : C.floorD;
      c.beginPath();
      c.moveTo(p.x, p.y - this.TH / 2); c.lineTo(p.x + this.TW / 2, p.y); c.lineTo(p.x, p.y + this.TH / 2); c.lineTo(p.x - this.TW / 2, p.y); c.closePath(); c.fill();
      if (wear > 0.7) { c.fillStyle = 'rgba(40,44,38,' + (wear - 0.6) + ')'; c.fill(); }   // worn/dirty tiles
      c.strokeStyle = C.grout; c.lineWidth = 1.4; c.stroke();
    }
    // grime decals across the whole floor (deterministic) — stains, smears, cracks
    var bbF = { x: this.project(0, H).x - this.TW, y: this.project(W, 0).y, w: (this.project(W, H).x - this.project(0, H).x) + this.TW * 2, h: this.project(0, H).y - this.project(W, 0).y };
    scatter(c, bbF, 26, 51, function (x, y, r, i) {
      if (i % 4 === 0) stainBlob(c, x, y, S * (0.1 + r * 0.18), 'rgba(60,90,40,.28)');           // slime
      else if (i % 4 === 1) stainBlob(c, x, y, S * (0.08 + r * 0.14), 'rgba(50,34,20,.30)');       // grease
      else if (i % 4 === 2) crackLine(c, x, y, S * 0.6, r * 6.28, S * 0.012, 'rgba(20,22,18,.4)'); // crack
      else speck(c, x, y, S * 0.03, 'rgba(20,20,16,.5)');                                          // debris
    });
    // dirty trails near the kitchen wall + door
    c.fillStyle = 'rgba(45,40,30,.22)'; stainBlob(c, this.project(W * 0.5, T * 1.2).x, this.project(W * 0.5, T * 1.2).y, S * 0.6, 'rgba(45,40,30,.22)');
    c.restore();
  };
  // dev grid overlay — proves the tile-state model:
  // green=walkable, red=blocked, blue=occupied, yellow=reserved, cyan=door,
  // purple=chair seats (+ links to tables), orange=queue, gold=paths.
  Renderer.prototype._gridOverlay = function (c, world) {
    var COLS = Wld.COLS, ROWS = Wld.ROWS, T = Wld.TILE, self = this;
    var COL = { walkable: 'rgba(124,255,90,.1)', blocked: 'rgba(216,65,58,.36)', occupied: 'rgba(80,140,255,.4)', reserved: 'rgba(255,207,77,.4)', door: 'rgba(80,220,230,.4)', outsideCafe: 'rgba(60,60,60,.25)' };
    for (var r = 0; r < ROWS; r++) for (var col = 0; col < COLS; col++) {
      var st = world.tileState(col, r), p = this.project(col * T + T / 2, r * T + T / 2);
      c.fillStyle = COL[st] || COL.walkable; c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(p.x, p.y - this.TH / 2); c.lineTo(p.x + this.TW / 2, p.y); c.lineTo(p.x, p.y + this.TH / 2); c.lineTo(p.x - this.TW / 2, p.y); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.5)'; c.font = (this.S * 0.09) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(col + ',' + r, p.x, p.y);
    }
    // chair seats (purple) linked to their tables
    (world.chairs || []).forEach(function (ch) {
      var tb = world.tables.filter(function (t) { return t.id === ch.table; })[0]; if (!tb) return;
      var cp = self.project(ch.x, ch.y), tp = self.project(tb.x, tb.y);
      c.strokeStyle = 'rgba(176,107,255,.8)'; c.lineWidth = 2; line(c, cp.x, cp.y, tp.x, tp.y);
      var stt = world.chairState(ch);
      c.fillStyle = stt === 'occupied' ? '#5a8cff' : stt === 'reserved' ? C.gold : stt === 'blocked' ? C.blood : '#b06bff';
      circle(c, cp.x, cp.y, self.S * 0.06); c.strokeStyle = C.out; c.lineWidth = 1.5; c.beginPath(); c.arc(cp.x, cp.y, self.S * 0.06, 0, 7); c.stroke();
    });
    // queue slots (orange) for queued customers
    world.customers.forEach(function (cu) { if (cu.state !== 'queued') return; var qp = self.project(cu.fx, cu.fy); c.fillStyle = 'rgba(255,150,40,.6)'; circle(c, qp.x, qp.y, self.S * 0.05); });
    // active paths (gold)
    world.zombies.concat(world.customers).forEach(function (e) {
      if (!e.path || !e.path.length) return;
      c.strokeStyle = 'rgba(255,207,77,.9)'; c.lineWidth = 2.5; c.beginPath();
      var p0 = self.project(e.x, e.y); c.moveTo(p0.x, p0.y);
      e.path.forEach(function (w2) { var pp = self.project(w2.x, w2.y); c.lineTo(pp.x, pp.y); });
      c.stroke();
    });
    var d = this.project(Wld.DOOR.x, Wld.DOOR.y); c.fillStyle = 'rgba(80,220,230,.9)'; circle(c, d.x, d.y, this.S * 0.06);   // door
  };
  // live placement ghost: the hovered cell flashes green (valid) or red (invalid)
  Renderer.prototype._ghostCell = function (c, world, g, t) {
    var pos = g.stove ? Wld.STOVE_SLOTS[g.cell] : Wld.CELLS[g.cell]; if (!pos) return;
    var p = this.project(pos.x, pos.y), pulse = 0.28 + 0.14 * Math.sin(t * 6);
    c.fillStyle = g.ok ? 'rgba(124,255,90,' + pulse + ')' : 'rgba(216,65,58,' + pulse + ')';
    c.strokeStyle = g.ok ? 'rgba(124,255,90,.95)' : 'rgba(216,65,58,.95)'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(p.x, p.y - this.TH / 2); c.lineTo(p.x + this.TW / 2, p.y); c.lineTo(p.x, p.y + this.TH / 2); c.lineTo(p.x - this.TW / 2, p.y); c.closePath(); c.fill(); c.stroke();
    // a translucent piece marker floating on the cell
    c.globalAlpha = 0.55; c.fillStyle = '#fff'; c.font = (this.S * 0.3) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(g.ok ? '✅' : '⛔', p.x, p.y - this.S * 0.2); c.globalAlpha = 1;
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
  // The entrance is an OPENING cut into the LEFT wall (with daylight + a mat),
  // not a slab on the floor. Drawn as part of _walls so sprites pass in front.
  Renderer.prototype._doorway = function (c) {
    var S = this.S, wall = this.wall;
    var A = this.project(0, 0), D = this.project(0, Wld.H), f = Wld.DOOR.y / Wld.H;
    var Pb = { x: A.x + (D.x - A.x) * f, y: A.y + (D.y - A.y) * f };
    var ux = D.x - A.x, uy = D.y - A.y, ul = Math.hypot(ux, uy); ux /= ul; uy /= ul;
    // floor mat just inside the door
    var dp = this.project(Wld.DOOR.x + 30, Wld.DOOR.y);
    c.fillStyle = '#5a3a2a'; iso(c, dp.x, dp.y, S * 0.7, S * 0.36); c.fill();
    c.strokeStyle = C.out; c.lineWidth = S * 0.02; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.08)'; iso(c, dp.x, dp.y, S * 0.5, S * 0.26); c.fill();
    // doorway opening
    var hw = S * 0.34, dh = wall * 0.84;
    var b1 = { x: Pb.x - ux * hw, y: Pb.y - uy * hw }, b2 = { x: Pb.x + ux * hw, y: Pb.y + uy * hw };
    var t1 = { x: b1.x, y: b1.y - dh }, t2 = { x: b2.x, y: b2.y - dh };
    var g = c.createLinearGradient(0, t1.y, 0, Math.max(b1.y, b2.y)); g.addColorStop(0, '#88937d'); g.addColorStop(0.55, '#9aa39a'); g.addColorStop(1, '#6a6048');
    c.fillStyle = g; c.beginPath(); c.moveTo(b1.x, b1.y); c.lineTo(b2.x, b2.y); c.lineTo(t2.x, t2.y); c.lineTo(t1.x, t1.y); c.closePath(); c.fill();
    // open door leaf swung against the inner wall
    c.fillStyle = C.woodD; c.beginPath(); c.moveTo(b2.x, b2.y); c.lineTo(b2.x + ux * S * 0.28, b2.y + uy * S * 0.28); c.lineTo(t2.x + ux * S * 0.28, t2.y + uy * S * 0.28); c.lineTo(t2.x, t2.y); c.closePath(); c.fill();
    c.strokeStyle = C.out; c.lineWidth = S * 0.02; c.stroke();
    // frame
    c.strokeStyle = C.woodD; c.lineWidth = S * 0.08; c.beginPath(); c.moveTo(b1.x, b1.y); c.lineTo(t1.x, t1.y); c.lineTo(t2.x, t2.y); c.lineTo(b2.x, b2.y); c.stroke();
    c.strokeStyle = C.wood; c.lineWidth = S * 0.03; c.stroke();
    // OPEN sign across the top of the frame
    var cx = (t1.x + t2.x) / 2, cy = (t1.y + t2.y) / 2 - S * 0.04;
    c.fillStyle = C.blood; rr(c, cx - S * 0.16, cy - S * 0.02, S * 0.32, S * 0.15, 3); c.fill();
    c.strokeStyle = C.out; c.lineWidth = S * 0.02; c.stroke();
    c.fillStyle = '#fff'; c.font = 'bold ' + (S * 0.1) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('OPEN', cx, cy + S * 0.06);
  };

  // ---- furniture ------------------------------------------------------
  Renderer.prototype._shadow = function (c, x, y, w) { c.fillStyle = 'rgba(0,0,0,.36)'; c.beginPath(); c.ellipse(x, y, w, w * 0.42, 0, 0, 7); c.fill(); };

  Renderer.prototype._pass = function (c, world) {
    var p = this.project(Wld.PASS.x, Wld.PASS.y), S = this.S;
    var b = isoBox(c, p.x, p.y + S * 0.16, S * 0.78, S * 0.34, S * 0.36, C.steel, C.steelD);
    // top detail + grime
    c.save(); topClip(c, b); c.fillStyle = 'rgba(255,255,255,.12)'; circle(c, b.x - b.fw * 0.3, b.topY - b.fh * 0.2, b.fw * 0.5); c.fillStyle = 'rgba(40,30,16,.18)'; circle(c, b.x + b.fw * 0.3, b.topY + b.fh * 0.2, b.fw * 0.4); c.restore();
    // ready dishes stacked on the top plane
    var n = world.ready.length, show = Math.min(n, 5);
    for (var i = 0; i < show; i++) {
      var dx = b.x - (show - 1) * S * 0.15 + i * S * 0.3, dy = b.topY + S * 0.02;
      c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(dx, dy + S * 0.03, S * 0.13, S * 0.05, 0, 0, 7); c.fill();
      c.fillStyle = '#f1f1ec'; c.beginPath(); c.ellipse(dx, dy, S * 0.13, S * 0.06, 0, 0, 7); c.fill(); c.strokeStyle = C.out; c.lineWidth = S * 0.018; c.stroke();
      c.font = (S * 0.2) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText((recipe(world.ready[world.ready.length - 1 - i]) || {}).emoji || '🍽️', dx, dy - S * 0.08);
    }
    if (n > 5) badge(c, b.x + b.fw * 0.7, b.topY - S * 0.1, '+' + (n - 5), C.blood, S);
    if (n === 0) { c.fillStyle = 'rgba(20,30,20,.5)'; c.font = 'bold ' + (S * 0.12) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('PASS', b.x, b.topY); }
  };

  Renderer.prototype._custDish = function (cid) { for (var i = 0; i < this._custs.length; i++) if (this._custs[i].id === cid) return this._custs[i].dish; return null; };

  // pulsing valid-target marker shown while a zombie is selected
  Renderer.prototype._hl = function (c, x, y, w, t) {
    c.fillStyle = 'rgba(124,255,90,' + (0.16 + 0.1 * Math.sin(t * 5)) + ')';
    c.strokeStyle = 'rgba(124,255,90,.8)'; c.lineWidth = 2.5;
    iso(c, x, y, w, w * 0.5); c.fill(); c.stroke();
  };

  // A square diner table built as a real volume: contact shadow, two chairs, and
  // FOUR legs in perspective. The thick cloth TOP is a separate overlay
  // (_tableTop) drawn at greater depth so a seated diner is sandwiched behind it.
  function tableDims(S) { return { fw: S * 0.42, fh: S * 0.21, lh: S * 0.34 }; }
  Renderer.prototype._table = function (c, tb, sel, t) {
    var p = this.project(tb.x, tb.y), S = this.S, lift = sel ? S * 0.14 : 0, y = p.y - lift, D = tableDims(S);
    if (this._selZ && tb.dirty && !tb.cleaning) this._hl(c, p.x, p.y + S * 0.08, S * 1.1, t || 0);
    c.fillStyle = 'rgba(0,0,0,.34)'; c.beginPath(); c.ellipse(p.x, y + D.fh * 0.55, D.fw * 1.05, D.fh * 0.8, 0, 0, 7); c.fill();
    isoChair(c, p.x - D.fw - S * 0.06, y - S * 0.04, S, 1);     // left chair
    isoChair(c, p.x + D.fw + S * 0.06, y - S * 0.04, S, -1);    // right chair
    // four legs at the iso footprint corners (back corner leg is hidden by top)
    var corners = [[p.x, y - D.fh], [p.x + D.fw, y], [p.x, y + D.fh], [p.x - D.fw, y]];
    corners.forEach(function (L) {
      c.strokeStyle = shade(C.woodD, 0.62); c.lineWidth = S * 0.06; c.lineCap = 'round'; line(c, L[0], L[1], L[0], L[1] - D.lh);
      c.strokeStyle = C.wood; c.lineWidth = S * 0.028; line(c, L[0] - S * 0.012, L[1], L[0] - S * 0.012, L[1] - D.lh);
    });
  };
  // the table top (overlay drawn after seated diners so it occludes their lap)
  Renderer.prototype._tableTop = function (c, tb, sel, t) {
    var p = this.project(tb.x, tb.y), S = this.S, lift = sel ? S * 0.14 : 0, D = tableDims(S), ty = p.y - lift - D.lh, th = S * 0.07;
    var dia = function (yy) { c.beginPath(); c.moveTo(p.x, yy - D.fh); c.lineTo(p.x + D.fw, yy); c.lineTo(p.x, yy + D.fh); c.lineTo(p.x - D.fw, yy); c.closePath(); };
    // thickness: two front side bands (left-front lighter, right-front darker)
    c.fillStyle = shade(C.woodD, 0.62); c.beginPath(); c.moveTo(p.x - D.fw, ty); c.lineTo(p.x, ty + D.fh); c.lineTo(p.x, ty + D.fh + th); c.lineTo(p.x - D.fw, ty + th); c.closePath(); c.fill(); c.strokeStyle = C.out; c.lineWidth = S * 0.025; c.stroke();
    c.fillStyle = shade(C.woodD, 0.48); c.beginPath(); c.moveTo(p.x + D.fw, ty); c.lineTo(p.x, ty + D.fh); c.lineTo(p.x, ty + D.fh + th); c.lineTo(p.x + D.fw, ty + th); c.closePath(); c.fill(); c.stroke();
    // checkered cloth top (iso diamond)
    c.fillStyle = C.cloth1; dia(ty); c.fill();
    c.save(); dia(ty); c.clip();
    var bx = [D.fw / 3, D.fh / 3], by = [-D.fw / 3, D.fh / 3];           // iso cell axes
    c.fillStyle = 'rgba(255,255,255,.82)';
    for (var u = -2; u <= 2; u++) for (var v = -2; v <= 2; v++) if (((u + v) & 1) === 0) {
      var ccx = p.x + u * bx[0] + v * by[0], ccy = ty + u * bx[1] + v * by[1];
      c.beginPath(); c.moveTo(ccx, ccy - D.fh / 3); c.lineTo(ccx + D.fw / 3, ccy); c.lineTo(ccx, ccy + D.fh / 3); c.lineTo(ccx - D.fw / 3, ccy); c.closePath(); c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.ellipse(p.x - D.fw * 0.25, ty - D.fh * 0.25, D.fw * 0.5, D.fh * 0.5, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(0,0,0,.16)'; c.beginPath(); c.ellipse(p.x + D.fw * 0.3, ty + D.fh * 0.3, D.fw * 0.5, D.fh * 0.5, 0, 0, 7); c.fill();
    c.restore();
    c.strokeStyle = C.out; c.lineWidth = S * 0.03; dia(ty); c.stroke();
    // plate on the surface (+ food while eating, grime while dirty)
    var occ = tb.by, eating = false; if (occ) { for (var k = 0; k < this._custs.length; k++) if (this._custs[k].id === occ) eating = this._custs[k].state === 'eating'; }
    c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(p.x, ty + S * 0.03, S * 0.13, S * 0.055, 0, 0, 7); c.fill();
    c.fillStyle = '#f1f1ec'; c.beginPath(); c.ellipse(p.x, ty, S * 0.12, S * 0.06, 0, 0, 7); c.fill();
    c.strokeStyle = C.out; c.lineWidth = S * 0.018; c.stroke();
    if (tb.dirty) {
      c.fillStyle = '#7a5a2a'; circle(c, p.x, ty - S * 0.01, S * 0.05); c.fillStyle = '#9bbf4a'; circle(c, p.x + S * 0.05, ty + S * 0.01, S * 0.025);
      c.fillStyle = 'rgba(120,200,90,.22)'; c.beginPath(); c.ellipse(p.x, ty + S * 0.02, S * 0.2, S * 0.1, 0, 0, 7); c.fill();
      c.fillStyle = C.out; for (var fi = 0; fi < 3; fi++) { var a = (t || 0) * 3 + fi * 2.1; circle(c, p.x + Math.cos(a) * S * 0.18, ty - S * 0.14 + Math.sin(a * 1.4) * S * 0.08, S * 0.014); }
      if (tb.cleaning) { c.fillStyle = '#bfe6ff'; c.font = (S * 0.2) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('✦', p.x - S * 0.12, ty - S * 0.16); }
    } else if (eating) { c.font = (S * 0.2) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; var rc = recipe(this._custDish(occ)); if (rc) c.fillText(rc.emoji, p.x, ty - S * 0.05); }
    if (sel) selRing(c, p.x, ty, S * 0.5);
  };

  Renderer.prototype._decor = function (c, d, sel) {
    var p = this.project(d.x, d.y), S = this.S, it = shop(d.deco) || {}, lift = sel ? S * 0.18 : 0, y = p.y - lift;
    if (['counter', 'sink', 'fridge', 'trash', 'plant', 'jukebox', 'rest'].indexOf(it.art) < 0) this._shadow(c, p.x, p.y + S * 0.12, S * 0.34);   // box arts ground themselves
    c.lineWidth = S * 0.03; c.strokeStyle = C.out;
    switch (it.art) {
      case 'plant': {
        var pb = isoBox(c, p.x, y, S * 0.16, S * 0.09, S * 0.2, '#9a5a32', '#74411f', false);   // terracotta pot
        c.fillStyle = '#7a4422'; c.beginPath(); c.ellipse(pb.x, pb.topY, pb.fw * 0.9, pb.fh * 0.9, 0, 0, 7); c.fill();   // soil
        c.fillStyle = '#2f8f3a'; circle(c, p.x, pb.topY - S * 0.2, S * 0.22); c.strokeStyle = C.out; c.lineWidth = S * 0.025; c.beginPath(); c.arc(p.x, pb.topY - S * 0.2, S * 0.22, 0, 7); c.stroke();
        c.fillStyle = '#3fb04a'; circle(c, p.x - S * 0.13, pb.topY - S * 0.34, S * 0.14); circle(c, p.x + S * 0.13, pb.topY - S * 0.3, S * 0.12); circle(c, p.x, pb.topY - S * 0.42, S * 0.13);
        c.fillStyle = 'rgba(255,255,255,.12)'; circle(c, p.x - S * 0.06, pb.topY - S * 0.28, S * 0.08); break; }
      case 'lamp': {
        c.fillStyle = '#2a2a2a'; c.beginPath(); c.ellipse(p.x, y + S * 0.04, S * 0.14, S * 0.06, 0, 0, 7); c.fill(); c.strokeStyle = C.out; c.lineWidth = S * 0.025; c.stroke();   // weighted base
        c.fillStyle = '#3a3a3a'; rr(c, p.x - S * 0.1, y - S * 0.02, S * 0.2, S * 0.06, 3); c.fill();
        c.strokeStyle = '#2a2a2a'; c.lineWidth = S * 0.05; c.lineCap = 'round'; line(c, p.x, y, p.x, y - S * 0.46);   // pole
        c.fillStyle = 'rgba(255,207,77,.22)'; circle(c, p.x, y - S * 0.5, S * 0.5);
        c.fillStyle = C.gold; c.beginPath(); c.moveTo(p.x - S * 0.26, y - S * 0.4); c.lineTo(p.x + S * 0.26, y - S * 0.4); c.lineTo(p.x + S * 0.16, y - S * 0.7); c.lineTo(p.x - S * 0.16, y - S * 0.7); c.closePath(); c.fill(); c.strokeStyle = C.out; c.lineWidth = S * 0.03; c.stroke();
        c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.moveTo(p.x - S * 0.2, y - S * 0.42); c.lineTo(p.x - S * 0.04, y - S * 0.42); c.lineTo(p.x - S * 0.1, y - S * 0.68); c.closePath(); c.fill(); break; }
      case 'rug':
        c.fillStyle = '#7a1f24'; iso(c, p.x, y, S * 1.1, S * 0.55); c.fill(); c.stroke();
        c.strokeStyle = C.gold; c.lineWidth = S * 0.04; iso(c, p.x, y, S * 0.8, S * 0.4); c.stroke(); break;
      case 'jukebox': {
        var jb = isoBox(c, p.x, y, S * 0.26, S * 0.13, S * 0.74, '#7a3f8a', '#5a2a6a', true);
        c.fillStyle = '#241026'; rr(c, jb.x - S * 0.16, p.y - S * 0.66, S * 0.32, S * 0.24, 5); c.fill(); c.strokeStyle = C.out; c.lineWidth = S * 0.02; c.stroke();   // screen
        c.fillStyle = '#b06bff'; circle(c, jb.x, p.y - S * 0.54, S * 0.08); c.fillStyle = C.gold; circle(c, jb.x - S * 0.16, p.y - S * 0.2, S * 0.03); circle(c, jb.x + S * 0.16, p.y - S * 0.2, S * 0.03);
        c.fillStyle = 'rgba(176,107,255,' + (0.2 + 0.1 * Math.sin((this._t || 0) * 4)) + ')'; circle(c, jb.x, p.y - S * 0.54, S * 0.16); break; }
      case 'fountain':
        c.fillStyle = '#6a6e64'; c.beginPath(); c.ellipse(p.x, y + S * 0.12, S * 0.4, S * 0.2, 0, 0, 7); c.fill(); c.strokeStyle = C.out; c.lineWidth = S * 0.03; c.stroke();   // base bowl
        c.fillStyle = shade('#6a6e64', 0.8); c.beginPath(); c.ellipse(p.x, y + S * 0.16, S * 0.4, S * 0.2, 0, 0, 7); c.fill();
        c.fillStyle = '#7a1f24'; c.beginPath(); c.ellipse(p.x, y + S * 0.08, S * 0.3, S * 0.14, 0, 0, 7); c.fill();   // bloody water
        c.fillStyle = '#9a9d92'; rr(c, p.x - S * 0.06, y - S * 0.32, S * 0.12, S * 0.4, 3); c.fill(); c.strokeStyle = C.out; c.lineWidth = S * 0.025; c.stroke();   // pillar
        c.fillStyle = C.blood; circle(c, p.x, y - S * 0.34, S * 0.1); c.fillStyle = '#e06b6b'; for (var wi = 0; wi < 4; wi++) { var wa = wi / 4 * 6.28; circle(c, p.x + Math.cos(wa) * S * 0.16, y - S * 0.2 + Math.sin(wa) * S * 0.06, S * 0.02); } break;
      case 'counter': {
        var cb = isoBox(c, p.x, y, S * 0.4, S * 0.2, S * 0.34, C.steel, C.steelD, true);
        c.save(); topClip(c, cb); c.fillStyle = '#7a5a2a'; circle(c, cb.x - cb.fw * 0.2, cb.topY, S * 0.045); c.fillStyle = '#9bbf4a'; circle(c, cb.x + cb.fw * 0.25, cb.topY + cb.fh * 0.2, S * 0.03); stainBlob(c, cb.x + cb.fw * 0.1, cb.topY - cb.fh * 0.2, S * 0.08, 'rgba(40,30,16,.28)'); c.restore(); break; }
      case 'sink': {
        var sb = isoBox(c, p.x, y, S * 0.38, S * 0.19, S * 0.32, C.steel, C.steelD, true);
        c.save(); topClip(c, sb);                                  // basin + dirty water on the top
        c.fillStyle = '#26323a'; c.beginPath(); c.ellipse(sb.x, sb.topY, sb.fw * 0.62, sb.fh * 0.62, 0, 0, 7); c.fill();
        c.fillStyle = 'rgba(120,200,90,.7)'; c.beginPath(); c.ellipse(sb.x, sb.topY, sb.fw * 0.5, sb.fh * 0.5, 0, 0, 7); c.fill();
        c.fillStyle = 'rgba(150,220,110,.5)'; circle(c, sb.x - sb.fw * 0.15, sb.topY, S * 0.025); c.restore();
        c.strokeStyle = C.steel; c.lineWidth = S * 0.045; c.lineCap = 'round'; c.beginPath(); c.moveTo(sb.x + sb.fw * 0.4, sb.topY); c.lineTo(sb.x + sb.fw * 0.4, sb.topY - S * 0.2); c.lineTo(sb.x + sb.fw * 0.15, sb.topY - S * 0.2); c.stroke(); break; }
      case 'fridge': {
        var fb = isoBox(c, p.x, y, S * 0.32, S * 0.17, S * 0.86, '#dfe2da', '#c9cdc4', false);
        // door seam + handles + grime on the lit left-front face
        c.strokeStyle = C.out; c.lineWidth = S * 0.022; line(c, p.x - fb.fw, p.y - S * 0.5, p.x, p.y - S * 0.5 + fb.fh);   // freezer seam across front
        c.fillStyle = '#7d827a'; rr(c, p.x - fb.fw * 0.28, p.y - S * 0.74, S * 0.04, S * 0.16, 2); c.fill(); rr(c, p.x - fb.fw * 0.28, p.y - S * 0.4, S * 0.04, S * 0.18, 2); c.fill();
        c.fillStyle = 'rgba(40,30,16,.22)'; stainBlob(c, p.x - fb.fw * 0.4, p.y - S * 0.2, S * 0.1, 'rgba(40,30,16,.22)'); break; }
      case 'trash': {
        var tb2 = isoBox(c, p.x, y, S * 0.18, S * 0.1, S * 0.34, '#5a6a42', '#3a4a32', false);
        c.fillStyle = '#6a7a4a'; c.beginPath(); c.ellipse(tb2.x, tb2.topY, tb2.fw * 1.05, tb2.fh * 1.05, 0, 0, 7); c.fill(); c.strokeStyle = C.out; c.lineWidth = S * 0.02; c.stroke();   // lid
        c.fillStyle = '#9bbf4a'; circle(c, tb2.x + S * 0.03, tb2.topY - S * 0.04, S * 0.04); c.fillStyle = '#b04a2a'; circle(c, tb2.x - S * 0.05, tb2.topY - S * 0.03, S * 0.03);
        c.fillStyle = C.out; for (var ti = 0; ti < 2; ti++) { var ta = (this._t || 0) * 3 + ti * 3; circle(c, tb2.x + Math.cos(ta) * S * 0.16, tb2.topY - S * 0.1 + Math.sin(ta * 1.4) * S * 0.06, S * 0.012); } break; }
      case 'rest': {
        var rb = isoBox(c, p.x, y, S * 0.44, S * 0.2, S * 0.18, '#6a4a2a', '#4a3018', false);   // coffin base
        c.save(); topClip(c, rb); c.fillStyle = '#241026'; c.beginPath(); c.ellipse(rb.x, rb.topY, rb.fw * 0.78, rb.fh * 0.78, 0, 0, 7); c.fill();   // padded interior
        c.fillStyle = '#cfc0e0'; c.beginPath(); c.ellipse(rb.x - rb.fw * 0.35, rb.topY - rb.fh * 0.1, rb.fw * 0.26, rb.fh * 0.4, 0, 0, 7); c.fill(); c.restore();   // pillow
        c.fillStyle = C.gold; c.font = 'bold ' + (S * 0.14) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('✝', rb.x + rb.fw * 0.4, rb.topY); break; }
      default: c.fillStyle = '#556'; rr(c, p.x - S * 0.2, y - S * 0.2, S * 0.4, S * 0.4, 6); c.fill(); c.stroke();
    }
    if (sel) selRing(c, p.x, y, S * 0.4);
  };

  Renderer.prototype._stove = function (c, st, world, t, sel) {
    var p = this.project(st.x, st.y), S = this.S, x = p.x, y = p.y;
    if (this._selZ && (st.ready || st.burned)) this._hl(c, x, y + S * 0.2, S * 1.05, t);
    if (st.ready && !st.burning) { c.fillStyle = 'rgba(124,255,90,' + (0.2 + 0.12 * Math.sin(t * 5)) + ')'; rr(c, x - S * 0.5, y - S * 0.82, S, S * 0.95, 12); c.fill(); }
    if (st.burning || st.burned) { c.fillStyle = 'rgba(216,65,58,' + (0.22 + 0.14 * Math.sin(t * 7)) + ')'; rr(c, x - S * 0.5, y - S * 0.82, S, S * 0.95, 12); c.fill(); }
    // ===== a real iso BOX: bottom diamond on the floor, extruded up =====
    var fw = S * 0.42, fh = S * 0.2, bh = S * 0.52, topY = y - bh;
    this._shadow(c, x, y + fh * 0.3, S * 0.52);
    c.fillStyle = '#15160f'; rr(c, x - fw * 0.78, y + fh * 0.05, S * 0.07, S * 0.12, 2); c.fill(); rr(c, x + fw * 0.6, y + fh * 0.05, S * 0.07, S * 0.12, 2); c.fill();   // feet
    var face = function (pts, col) { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fill(); c.strokeStyle = C.out; c.lineWidth = S * 0.03; c.stroke(); };
    // right-front face (darkest)
    face([[x, topY + fh], [x + fw, topY], [x + fw, y], [x, y + fh]], shade(C.steelD, 0.66));
    // left-front face (mid) — carries the oven door
    var lf = [[x - fw, topY], [x, topY + fh], [x, y + fh], [x - fw, y]];
    face(lf, sel ? '#5a6168' : C.steelD);
    // top burner plane (lightest) + burners
    face([[x, topY - fh], [x + fw, topY], [x, topY + fh], [x - fw, topY]], C.steel);
    c.fillStyle = '#2c3034'; circle(c, x - fw * 0.34, topY + fh * 0.1, S * 0.055); circle(c, x + fw * 0.34, topY - fh * 0.1, S * 0.055); circle(c, x, topY - fh * 0.4, S * 0.05); circle(c, x, topY + fh * 0.5, S * 0.05);
    // oven door = inset of the left-front face, with a window
    var cen = [(lf[0][0] + lf[1][0] + lf[2][0] + lf[3][0]) / 4, (lf[0][1] + lf[1][1] + lf[2][1] + lf[3][1]) / 4];
    var ins = function (p, f) { return [p[0] + (cen[0] - p[0]) * f, p[1] + (cen[1] - p[1]) * f]; };
    face([ins(lf[0], 0.2), ins(lf[1], 0.2), ins(lf[2], 0.12), ins(lf[3], 0.12)], '#23262a');
    face([ins(lf[0], 0.4), ins(lf[1], 0.4), ins(lf[2], 0.34), ins(lf[3], 0.34)], '#3a4045');
    c.fillStyle = C.gold; circle(c, (lf[0][0] + lf[1][0]) / 2 - fw * 0.06, (lf[0][1] + lf[1][1]) / 2 + fh * 0.1, S * 0.035); circle(c, (lf[0][0] + lf[1][0]) / 2 + fw * 0.04, (lf[0][1] + lf[1][1]) / 2, S * 0.035);   // knobs
    // grease grime down the faces
    c.save(); c.beginPath(); c.moveTo(lf[0][0], lf[0][1]); c.lineTo(lf[1][0], lf[1][1]); c.lineTo(lf[2][0], lf[2][1]); c.lineTo(lf[3][0], lf[3][1]); c.closePath(); c.clip();
    stainBlob(c, x - fw * 0.4, y - bh * 0.3, S * 0.1, 'rgba(40,30,16,.32)'); drip(c, x - fw * 0.2, topY + fh * 0.2, S * 0.16, S * 0.02, 'rgba(110,150,40,.4)'); c.restore();
    var r = recipe(st.recipe) || { time: 1, emoji: '🍳', batch: 0 };
    var topYref = topY;   // a pot sits here while cooking/ready
    c.textAlign = 'center'; c.textBaseline = 'middle';
    var tagY = topY - fh - S * 0.16;          // status tags float above the box
    if (st.burned) {
      pot(c, x, topYref, S, '#2a2a2a');
      smoke(c, x, topYref - S * 0.1, S, t, '#555');
      c.fillStyle = C.blood; rr(c, x - S * 0.4, tagY, S * 0.8, S * 0.2, 6); c.fill();
      c.fillStyle = '#fff'; c.font = 'bold ' + (S * 0.13) + 'px system-ui'; c.fillText('🔥 CLEAR', x, tagY + S * 0.1);
    } else if (st.ready) {
      pot(c, x, topYref, S, C.steel);
      if (st.burning) smoke(c, x, topYref - S * 0.12, S, t, '#777');
      c.font = (S * 0.24) + 'px system-ui'; c.fillStyle = '#fff'; c.fillText(r.emoji, x, topYref - S * 0.16);
      var rdy = st.burning ? C.blood : C.toxic;
      c.fillStyle = rdy; rr(c, x - S * 0.36, tagY, S * 0.72, S * 0.2, 6); c.fill();
      c.fillStyle = st.burning ? '#fff' : '#07210a'; c.font = 'bold ' + (S * 0.13) + 'px system-ui'; c.fillText(st.burning ? '⚠ BURNING' : 'SERVE ▸', x, tagY + S * 0.1);
      if (r.batch) badge(c, x + S * 0.34, tagY + S * 0.04, '' + r.batch, C.blood, S);
    } else if (st.recipe) {
      pot(c, x, topYref, S, C.steel);
      for (var i = -1; i <= 1; i++) { c.fillStyle = i === 0 ? '#ffb43d' : '#ff7a2d'; circle(c, x + i * S * 0.07, topYref - S * 0.04 + Math.sin(t * 9 + i) * 2, S * 0.04); }   // bubbling
      c.font = (S * 0.2) + 'px system-ui'; c.fillStyle = '#fff'; c.fillText(r.emoji, x, topYref - S * 0.14);
      var frac = Math.min(1, (world.t - st.start) / r.time);
      c.fillStyle = '#0c140e'; rr(c, x - S * 0.34, tagY + S * 0.05, S * 0.68, S * 0.1, 4); c.fill();
      c.fillStyle = C.toxic; rr(c, x - S * 0.34, tagY + S * 0.05, S * 0.68 * frac, S * 0.1, 4); c.fill();
    } else {
      c.fillStyle = C.toxic; c.font = 'bold ' + (S * 0.26) + 'px system-ui'; c.fillText('+', x, topY);
      c.fillStyle = 'rgba(230,243,231,.7)'; c.font = 'bold ' + (S * 0.11) + 'px system-ui'; c.fillText('COOK', x, topY + fh * 0.7);
    }
    if (sel) selRing(c, x, y - S * 0.15, S * 0.5);
  };

  // ---- characters: layered faux-3D sprites ----------------------------
  // Light comes from the upper-LEFT, so every form is lit on the upper-left and
  // shaded on the lower-right. Characters are built bottom-up as overlapping
  // volume shapes (shadow → legs → back arm → torso → front arm → head → face
  // → hat → carried plate) and angle toward their walking direction.
  function facing(e) { return e.face === 'L' ? -1 : e.face === 'R' ? 1 : 0; }

  // a shaded "sphere": base fill + dark lower-right + bright upper-left + outline
  function volBall(c, x, y, r, base, dark, hi) {
    c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.clip();
    c.fillStyle = base; c.fillRect(x - r, y - r, 2 * r, 2 * r);
    c.fillStyle = dark; circle(c, x + r * 0.5, y + r * 0.42, r * 1.02);
    c.fillStyle = hi || 'rgba(255,255,255,.20)'; circle(c, x - r * 0.36, y - r * 0.4, r * 0.55);
    c.restore();
    c.strokeStyle = C.out; c.lineWidth = Math.max(1.6, r * 0.19); c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
  }
  // a shaded rounded box (torso, cushions, appliance faces)
  function volRR(c, x, y, w, h, rad, base, dark) {
    c.save(); rr(c, x, y, w, h, rad); c.clip();
    c.fillStyle = base; c.fillRect(x, y, w, h);
    c.fillStyle = dark; circle(c, x + w * 0.82, y + h * 0.78, Math.max(w, h) * 0.85);
    c.fillStyle = 'rgba(255,255,255,.14)'; circle(c, x + w * 0.26, y + h * 0.22, w * 0.5);
    c.restore();
    rr(c, x, y, w, h, rad); c.strokeStyle = C.out; c.lineWidth = Math.max(1.4, w * 0.07); c.stroke();
  }
  // a tube limb with a shaded core (fakes a cylinder)
  function limb(c, x1, y1, x2, y2, col, dark, w) {
    c.lineCap = 'round'; c.strokeStyle = dark; c.lineWidth = w; line(c, x1, y1, x2, y2);
    c.strokeStyle = col; c.lineWidth = w * 0.55; line(c, x1 - w * 0.12, y1 - w * 0.12, x2 - w * 0.12, y2 - w * 0.12);
  }
  function foot(c, x, y, S) { c.fillStyle = '#1d1f1a'; c.beginPath(); c.ellipse(x, y, S * 0.085, S * 0.045, 0, 0, 7); c.fill(); c.strokeStyle = C.out; c.lineWidth = S * 0.02; c.stroke(); c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.ellipse(x - S * 0.02, y - S * 0.01, S * 0.04, S * 0.02, 0, 0, 7); c.fill(); }
  function hand(c, x, y, r, skin, skinD) { c.fillStyle = skinD; circle(c, x + r * 0.2, y + r * 0.2, r); c.fillStyle = skin; circle(c, x, y, r); c.strokeStyle = C.out; c.lineWidth = Math.max(1.1, r * 0.4); c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke(); }

  // Shared character renderer. cfg: { skin, skinD, clothes, hunch, zombie,
  // expr, hair, hat, carry, carryEmoji, lift }
  Renderer.prototype._char = function (c, e, t, cfg) {
    var S = this.S * (cfg.build || 1), p = this.project(e.x, e.y);   // body-type scale
    var up = e.face === 'U', lx = facing(e), walk = cfg.walk;
    var ph = e.step * 2;
    var swing = walk ? Math.sin(ph) * S * 0.11 : 0;        // leg/arm swing
    var bob = walk ? Math.abs(Math.sin(ph)) * S * 0.03 : 0;
    var sway = walk ? Math.sin(ph) * S * 0.015 : 0;
    var baseY = p.y, x = p.x + sway + (cfg.lift ? 0 : 0), y = baseY - bob;
    var hunch = cfg.hunch ? S * 0.04 : 0, lean = lx * S * 0.02;
    var hipY = y - S * 0.18, chestY = y - S * 0.40 - hunch, headY = y - S * 0.585 - hunch;
    var skin = cfg.skin, skinD = cfg.skinD, clo = cfg.clothes, cloD = shade(clo, 0.66), cloH = shade(clo, 1.16);

    // 1. contact shadow — anchored at the FEET so they read as planted
    c.fillStyle = 'rgba(0,0,0,.40)'; c.beginPath(); c.ellipse(p.x + S * 0.02, baseY + S * 0.07, S * 0.28, S * 0.1, 0, 0, 7); c.fill();

    // 2. legs — back leg first (darker), front leg over the torso later
    var lpx = x + lean;
    foot(c, lpx + S * 0.085, baseY - swing * 0.4, S);
    limb(c, lpx + S * 0.07, hipY, lpx + S * 0.085, baseY - swing * 0.4 - S * 0.02, shade(clo, 0.8), cloD, S * 0.12);

    // 3. back arm (behind torso) + hand
    var armSwing = walk ? Math.sin(ph + Math.PI) * S * 0.06 : (cfg.hunch ? S * 0.03 : 0);
    limb(c, x + lean + S * 0.12, chestY + S * 0.03, x + lean + S * 0.2, chestY + S * 0.2 + armSwing, skin, skinD, S * 0.09);
    hand(c, x + lean + S * 0.2, chestY + S * 0.21 + armSwing, S * 0.055, skin, skinD);

    // 4. torso (with apron for zombies)
    var tw = S * 0.34, th = S * 0.42, tx = x + lean - tw / 2, ty = chestY - th * 0.35;
    volRR(c, tx, ty, tw, th, tw * 0.42, clo, cloD);
    if (cfg.zombie) { c.fillStyle = 'rgba(245,242,230,.92)'; rr(c, tx + tw * 0.18, ty + th * 0.18, tw * 0.64, th * 0.7, tw * 0.18); c.fill(); c.strokeStyle = C.out; c.lineWidth = S * 0.02; c.stroke(); }

    // 5. front leg + front arm (or carried plate)
    foot(c, lpx - S * 0.075, baseY + swing * 0.4, S);
    limb(c, lpx - S * 0.06, hipY, lpx - S * 0.075, baseY + swing * 0.4 - S * 0.02, clo, cloD, S * 0.12);
    if (cfg.carry) {
      // both hands forward holding a plate at chest height
      limb(c, x + lean - S * 0.12, chestY + S * 0.02, x + lean - S * 0.02, chestY + S * 0.08, skin, skinD, S * 0.085);
      var plx = x + lean, ply = chestY + S * 0.05;
      c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(plx, ply + S * 0.03, S * 0.17, S * 0.06, 0, 0, 7); c.fill();
      c.fillStyle = '#f3f3ef'; c.beginPath(); c.ellipse(plx, ply, S * 0.16, S * 0.075, 0, 0, 7); c.fill();
      c.strokeStyle = C.out; c.lineWidth = S * 0.02; c.beginPath(); c.ellipse(plx, ply, S * 0.16, S * 0.075, 0, 0, 7); c.stroke();
      if (cfg.carryEmoji) { c.font = (S * 0.2) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(cfg.carryEmoji, plx, ply - S * 0.07); }
    } else {
      var fa = walk ? Math.sin(ph) * S * 0.06 : 0;
      limb(c, x + lean - S * 0.12, chestY + S * 0.03, x + lean - S * 0.2, chestY + S * 0.2 + fa, skin, skinD, S * 0.09);
      hand(c, x + lean - S * 0.2, chestY + S * 0.21 + fa, S * 0.055, skin, skinD);
    }

    // 6. neck + ears + head (a shaded ball, hunched slightly forward)
    var hx = x + lean + (cfg.hunch ? lx * S * 0.02 : 0), hr = S * 0.205;
    c.fillStyle = skinD; rr(c, hx - S * 0.05, headY + hr * 0.7, S * 0.1, S * 0.12, 3); c.fill();
    c.fillStyle = skin; circle(c, hx - hr * 0.84, headY + hr * 0.1, hr * 0.22); circle(c, hx + hr * 0.84, headY + hr * 0.1, hr * 0.22);   // ears
    c.strokeStyle = C.out; c.lineWidth = Math.max(1.2, hr * 0.13); c.beginPath(); c.arc(hx - hr * 0.84, headY + hr * 0.1, hr * 0.22, 0, 7); c.stroke(); c.beginPath(); c.arc(hx + hr * 0.84, headY + hr * 0.1, hr * 0.22, 0, 7); c.stroke();
    volBall(c, hx, headY, hr, skin, skinD);
    if (cfg.zombie) { c.save(); c.beginPath(); c.arc(hx, headY, hr, 0, 7); c.clip(); c.fillStyle = shade(skin, 0.8); circle(c, hx + hr * 0.2, headY + hr * 0.55, hr * 0.7); c.restore(); }

    // 7. hair / hat / face
    if (up) {                                              // back of the head
      c.fillStyle = cfg.hair || '#2b2b2b'; c.save(); c.beginPath(); c.arc(hx, headY, hr, 0, 7); c.clip(); circle(c, hx, headY - hr * 0.15, hr * 0.95); c.restore();
    } else {
      if (!cfg.zombie && cfg.hair) { c.fillStyle = cfg.hair; c.beginPath(); c.arc(hx, headY - hr * 0.08, hr * 0.98, Math.PI + 0.25, 2 * Math.PI - 0.25); c.fill(); c.strokeStyle = C.out; c.lineWidth = S * 0.02; c.stroke(); }
      this._face(c, hx, headY, hr, lx, cfg);
    }
    this._hat(c, cfg.hat, hx, headY + hr * 0.05, S);
    return { hx: hx, headY: headY, hr: hr, baseY: baseY };
  };

  // face features on a rounded head, angled toward lx (the 3/4 view)
  Renderer.prototype._face = function (c, hx, hy, hr, lx, cfg) {
    var S = this.S, ex = lx * hr * 0.16, ey = hy + hr * 0.02;
    // sunken sockets for zombies
    if (cfg.zombie) { c.fillStyle = shade(cfg.skin, 0.72); circle(c, hx - hr * 0.34 + ex, ey - hr * 0.05, hr * 0.26); circle(c, hx + hr * 0.34 + ex, ey - hr * 0.05, hr * 0.26); }
    // eye whites + pupils (pupils drift toward facing)
    c.fillStyle = '#fff'; circle(c, hx - hr * 0.34 + ex, ey, hr * 0.2); circle(c, hx + hr * 0.34 + ex, ey, hr * 0.2);
    c.fillStyle = C.out; circle(c, hx - hr * 0.34 + ex + lx * hr * 0.07, ey + hr * 0.02, hr * 0.1); circle(c, hx + hr * 0.34 + ex + lx * hr * 0.07, ey + hr * 0.02, hr * 0.1);
    // nose pointing sideways
    c.fillStyle = shade(cfg.skin, 0.84); c.beginPath(); c.moveTo(hx + ex + lx * hr * 0.05, ey + hr * 0.1); c.lineTo(hx + ex + lx * hr * 0.28, ey + hr * 0.22); c.lineTo(hx + ex + lx * hr * 0.05, ey + hr * 0.26); c.closePath(); c.fill();
    // brows / expression
    c.strokeStyle = C.out; c.lineWidth = hr * 0.07; c.lineCap = 'round';
    var m = cfg.expr;
    if (cfg.zombie) {
      // jagged grin with teeth
      c.fillStyle = '#241109'; rr(c, hx - hr * 0.4 + ex, hy + hr * 0.42, hr * 0.8, hr * 0.22, hr * 0.06); c.fill();
      c.fillStyle = '#eae7d6'; for (var i = 0; i < 3; i++) c.fillRect(hx - hr * 0.32 + ex + i * hr * 0.26, hy + hr * 0.42, hr * 0.16, hr * 0.22);
      c.fillStyle = '#bfe6c0'; circle(c, hx + hr * 0.28 + ex, hy + hr * 0.62, hr * 0.08);   // drool
    } else if (m === 'happy') { c.beginPath(); c.arc(hx + ex, hy + hr * 0.5, hr * 0.3, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
    else if (m === 'angry') { c.beginPath(); c.moveTo(hx - hr * 0.3 + ex, hy + hr * 0.66); c.lineTo(hx + hr * 0.3 + ex, hy + hr * 0.66); c.stroke(); c.lineWidth = hr * 0.09; c.beginPath(); c.moveTo(hx - hr * 0.5 + ex, ey - hr * 0.3); c.lineTo(hx - hr * 0.18 + ex, ey - hr * 0.16); c.moveTo(hx + hr * 0.18 + ex, ey - hr * 0.16); c.lineTo(hx + hr * 0.5 + ex, ey - hr * 0.3); c.stroke(); }
    else { c.beginPath(); c.moveTo(hx - hr * 0.18 + ex, hy + hr * 0.55); c.lineTo(hx + hr * 0.18 + ex, hy + hr * 0.55); c.stroke(); }
  };

  Renderer.prototype._zombie = function (c, z, t) {
    var S = this.S, p = this.project(z.x, z.y), selMe = this._selZ === z.id;
    if (selMe) { c.strokeStyle = C.toxic; c.lineWidth = S * 0.05; c.setLineDash([S * 0.12, S * 0.08]); c.beginPath(); c.ellipse(p.x + S * 0.02, p.y + S * 0.05, S * 0.27, S * 0.13, 0, 0, 7); c.stroke(); c.setLineDash([]); }
    var expr = z.energy < 22 ? 'tired' : 'grin';
    var carry = z.carry || z.carryBatch;
    // zombie skin varies a touch by id so the horde isn't uniform
    var tint = (parseInt((z.id || '0').slice(-1), 36) % 3), zsk = tint === 0 ? C.zSkin : tint === 1 ? '#86c95f' : '#9bbf6a';
    this._char(c, z, t, {
      skin: zsk, skinD: shade(zsk, 0.72), clothes: '#6b5640', hunch: true, zombie: true, expr: expr, build: 1.06,
      hat: 'chef', walk: (z.state !== 'idle' && z.state !== 'resting' && z.state !== 'daydream'),
      carry: !!carry, carryEmoji: (recipe(z.carry || (z.carryBatch || {}).id) || {}).emoji || '🍽️',
    });
    var hy = p.y - S * 0.79;
    if (z.rarity && z.rarity !== 'common') { c.fillStyle = z.rarity === 'elite' ? C.gold : '#7fd0ff'; c.strokeStyle = C.out; c.lineWidth = S * 0.015; circle(c, p.x + S * 0.13, p.y - S * 0.33, S * 0.035); c.beginPath(); c.arc(p.x + S * 0.13, p.y - S * 0.33, S * 0.035, 0, 7); c.stroke(); }
    if (z.energy < 65 && z.state !== 'resting') { var bw = S * 0.4; c.fillStyle = 'rgba(0,0,0,.6)'; rr(c, p.x - bw / 2, hy - S * 0.04, bw, S * 0.07, 3); c.fill(); var ef = Math.max(0, z.energy) / (z.maxEnergy || 100); c.fillStyle = z.energy > 45 ? C.toxic : z.energy > 22 ? C.gold : C.blood; rr(c, p.x - bw / 2, hy - S * 0.04, bw * ef, S * 0.07, 3); c.fill(); }
    if (z.state === 'daydream') bubble(c, p.x, hy - S * 0.12, '💭', '#cfe', S);
    else if (z.state === 'resting') bubble(c, p.x, hy - S * 0.12, '💤', '#cfe', S);
    else if (z.state === 'cleaning' || z.state === 'toClean') bubble(c, p.x, hy - S * 0.12, '🧽', '#fff', S);
  };

  Renderer.prototype._customer = function (c, cu, world, t) {
    var S = this.S, p = this.project(cu.x, cu.y);
    var seated = (cu.state === 'eating' || cu.state === 'paying' || cu.state === 'waiting');
    var walk = (cu.state === 'toTable' || cu.state === 'leaving');
    var angry = (cu.state === 'waiting' && (world.t - cu.wait) > (world.custPatience ? world.custPatience(cu) : world.patience()) * 0.6) || (cu.state === 'queued' && cu.annoyed);
    if (this._selZ && cu.state === 'waiting' && !cu.assigned && this._foodReady) this._hl(c, p.x, p.y + S * 0.06, S * 0.8, t);
    var expr = (cu.state === 'paying' || cu.state === 'eating') ? 'happy' : angry ? 'angry' : 'neutral';
    var BUILD = { worker: 1.14, elder: 0.84, athlete: 1.0, punk: 1.04, oddball: 1.2, rich: 1.02, business: 1.04, tourist: 1.0, cook: 1.06, civilian: 0.96 };
    this._char(c, cu, t, { skin: cu.skin, skinD: shade(cu.skin, 0.74), clothes: cu.color, hunch: false, zombie: false, expr: expr, hair: cu.hair || '#2b2b2b', hat: cu.hat, walk: walk, build: BUILD[cu.type] || 1 });
    // thought bubbles above the head
    var by = p.y - S * 0.82;
    if (cu.state === 'waiting') {
      var pat0 = world.custPatience ? world.custPatience(cu) : world.patience();
      bubble(c, p.x + S * 0.26, by, cu.infectable ? '🧟' : (angry ? '😠' : '🍴'), cu.infectable ? C.toxic : '#fff', S);
      var pat = 1 - Math.min(1, (world.t - cu.wait) / pat0);
      ring(c, p.x + S * 0.26, by + S * 0.22, S * 0.1, pat, pat > 0.4 ? C.toxic : pat > 0.18 ? C.gold : C.blood, S);
    } else if (cu.state === 'queued') bubble(c, p.x + S * 0.26, by, cu.annoyed ? '😠' : '🪑', cu.annoyed ? C.blood : '#fff', S);
    else if (cu.state === 'eating') bubble(c, p.x + S * 0.26, by, (recipe(cu.dish) || {}).emoji || '🍽️', '#fff', S);
    else if (cu.state === 'paying') bubble(c, p.x + S * 0.26, by, cu.tipped ? '💰' : '🪙', C.gold, S);
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

  // ---- reusable texture / grime decals (Stage 3) ----------------------
  // scatter `n` decals deterministically inside a screen bbox
  function scatter(c, bb, n, seed, fn) { for (var i = 0; i < n; i++) { var x = bb.x + rnd(seed + i) * bb.w, y = bb.y + rnd(seed + i * 1.7 + 9) * bb.h, r = rnd(seed + i * 3.3 + 4); fn(x, y, r, i); } }
  function speck(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, r, r * 0.7, 0, 0, 7); c.fill(); }
  function stainBlob(c, x, y, r, col) {
    c.fillStyle = col; c.beginPath();
    for (var a = 0; a < 7; a++) { var ang = a / 7 * 6.283, rr2 = r * (0.7 + rnd(x + y + a) * 0.5); var px = x + Math.cos(ang) * rr2, py = y + Math.sin(ang) * rr2 * 0.62; a ? c.lineTo(px, py) : c.moveTo(px, py); }
    c.closePath(); c.fill();
  }
  function crackLine(c, x, y, len, ang, w, col) {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y);
    var px = x, py = y;
    for (var i = 1; i <= 4; i++) { ang += (rnd(x + i) - 0.5) * 0.9; px += Math.cos(ang) * len / 4; py += Math.sin(ang) * len / 4; c.lineTo(px, py); if (rnd(y + i) > 0.7) { c.moveTo(px, py); c.lineTo(px + Math.cos(ang + 1) * len * 0.15, py + Math.sin(ang + 1) * len * 0.15); c.moveTo(px, py); } }
    c.stroke();
  }
  function drip(c, x, y, len, w, col) {
    c.fillStyle = col; c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x - w * 0.6, y + len * 0.7, x, y + len); c.quadraticCurveTo(x + w * 0.6, y + len * 0.7, x + w, y); c.closePath(); c.fill();
    c.beginPath(); c.ellipse(x, y + len, w * 1.3, w * 1.1, 0, 0, 7); c.fill();
  }
  // rising puffs of smoke for burning/burnt food
  function smoke(c, x, y, S, t, col) {
    for (var i = 0; i < 3; i++) {
      var ph = (t * 0.9 + i * 0.5) % 1, yy = y - ph * S * 0.7, xx = x + Math.sin((t + i) * 2) * S * 0.1;
      c.fillStyle = 'rgba(' + (col === '#555' ? '70,70,70,' : '120,120,120,') + (0.5 * (1 - ph)) + ')';
      circle(c, xx, yy, S * (0.07 + ph * 0.12));
    }
  }
  // darken (<1) or lighten (>1) a #hex / rgb colour for side-shading
  function shade(col, f) {
    var r, g, b;
    if (col[0] === '#') { var h = col.slice(1); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); }
    else { var m = col.match(/\d+/g) || [120, 120, 120]; r = +m[0]; g = +m[1]; b = +m[2]; }
    var cl = function (v) { return Math.max(0, Math.min(255, Math.round(v))); };
    return 'rgb(' + cl(r * f) + ',' + cl(g * f) + ',' + cl(b * f) + ')';
  }
  // ---- shared iso 3D box: bottom diamond on the floor, extruded up --------
  // (x,y) = front-bottom on the floor. Returns the top geometry so callers can
  // place details (burners, basins, dishes) on the top plane.
  function isoBox(c, x, y, fw, fh, bh, top, side, feet) {
    var topY = y - bh, ow = Math.max(1.5, fw * 0.09);
    c.fillStyle = 'rgba(0,0,0,.34)'; c.beginPath(); c.ellipse(x, y + fh * 0.4, fw * 1.12, fh * 0.85, 0, 0, 7); c.fill();
    if (feet) { c.fillStyle = '#15160f'; rr(c, x - fw * 0.72, y + fh * 0.05, fw * 0.16, fh * 0.7, 2); c.fill(); rr(c, x + fw * 0.56, y + fh * 0.05, fw * 0.16, fh * 0.7, 2); c.fill(); }
    var quad = function (p, col) { c.fillStyle = col; c.beginPath(); c.moveTo(p[0][0], p[0][1]); for (var i = 1; i < 4; i++) c.lineTo(p[i][0], p[i][1]); c.closePath(); c.fill(); c.strokeStyle = C.out; c.lineWidth = ow; c.stroke(); };
    quad([[x, topY + fh], [x + fw, topY], [x + fw, y], [x, y + fh]], shade(side, 0.68));     // right-front (dark)
    quad([[x - fw, topY], [x, topY + fh], [x, y + fh], [x - fw, y]], side);                  // left-front (mid)
    quad([[x, topY - fh], [x + fw, topY], [x, topY + fh], [x - fw, topY]], top);             // top (light)
    return { x: x, topY: topY, fw: fw, fh: fh };
  }
  // clip helper to a top-diamond so details stay on the surface
  function topClip(c, b) { c.beginPath(); c.moveTo(b.x, b.topY - b.fh); c.lineTo(b.x + b.fw, b.topY); c.lineTo(b.x, b.topY + b.fh); c.lineTo(b.x - b.fw, b.topY); c.closePath(); }

  // a chunky steel cooking pot sitting on the burner at (x, y)
  function pot(c, x, y, S, col) {
    c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(x, y + S * 0.04, S * 0.17, S * 0.06, 0, 0, 7); c.fill();
    c.fillStyle = shade(col, 0.82); rr(c, x - S * 0.15, y - S * 0.16, S * 0.3, S * 0.2, S * 0.04); c.fill();
    c.strokeStyle = C.out; c.lineWidth = S * 0.025; c.stroke();
    c.strokeStyle = shade(col, 0.65); c.lineWidth = S * 0.03; c.lineCap = 'round';
    c.beginPath(); c.arc(x - S * 0.17, y - S * 0.07, S * 0.045, -1.2, 1.2); c.stroke();
    c.beginPath(); c.arc(x + S * 0.17, y - S * 0.07, S * 0.045, Math.PI - 1.2, Math.PI + 1.2); c.stroke();
    c.fillStyle = col; c.beginPath(); c.ellipse(x, y - S * 0.16, S * 0.16, S * 0.06, 0, 0, 7); c.fill();
    c.strokeStyle = C.out; c.lineWidth = S * 0.022; c.stroke();
    c.fillStyle = '#1d2a16'; c.beginPath(); c.ellipse(x, y - S * 0.16, S * 0.12, S * 0.045, 0, 0, 7); c.fill();
    c.fillStyle = shade(col, 1.18); c.beginPath(); c.ellipse(x - S * 0.05, y - S * 0.18, S * 0.06, S * 0.02, 0, 0, 7); c.fill();
  }
  function stroke(c, col, w) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; }
  function body(c, x, y, w, h, col) { c.fillStyle = col; rr(c, x - w / 2, y - h / 2, w, h, w * 0.4); c.fill(); c.strokeStyle = C.out; c.lineWidth = w * 0.09; c.stroke(); }
  function chair(c, x, y, S, back) { c.fillStyle = C.woodD; rr(c, x - S * 0.13, y - S * 0.1, S * 0.26, S * 0.18, 4); c.fill(); if (back) { c.fillStyle = C.wood; rr(c, x - S * 0.13, y - S * 0.32, S * 0.26, S * 0.12, 4); c.fill(); } c.strokeStyle = C.out; c.lineWidth = S * 0.02; rr(c, x - S * 0.13, y - S * 0.1, S * 0.26, S * 0.18, 4); c.stroke(); }
  // a small dimensional stool/chair: legs, a seat with a side face, a backrest
  function isoChair(c, x, y, S, dir) {
    c.strokeStyle = C.out; c.lineWidth = S * 0.022; c.lineCap = 'round';
    c.strokeStyle = shade(C.woodD, 0.6); c.lineWidth = S * 0.035;
    line(c, x - S * 0.1, y + S * 0.02, x - S * 0.11, y + S * 0.16); line(c, x + S * 0.1, y + S * 0.02, x + S * 0.11, y + S * 0.16);
    // backrest behind the seat
    c.fillStyle = shade(C.wood, 0.8); rr(c, x + dir * S * 0.03 - S * 0.045, y - S * 0.22, S * 0.09, S * 0.24, 3); c.fill(); c.strokeStyle = C.out; c.lineWidth = S * 0.02; c.stroke();
    // seat: side rim then top
    c.fillStyle = shade(C.wood, 0.62); c.beginPath(); c.ellipse(x, y + S * 0.04, S * 0.15, S * 0.075, 0, 0, 7); c.fill();
    c.fillStyle = C.wood; c.beginPath(); c.ellipse(x, y, S * 0.15, S * 0.08, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.ellipse(x - S * 0.04, y - S * 0.02, S * 0.08, S * 0.04, 0, 0, 7); c.fill();
    c.strokeStyle = C.out; c.lineWidth = S * 0.022; c.beginPath(); c.ellipse(x, y, S * 0.15, S * 0.08, 0, 0, 7); c.stroke();
  }
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
