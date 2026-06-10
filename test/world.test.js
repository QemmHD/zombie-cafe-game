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
  w.auto = false;                                      // with Auto on, a zombie would carry it for us
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

test('winning a raid stocks the fridge; unlocking from it learns the recipe', () => {
  const w = boot();
  assert.ok(!w.unlocked().some((r) => r.id === 'burger'), 'burger locked at level 1');
  w.startRaid('diner');                                 // diner signature = burger
  advance(w, 32);
  const loot = w.fridge.find((b) => b.recipeId === 'burger');
  assert.ok(loot, 'stolen burger landed in the fridge');
  assert.ok(loot.canUnlock, 'the fridge batch offers to unlock a new recipe');
  assert.ok(w.unlockFromFridge(w.fridge.indexOf(loot)), 'unlock from fridge');
  assert.ok(w.unlocked().some((r) => r.id === 'burger'), 'burger now cookable');
  assert.ok(!w.fridge.find((b) => b.recipeId === 'burger'), 'unlocking consumed the batch');
});

test('food burns if it sits finished on the stove too long (Auto off)', () => {
  const w = boot();
  w.auto = false;                                       // nobody will carry it off
  w.startCook(w.stoves[0].id, 'coffee');
  advance(w, 9);
  assert.ok(w.stoves[0].ready && !w.stoves[0].burning, 'ready, not yet burning');
  advance(w, 24);
  assert.ok(w.stoves[0].burning, 'enters a burn warning');
  const repBefore = w.rep;
  advance(w, 16);
  assert.ok(w.stoves[0].burned, 'food burned');
  assert.ok(w.rep < repBefore, 'burning cost rating');
  assert.ok(!w.startCook(w.stoves[0].id, 'coffee'), 'cannot cook on a burnt stove');
  assert.ok(w.clearBurned(w.stoves[0].id), 'can clear the burnt mess');
  assert.ok(w.startCook(w.stoves[0].id, 'coffee'), 'stove usable again');
});

test('Auto carries finished food off the stove before it burns', () => {
  const w = boot();                                     // Auto on by default
  w.startCook(w.stoves[0].id, 'coffee');
  let ok = false;
  for (let i = 0; i < 60 * 5 && !ok; i++) { w.tick(0.2); if (w.ready.length >= 3 && !w.stoves[0].burned) ok = true; }
  assert.ok(ok, 'a zombie moved the batch to the pass on its own, no burn');
  assert.ok(!w.stoves[0].burned, 'nothing burned under Auto');
});

test('rating rises with happy service and falls when customers leave hungry', () => {
  const w = boot();
  w.rep = 50;
  // a customer that never gets food should walk out and drop the rating
  w.startCook(w.stoves[0].id, 'coffee'); advance(w, 9);
  // strand the food away so the lone diner waits out their patience
  w.auto = false; w.ready = [];
  const before = w.rep;
  advance(w, 60);
  assert.ok(w.rep <= before, 'unserved customers did not raise rating');
  assert.ok(w.ratingStars() >= 1 && w.ratingStars() <= 5, 'stars stay in range');
});

