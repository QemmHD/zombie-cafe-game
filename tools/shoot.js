#!/usr/bin/env node
/* =====================================================================
 * Screenshot harness — renders every world-scene demo state to a PNG so the
 * art can be visually inspected and diffed against the reference analysis.
 *
 *   npm run shoot            # capture all demo states at phone aspect
 *   node tools/shoot.js busy # capture one
 *
 * Requires node-canvas:  npm install --no-save canvas
 * Output: artifacts/screenshots/current/<state>.png
 *
 * NOTE: this captures the <canvas> WORLD only (node-canvas can't render the DOM
 * HUD/panels). Use the in-game debug menu (#debug) in a real browser to grab the
 * HUD/store/cookbook/etc. panel screens.
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let createCanvas;
try { ({ createCanvas } = require('canvas')); }
catch (e) {
  console.error('Missing dependency "canvas". Install it first:\n  npm install --no-save canvas');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const WWW = path.join(ROOT, 'www');
const OUT = path.join(ROOT, 'artifacts', 'screenshots', 'current');
const read = (f) => fs.readFileSync(path.join(WWW, f), 'utf8');

// deterministic, varied RNG (constant would collide uids)
function seededMath() {
  let s = 0x1a2b3c4d;
  const M = Object.create(Math);
  M.random = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  return M;
}

function mkCanvas(w, h) {
  const cv = createCanvas(w, h);
  Object.defineProperty(cv, 'clientWidth', { value: w });
  Object.defineProperty(cv, 'clientHeight', { value: h });
  return cv;
}

function capture(name, W, H) {
  const ctx = { window: { devicePixelRatio: 2 }, Math: seededMath(), Date, console };
  vm.createContext(ctx);
  ['data.js', 'world.js', 'render.js', 'demostates.js'].forEach((f) => vm.runInContext(read(f), ctx));
  const world = ctx.window.createWorld();
  // settle a couple of ticks so positions/timers are sane, then apply the demo
  for (let i = 0; i < 8; i++) world.tick(0.2);
  const ui = ctx.window.applyDemo(world, name) || {};
  const cv = mkCanvas(W, H);
  const r = new ctx.window.Renderer(cv);
  r.draw(world, 6.0, ui);
  const file = path.join(OUT, name + '.png');
  fs.writeFileSync(file, cv.toBuffer('image/png'));
  return file;
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  // discover the demo list from the module
  const probe = { window: { devicePixelRatio: 2 }, Math: seededMath(), Date, console };
  vm.createContext(probe);
  ['data.js', 'world.js', 'render.js', 'demostates.js'].forEach((f) => vm.runInContext(read(f), probe));
  const all = probe.window.DEMO_LIST || [];
  const want = process.argv.slice(2);
  const states = want.length ? want : all;
  const W = 390 * 2, H = 844 * 2;     // iPhone-ish portrait at dpr 2
  states.forEach((s) => {
    if (!all.includes(s)) { console.warn('unknown demo state:', s, '\n  available:', all.join(', ')); return; }
    const f = capture(s, W, H);
    console.log('captured', path.relative(ROOT, f));
  });
}

main();
