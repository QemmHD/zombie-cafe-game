#!/usr/bin/env node
/* =====================================================================
 * Sprite baker (Stage 4.10) — renders each priority object/character from the
 * game's own procedural painters into anchored PNG sprite assets, and writes
 * www/assets/sprites/manifest.json.
 *
 *   npm run bake
 *
 * This makes the art an ASSET LAYER: every entry in the manifest can later be
 * replaced by a hand-drawn / generated PNG with the same anchors, without
 * touching game code. All baked output is original art (drawn by our own code).
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let createCanvas;
try { ({ createCanvas } = require('canvas')); }
catch (e) { console.error('Missing "canvas" — npm install --no-save canvas'); process.exit(1); }

const ROOT = path.join(__dirname, '..');
const WWW = path.join(ROOT, 'www');
const OUT = path.join(WWW, 'assets', 'sprites');
const read = (f) => fs.readFileSync(path.join(WWW, f), 'utf8');

function mkcv(w, h) { const cv = createCanvas(w, h); Object.defineProperty(cv, 'clientWidth', { value: w }); Object.defineProperty(cv, 'clientHeight', { value: h }); return cv; }
function seededM() { let s = 0x51f15eed; const M = Object.create(Math); M.random = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; return M; }

function boot() {
  const ctx = { window: { devicePixelRatio: 1 }, Math: seededM(), Date, console };
  vm.createContext(ctx);
  ['data.js', 'world.js', 'render.js'].forEach((f) => vm.runInContext(read(f), ctx));
  return ctx;
}

// Bake one sprite: a fresh renderer whose projection is pinned so the object's
// base lands at the anchor point inside a fixed frame.
function bake(file, draw, opts) {
  const FW = opts.w || 320, FH = opts.h || 380, AX = FW / 2, AY = opts.ay || FH - 70;
  const ctx = boot();
  const cv = mkcv(FW, FH);
  const r = new ctx.window.Renderer(cv);
  r.S = r.TW = opts.S || 150; r.TH = r.S * 0.5; r.dpr = 1;
  if (opts.world) {
    // REAL projection (multi-tile slabs need distinct corner projections),
    // with the given world point mapped onto the frame anchor
    const KX = (opts.S || 150) / 240, KY = KX * 0.56;
    const OX = AX - (opts.world[0] - opts.world[1]) * KX;
    const OY = AY - (opts.world[0] + opts.world[1]) * KY;
    r.KX = KX; r.KY = KY; r.OX = OX; r.OY = OY;
    r.project = (x, y) => ({ x: OX + (x - y) * KX, y: OY + (x + y) * KY });
  } else {
    r.project = () => ({ x: AX, y: AY });   // pin the object base to the anchor
  }
  r._defer = []; r._custs = []; r._selZ = null; r._t = 1.0; r._foodReady = false;
  const c = cv.getContext('2d');
  draw(r, c, ctx);
  r._defer.forEach((fn) => fn());
  const full = path.join(OUT, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, cv.toBuffer('image/png'));
  return { file: 'assets/sprites/' + file.replace(/\\/g, '/'), frameWidth: FW, frameHeight: FH, anchorX: AX, anchorY: AY, bakeS: opts.S || 150 };
}

function main() {
  const S = 150;
  const manifest = { generated: new Date().toISOString().slice(0, 10), note: 'Baked from the game’s own painters — every entry is replaceable by a drawn PNG with the same anchors.', sprites: {} };
  const add = (id, meta, extra) => { manifest.sprites[id] = Object.assign({ id, renderLayer: 1, procedureFallback: true }, meta, extra || {}); };

  // ---- furniture / kitchen (static bases) ----
  // tables split into BASE + TOP so runtime keeps the seated-diner occlusion
  add('table_base', bake('furniture/tables/table_base.png', (r, c) => { const tb = { id: 'bake-t', x: 0, y: 0, by: null, dirty: false, cleaning: null }; r._table(c, tb, false, 1); }, { S }), { category: 'furniture', footprint: [1, 1] });
  add('table_top_clean', bake('furniture/tables/table_top_clean.png', (r, c) => { const tb = { id: 'bake-t', x: 0, y: 0, by: null, dirty: false, cleaning: null }; r._tableTop(c, tb, false, 1); }, { S }), { category: 'furniture', footprint: [1, 1] });
  add('table_top_dirty', bake('furniture/tables/table_top_dirty.png', (r, c) => { const tb = { id: 'bake-t', x: 0, y: 0, by: null, dirty: true, cleaning: null }; r._tableTop(c, tb, false, 1); }, { S }), { category: 'furniture', footprint: [1, 1] });
  add('table_clean', bake('furniture/tables/table_clean.png', (r, c) => { const tb = { id: 'bake-t', x: 0, y: 0, by: null, dirty: false, cleaning: null }; r._table(c, tb, false, 1); r._tableTop(c, tb, false, 1); }, { S }), { category: 'furniture', footprint: [1, 1] });
  add('table_dirty', bake('furniture/tables/table_dirty.png', (r, c) => { const tb = { id: 'bake-t', x: 0, y: 0, by: null, dirty: true, cleaning: null }; r._table(c, tb, false, 1); r._tableTop(c, tb, false, 1); }, { S }), { category: 'furniture', footprint: [1, 1] });
  // stove body WITHOUT the state overlay (runtime draws pot/tags/progress live)
  add('stove_body', bake('kitchen/stoves/stove_body.png', (r, c, ctx) => { const w = ctx.window.createWorld(); r._stoveState = function () {}; r._stove(c, { id: 'bake-s', x: 0, y: 0, recipe: null, ready: false }, w, 1, false); }, { S }), { category: 'kitchen', footprint: [1, 1] });
  add('stove_idle', bake('kitchen/stoves/stove_idle.png', (r, c, ctx) => { const w = ctx.window.createWorld(); r._stove(c, { id: 'bake-s', x: 0, y: 0, recipe: null, ready: false }, w, 1, false); }, { S }), { category: 'kitchen', footprint: [1, 1] });
  add('pass_body', bake('kitchen/counters/pass_body.png', (r, c, ctx) => { const w = ctx.window.createWorld(); w.ready = []; r._pass(c, w); }, { S, w: 480, h: 400, ay: 310, world: [480, 180] }), { category: 'kitchen', footprint: [2, 1] });
  add('pass_counter', bake('kitchen/counters/pass_counter.png', (r, c, ctx) => { const w = ctx.window.createWorld(); w.ready = []; r._pass(c, w); }, { S, w: 480, h: 400, ay: 310, world: [480, 180] }), { category: 'kitchen', footprint: [2, 1] });
  add('prep_counter', bake('kitchen/counters/prep_counter.png', (r, c) => { r._decor(c, { id: 'bake-c', deco: 'counter', x: 0, y: 0 }, false); }, { S }), { category: 'kitchen', footprint: [1, 1] });
  add('sink', bake('kitchen/sink/sink.png', (r, c) => { r._decor(c, { id: 'bake-sk', deco: 'sink', x: 0, y: 0 }, false); }, { S }), { category: 'kitchen', footprint: [1, 1] });
  add('fridge', bake('kitchen/fridge/fridge.png', (r, c) => { r._decor(c, { id: 'bake-f', deco: 'fridge', x: 0, y: 0 }, false); }, { S, h: 440, ay: 360 }), { category: 'kitchen', footprint: [1, 1] });
  add('chair', bake('furniture/chairs/chair.png', (r, c) => { r._chairSprite(c, 160, 250, 1); }, { S, w: 320, h: 320, ay: 250 }), { category: 'furniture', footprint: [1, 1] });
  add('plant', bake('decor/plant.png', (r, c) => { r._decor(c, { id: 'bake-p', deco: 'plant', x: 0, y: 0 }, false); }, { S }), { category: 'decor', footprint: [1, 1] });
  add('lamp', bake('decor/lamp.png', (r, c) => { r._decor(c, { id: 'bake-l', deco: 'lamp', x: 0, y: 0 }, false); }, { S, h: 420, ay: 340 }), { category: 'decor', footprint: [1, 1] });

  // ---- characters (4 facings each; idle frame) ----
  const faces = ['D', 'L', 'R', 'U'];
  const znames = { chef: { kind: 'Chef' }, server: { kind: 'Server' } };
  Object.keys(znames).forEach((zk) => {
    faces.forEach((f) => {
      add('zombie_' + zk + '_' + f, bake('characters/zombies/' + zk + '_' + f + '.png', (r, c, ctx) => {
        const w = ctx.window.createWorld();
        const z = w.zombies[0]; z.x = 0; z.y = 0; z.face = f; z.state = 'idle'; z.step = 0; z.energy = 100;
        r._zombie(c, z, 1);
      }, { S }), { category: 'character', facing: f, footprint: [1, 1] });
    });
  });
  ['civilian', 'worker', 'punk'].forEach((ct, idx) => {
    faces.forEach((f) => {
      add('customer_' + ct + '_' + f, bake('characters/customers/' + ct + '_' + f + '.png', (r, c, ctx) => {
        const TY = (ctx.window.CUSTOMER_TYPES || []).find((t) => t.id === ct) || {};
        const w = ctx.window.createWorld();
        // baked in 'leaving' state (no thought bubble baked into the sprite)
        const cu = { id: 'bake-cu', x: 0, y: 0, state: 'leaving', wait: 0, type: ct, color: TY.shirt || '#6fa8dc', skin: '#e0ac69', hair: ['#2b2b2b', '#5a3a1a', '#b04a2a'][idx], hat: TY.hat, face: f, step: 0 };
        r._customer(c, cu, w, 1);
      }, { S }), { category: 'character', facing: f, footprint: [1, 1] });
    });
  });

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('baked', Object.keys(manifest.sprites).length, 'sprites -> www/assets/sprites/ (+ manifest.json)');
}

main();