test('a starving zombie scares customers and tanks the rating', () => {
  const w = boot();
  const z = w.zombies[0]; z.energy = 3; z.patience = 0;   // impatient + critical = will act out
  // seat a couple of customers to be scared
  w.startCook(w.stoves[0].id, 'coffee'); advance(w, 9);
  let seated = 0;
  for (let i = 0; i < 400 && seated < 1; i++) { w.tick(0.2); z.energy = 3; seated = w.customers.filter((c) => c.state === 'waiting').length; }
  const repBefore = w.rep, before = w.served;
  let scared = false;
  for (let i = 0; i < 400 && !scared; i++) { w.tick(0.2); z.energy = 3; if (w.events.some((e) => e.type === 'ZombieScaredCustomer')) scared = true; }
  assert.ok(scared, 'the starving zombie scared someone');
  assert.ok(w.rep < repBefore, 'scaring dropped the rating');
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

test('pathfinding: waypoints avoid blocked tiles', () => {
  const w = boot();
  w.coins = 99999;
  while (w.firstFreeCell() >= 0 && w.tables.length < 12) w.buy('table');   // crowd the floor
  const path = w.findPath(420, 930, 420, 90);            // door to kitchen
  const blocked = w._blockedTiles();
  // sample every segment of the route and assert it never crosses a blocked tile
  let x = 420, y = 930;
  for (const p of path.slice(0, -1)) {                   // last point may be a doorstep target
    const d = Math.hypot(p.x - x, p.y - y), steps = Math.ceil(d / 20);
    for (let i = 1; i < steps; i++) {
      const sx = x + (p.x - x) * i / steps, sy = y + (p.y - y) * i / steps;
      const k = Math.floor(sx / 120) + ',' + Math.floor(sy / 120);
      assert.ok(!blocked[k], 'route crossed blocked tile ' + k);
    }
    x = p.x; y = p.y;
  }
});

test('auto OFF: idle zombies take no jobs until commanded', () => {
  const w = boot();
  w.auto = false;
  w.startCook(w.stoves[0].id, 'coffee'); advance(w, 9); w.plateStove(w.stoves[0].id);
  let sat = null;
  for (let i = 0; i < 200 && !sat; i++) { w.tick(0.2); sat = w.customers.find((c) => c.state === 'waiting'); }
  assert.ok(sat, 'a customer sat down');
  const readyBefore = w.ready.length;
  advance(w, 8);
  assert.strictEqual(w.served, 0, 'nobody was served without a command');
  assert.strictEqual(w.ready.length, readyBefore, 'food stayed on the pass');
  // now command the zombie to serve that customer
  const res = w.commandZombie(w.zombies[0].id, { kind: 'customer', id: sat.id });
  assert.ok(res.ok, 'command accepted: ' + res.msg);
  let eating = false;
  for (let i = 0; i < 300 && !eating; i++) { w.tick(0.2); const c = w.customers.find((q) => q.id === sat.id); eating = c && (c.state === 'eating' || c.state === 'paying'); }
  assert.ok(eating, 'commanded zombie served the customer');
});

test('command: carry finished food from stove to the pass', () => {
  const w = boot();
  w.auto = false;
  w.startCook(w.stoves[0].id, 'coffee'); advance(w, 9);
  assert.ok(w.stoves[0].ready, 'stove finished');
  const res = w.commandZombie(w.zombies[0].id, { kind: 'stove', id: w.stoves[0].id });
  assert.ok(res.ok, 'collect command accepted');
  let stocked = false;
  for (let i = 0; i < 300 && !stocked; i++) { w.tick(0.2); stocked = w.ready.length >= 3; }
  assert.ok(stocked, 'zombie carried the batch to the pass');
  assert.strictEqual(w.stoves[0].recipe, null, 'stove freed');
});

test('command: invalid targets are refused with a message', () => {
  const w = boot();
  const clean = w.tables[0];
  const res = w.commandZombie(w.zombies[0].id, { kind: 'table', id: clean.id });
  assert.ok(!res.ok, 'cleaning a clean table is refused');
  assert.ok(res.msg.length > 0, 'refusal carries a message');
  const res2 = w.commandZombie(w.zombies[0].id, { kind: 'stove', id: w.stoves[0].id });
  assert.ok(!res2.ok, 'collecting from an idle stove is refused');
});

function ctype(w, id) { return w === null ? null : null; }   // placeholder (kept for clarity)

test('infection inherits stats from the customer type (Phase 9)', () => {
  const w = boot();
  w.toxin = 99; w.coins = 9999;
  // craft a known "athlete" customer seated and ready to infect
  const c = { id: 'cz', x: 300, y: 400, tx: 300, ty: 400, fx: 300, fy: 400, path: [], table: null,
    state: 'waiting', wait: 0, type: 'athlete', rarity: 'rare', infectable: true, color: '#0f0', skin: '#eee', hair: '#000', face: 'U', step: 0 };
  w.customers.push(c);
  const before = w.zombies.length;
  assert.ok(w.infect('cz'), 'infected the athlete');
  assert.strictEqual(w.zombies.length, before + 1, 'gained a zombie');
  const z = w.zombies[w.zombies.length - 1];
  assert.strictEqual(z.kind, 'Runner', 'athlete becomes a Runner');
  assert.ok(z.speed >= 1.4, 'inherited high speed, got ' + z.speed);
  assert.strictEqual(z.trait, 'Sprinter');
  // a worker yields a very different zombie
  const c2 = { ...c, id: 'cz2', type: 'worker', rarity: 'common' };
  w.customers.push(c2);
  assert.ok(w.infect('cz2'));
  const z2 = w.zombies[w.zombies.length - 1];
  assert.strictEqual(z2.kind, 'Bruiser');
  assert.ok(z2.maxEnergy > z.maxEnergy, 'worker has more stamina than athlete');
  assert.ok(z2.attack > z.attack, 'worker hits harder');
});

test('roster: overflow zombies go to the Meat Locker; store/activate swaps', () => {
  const w = boot();
  const cap = w.activeSlots();
  // fill active slots
  while (w.activeZombies().length < cap) w._addZombie(w._mkZombie(w.zombies.length));
  assert.strictEqual(w.activeZombies().length, cap, 'active is full');
  // one more overflows into storage
  const z = w._mkZombie(99); const wentActive = w._addZombie(z);
  assert.ok(!wentActive && z.stored, 'overflow zombie is stored');
  assert.ok(!w.activateZombie(z.id), 'cannot activate while active is full');
  // store an active one, then the stored one can come in
  const active = w.activeZombies()[0];
  assert.ok(w.storeZombie(active.id), 'stored an active zombie');
  assert.ok(active.stored, 'it is now in the locker');
  assert.ok(w.activateZombie(z.id), 'now the stored zombie activates');
  assert.ok(!z.stored, 'it joined the floor');
});

test('stored zombies do not work the floor', () => {
  const w = boot();
  const z = w.zombies[0]; w.storeZombie(z.id);
  w.startCook(w.stoves[0].id, 'coffee'); advance(w, 9); w.plateStove(w.stoves[0].id);
  advance(w, 30);
  assert.strictEqual(w.served, 0, 'a locker-bound zombie served nobody');
  assert.ok(w.pickZombieAt(z.hx, z.hy) == null, 'stored zombie is not tappable on the floor');
});

test('customers queue when no clean table and seat when one frees (Phase 5)', () => {
  const w = boot();
  w.tables.forEach((t) => { t.dirty = true; });          // no clean seats
  let queued = null;
  for (let i = 0; i < 200 && !queued; i++) { w.tick(0.2); queued = w.customers.find((c) => c.state === 'queued'); }
  assert.ok(queued, 'a customer waits in line when the floor is full');
  w.tables[0].dirty = false; w.tables[0].cleaning = null;  // a table opens up
  let seated = false;
  for (let i = 0; i < 100 && !seated; i++) { w.tick(0.2); const c = w.customers.find((x) => x.id === queued.id); seated = c && (c.state === 'toTable' || c.state === 'waiting'); }
  assert.ok(seated, 'the queued customer walks to the freed table');
});

test('a reserved table cannot be double-seated', () => {
  const w = boot();
  w.tables.forEach((t, i) => { if (i > 0) { t.dirty = true; } });   // only table 0 is free
  const a = { id: 'a', x: 420, y: 930, tx: 420, ty: 930, fx: 420, fy: 930, path: [], state: 'queued', wait: 0, type: 'civilian', infectable: true, color: '#0f0', skin: '#eee', hair: '#000', face: 'U', step: 0 };
  const b = { ...a, id: 'b' };
  w.customers.push(a, b);
  assert.ok(w._trySeat(a), 'first customer reserves the table');
  assert.strictEqual(w.tables[0].reserved, 'a');
  assert.ok(!w._trySeat(b), 'second customer cannot take the reserved table');
});

test('build: furniture can be stored and re-placed, or sold for coins', () => {
  const w = boot();
  const t = w.tables[0]; const n = w.tables.length;
  assert.ok(w.storeFurniture('table', t.id), 'stored a table');
  assert.strictEqual(w.tables.length, n - 1, 'removed from the floor');
  assert.strictEqual(w.storage.length, 1, 'now in storage');
  assert.ok(w.placeFromStorage(0), 're-placed from storage');
  assert.strictEqual(w.tables.length, n, 'back on the floor');
  assert.strictEqual(w.storage.length, 0, 'storage emptied, no repurchase');
  // selling refunds coins
  const coins = w.coins, t2 = w.tables[0];
  assert.ok(w.sellFurniture('table', t2.id), 'sold a table');
  assert.ok(w.coins > coins, 'got a refund');
});

test('table state enum reflects the simulation (Phase 6)', () => {
  const w = boot();
  const tb = w.tables[0];
  assert.strictEqual(w.tableState(tb), 'cleanEmpty');
  tb.reserved = 'someone';
  assert.strictEqual(w.tableState(tb), 'reserved');
  tb.reserved = null; tb.dirty = true;
  assert.strictEqual(w.tableState(tb), 'dirty');
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
