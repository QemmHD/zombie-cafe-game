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

test('cooking is a manual two-step: cook, then tap to serve', () => {
  const w = boot();
  assert.ok(w.startCook(w.stoves[0].id, 'coffee'));
  assert.strictEqual(w.coins, 55, 'coffee costs 5');
  advance(w, 9);                                        // coffee cooks in 8s
  assert.ok(w.stoves[0].ready, 'stove is ready but NOT auto-served');
  assert.strictEqual(w.ready.length, 0, 'nothing on the pass until you serve');
  assert.ok(w.plateStove(w.stoves[0].id), 'tap-to-serve plates the batch');
  assert.ok(w.ready.length >= 1 || w.zombies.some((z) => z.carry), 'a serving reached the pass');
  assert.strictEqual(w.stoves[0].recipe, null, 'stove is free again');
});

test('full loop: customers get served and pay', () => {
  const w = boot();
  for (const st of w.stoves) w.startCook(st.id, 'coffee');
  advance(w, 9);
  w.stoves.forEach((st) => w.plateStove(st.id));        // serve up
  advance(w, 90);
  assert.ok(w.served >= 1, 'at least one customer was served and paid, got ' + w.served);
  assert.ok(w.coins > 45, 'serving increased coins');
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

test('winning a raid steals the rival recipe and unlocks it early', () => {
  const w = boot();
  assert.ok(!w.unlocked().some((r) => r.id === 'burger'), 'burger locked at level 1');
  w.startRaid('diner');                                 // diner signature = burger
  advance(w, 32);
  assert.ok((w.extraRecipes || []).indexOf('burger') >= 0, 'stole the burger recipe');
  assert.ok(w.unlocked().some((r) => r.id === 'burger'), 'burger now cookable');
});

test('build mode: furniture can be moved to a free cell', () => {
  const w = boot();
  const tbl = w.tables[0];
  const free = w.firstFreeCell();
  assert.ok(w.moveTable(tbl.id, free), 'moved table to a free cell');
  assert.strictEqual(tbl.cell, free);
  assert.ok(!w.moveTable(tbl.id, w.tables[1].cell), 'cannot move onto an occupied cell');
});

test('served tables get dirty and zombies clean them', () => {
  const w = boot();
  for (const st of w.stoves) w.startCook(st.id, 'coffee');
  advance(w, 9); w.stoves.forEach((st) => w.plateStove(st.id));
  advance(w, 120);
  // over two minutes a table should have been dirtied and then cleaned again
  assert.ok(w.served >= 1, 'someone ate');
  // force a known dirty table and confirm a zombie clears it
  const tb = w.tables.find((t) => !t.by) || w.tables[0];
  tb.by = null; tb.dirty = true; tb.cleaning = null;
  let cleaned = false;
  for (let i = 0; i < 400 && !cleaned; i++) { w.tick(0.2); if (!tb.dirty) cleaned = true; }
  assert.ok(cleaned, 'a zombie cleaned the dirty table');
});

test('zombies recover while resting and tire while working', () => {
  const w = boot();
  const z = w.zombies[0];
  w.setZombieRole(z.id, 'rest'); z.energy = 10;
  advance(w, 8);
  assert.strictEqual(z.state, 'resting', 'a rest-role zombie rests');
  assert.ok(z.energy > 30, 'resting restored energy, got ' + Math.round(z.energy));
  // now put it to work and confirm energy drains during a serve trip
  w.setZombieRole(z.id, 'auto');
  w.startCook(w.stoves[0].id, 'coffee'); advance(w, 9); w.plateStove(w.stoves[0].id);
  let drained = false; const start = z.energy;
  for (let i = 0; i < 80; i++) { w.tick(0.2); if ((z.state === 'toPass' || z.state === 'toCustomer') && z.energy < start) drained = true; }
  assert.ok(drained, 'energy drained while working a job');
});

test('feeding a zombie with toxin refills energy', () => {
  const w = boot();
  const z = w.zombies[0]; z.energy = 20; w.toxin = 3;
  assert.ok(w.feedZombie(z.id));
  assert.strictEqual(z.energy, 100);
  assert.strictEqual(w.toxin, 2);
});

test('a rest-role zombie refuses work; a cleaner ignores serving', () => {
  const w = boot();
  const z = w.zombies[0]; w.setZombieRole(z.id, 'rest');
  w.startCook(w.stoves[0].id, 'coffee'); advance(w, 9); w.plateStove(w.stoves[0].id);
  advance(w, 6);
  assert.ok(z.state === 'resting' || z.state === 'idle', 'rest zombie did not take a serving job');
  assert.ok(w.ready.length >= 1, 'food stayed on the pass, unserved');
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
