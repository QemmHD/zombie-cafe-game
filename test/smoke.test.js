'use strict';
// Headless smoke test: loads the real game into jsdom, drives the full core
// loop (cook -> plate -> serve -> collect) via simulated taps, and asserts the
// economy responds. Catches runtime errors that a syntax check cannot.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const WWW = path.join(__dirname, '..', 'www');
const read = (f) => fs.readFileSync(path.join(WWW, f), 'utf8');

function boot() {
  const html = read('index.html').replace(/<script[^>]*><\/script>/g, '');
  const dom = new JSDOM(html, { url: 'https://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
  const win = dom.window;

  // deterministic-but-varied randomness (constant would collide all uids) +
  // a controllable clock so we can fast-forward real-time timers.
  let seed = 0x9e3779b9;
  win.Math.random = () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let ms = 1_700_000_000_000;
  win.Date.now = () => ms;

  // capture the game loop instead of letting it auto-run; swallow fx timeouts
  let tick = null;
  win.setInterval = (fn) => { tick = fn; return 1; };
  win.setTimeout = () => 0;

  // fresh storage every boot
  win.localStorage.clear();

  win.eval(read('data.js'));
  win.eval(read('game.js'));
  // jsdom may have already fired DOMContentLoaded before we injected the
  // script, so nudge init() to run if it took the "loading" branch.
  win.document.dispatchEvent(new win.Event('DOMContentLoaded'));

  const advance = (seconds, step = 0.2) => {
    for (let s = 0; s < seconds; s += step) { ms += step * 1000; tick(); }
  };
  const click = (node) => {
    node.dispatchEvent(new win.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  };
  const q = (sel) => win.document.querySelector(sel);
  const coins = () => parseInt(q('.stat.coins').textContent.replace(/\D/g, ''), 10);

  return { win, advance, click, q, coins, document: win.document };
}

test('boots and renders the starting cafe', () => {
  const g = boot();
  assert.strictEqual(g.coins(), 60, 'starts with 60 coins');
  assert.strictEqual(g.document.querySelectorAll('#kitchen .stove').length, 2, 'two stoves');
  assert.strictEqual(g.document.querySelectorAll('#dining .table').length, 3, 'three tables');
});

test('cooking deducts ingredients and starts a timer', () => {
  const g = boot();
  const stove = g.q('#kitchen .stove');
  g.click(stove);                                   // open cook picker
  const pick = g.q('[data-action="cook-pick"][data-id="coffee"]');
  assert.ok(pick, 'cook picker lists coffee');
  g.click(pick);                                    // start cooking coffee (cost 5)
  assert.strictEqual(g.coins(), 55, 'coffee cost 5 coins');
  g.advance(0.4);
  assert.ok(g.q('#kitchen .stove.cooking'), 'a stove is now cooking');
});

test('full loop: cook -> ready -> auto-plate -> serve -> collect earns coins', () => {
  const g = boot();
  // cook two batches of coffee so the counter has plenty of servings
  g.document.querySelectorAll('#kitchen .stove').forEach((stove) => {
    g.click(stove);
    g.click(g.q('[data-action="cook-pick"][data-id="coffee"]'));
  });
  assert.strictEqual(g.coins(), 50, 'two coffees cost 10');

  g.advance(10);                                    // cook (8s) + become ready
  assert.ok(g.q('#kitchen .stove.ready') || g.q('.tray-pill'), 'dish ready');
  g.advance(8);                                     // auto-plate window
  const ready = parseInt(g.q('.tray-pill b').textContent, 10);
  assert.ok(ready >= 3, 'servings reached the ready counter, got ' + ready);

  // let customers arrive, get served, and reach the paying state; tap to collect
  let collected = false;
  const before = g.coins();
  for (let i = 0; i < 300 && !collected; i++) {
    g.advance(0.2);
    const paying = g.q('.card.table.paying');
    if (paying) { g.click(paying); collected = true; }
  }
  assert.ok(collected, 'a customer reached paying and was collected');
  assert.ok(g.coins() > before, 'collecting a customer increased coins');
});

test('data integrity: recipes are profitable and ids unique', () => {
  const sandbox = { window: {} };
  require('node:vm').runInNewContext(read('data.js'), sandbox);
  const ids = new Set();
  for (const r of sandbox.window.RECIPES) {
    assert.ok(!ids.has(r.id), 'duplicate recipe id ' + r.id);
    ids.add(r.id);
    assert.ok(r.price * r.batch > r.cost, r.id + ' must be profitable');
    assert.ok(r.time > 0 && r.batch > 0, r.id + ' has valid timing');
  }
});
