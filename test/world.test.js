'use strict';
// Pure-simulation tests for the Zombie Cafe world (no canvas/DOM needed).
// Loads data.js + world.js into a sandboxed context with a seeded RNG and a
// controllable tick, then drives the real game logic and asserts outcomes.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const WWW = path.join(__dirname, '..', 'www');
const read = (f) => fs.readFileSync(path.join(WWW, f), 'utf8');

function boot() {
  let seed = 123456789;
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const M = Object.create(Math); M.random = rng;       // seeded but varied (no uid collisions)
  const ctx = { window: {}, Math: M, Date, console };
  vm.createContext(ctx);
  vm.runInContext(read('data.js'), ctx);
  vm.runInContext(read('world.js'), ctx);
  return ctx.window.createWorld();
}
function advance(w, seconds, step = 0.2) { for (let s = 0; s < seconds; s += step) w.tick(step); }

test('fresh world has the expected starting cafe', () => {
  const w = boot();
  assert.strictEqual(w.coins, 60);
  assert.strictEqual(w.toxin, 2);
  assert.strictEqual(w.stoves.length, 2);
  assert.strictEqual(w.tables.length, 3);
  assert.strictEqual(w.zombies.length, 1);
});

test('cooking deducts ingredients and stocks the pass', () => {
  const w = boot();
  assert.ok(w.startCook(w.stoves[0].id, 'coffee'));
  assert.strictEqual(w.coins, 55, 'coffee costs 5');
  assert.ok(w.stoves[0].recipe === 'coffee');
  advance(w, 9);                                        // coffee cooks in 8s
  // either it's already been picked up by a zombie or it's sitting on the pass
  const inFlight = w.ready.length + w.zombies.filter((z) => z.carry).length
    + w.customers.filter((c) => c.dish).length;
  assert.ok(inFlight >= 1, 'at least one coffee serving was produced');
});

test('full loop: customers get served and pay', () => {
  const w = boot();
  w.startCook(w.stoves[0].id, 'coffee');
  w.startCook(w.stoves[1].id, 'soup');
  advance(w, 90);
  assert.ok(w.served >= 1, 'at least one customer was served and paid, got ' + w.served);
  assert.ok(w.coins > 50, 'serving increased coins');
});

test('infecting a customer creates a new zombie worker', () => {
  const w = boot();
  w.startCook(w.stoves[0].id, 'coffee');
  let target = null;
  for (let i = 0; i < 300 && !target; i++) { w.tick(0.2); target = w.customers.find((c) => c.state === 'waiting'); }
  assert.ok(target, 'a customer sat down');
  target.infectable = true; w.toxin = 5;
  const before = w.zombies.length;
  assert.ok(w.infect(target.id), 'infect succeeded');
  assert.strictEqual(w.zombies.length, before + 1, 'gained a zombie');
  assert.strictEqual(w.toxin, 3, 'spent 2 toxin');
  assert.ok(!w.customers.find((c) => c.id === target.id), 'customer left the table');
});

test('raiding a rival cafe sends a squad and returns loot', () => {
  const w = boot();
  assert.ok(w.canRaid('diner'), 'can raid the starter rival');
  assert.ok(w.startRaid('diner'));
  assert.strictEqual(w.zombies.length, 0, 'squad marched off');
  assert.ok(w.raid, 'raid in progress');
  advance(w, 32);                                       // diner raid takes 30s
  assert.strictEqual(w.raid, null, 'raid resolved');
  assert.strictEqual(w.zombies.length, 1, 'squad returned');
  assert.strictEqual(w.coins, 180, 'won 120 coins of loot');
});

test('data integrity: recipes profitable, rivals rewarding, ids unique', () => {
  const ctx = { window: {}, Math, Date };
  vm.createContext(ctx); vm.runInContext(read('data.js'), ctx);
  const ids = new Set();
  for (const r of ctx.window.RECIPES) {
    assert.ok(!ids.has(r.id), 'dup recipe ' + r.id); ids.add(r.id);
    assert.ok(r.price * r.batch > r.cost, r.id + ' must be profitable');
  }
  for (const rv of ctx.window.RIVALS) assert.ok(rv.reward > 0 && rv.squad > 0, rv.id + ' valid');
});
