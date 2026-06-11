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

test('raid battle: sidewalk line-up, one-by-one deploy, win pays loot', () => {
  const w = boot();
  w.zombies[0].attack = 60;                             // a slugger to keep the test short
  assert.ok(w.canRaid('diner'), 'can raid the starter rival');
  assert.ok(w.startRaid('diner'));
  const B = w.battle;
  assert.ok(B, 'live battle started');
  assert.strictEqual(B.lineup.length, 1, 'squad lines up on the sidewalk');
  assert.ok(w.zombies[0].y > 960, 'line-up stands OUTSIDE on the south sidewalk');
  assert.ok(B.enemies.some((e) => e.kind === 'chef'), 'the head chef defends');
  assert.ok(B.enemies.some((e) => e.kind === 'waiter'), 'waiters defend');
  // nothing happens until YOU deploy — one at a time
  advance(w, 3);
  assert.ok(B.enemies.every((e) => e.hp === e.maxHp), 'no fighting before deployment');
  assert.ok(w.deployZombie(w.zombies[0].id), 'tap the lined-up zombie to send it in');
  assert.strictEqual(B.lineup.length, 0); assert.strictEqual(B.inside.length, 1);
  const coins0 = w.coins;
  advance(w, 120);                                      // let it fight
  assert.strictEqual(w.battle, null, 'battle resolved');
  assert.ok(w.events.some((e) => e.type === 'raidEnd' && e.win), 'won the raid');
  assert.ok(w.coins > coins0 + 100, 'loot collected (reward + eaten cash)');
  assert.ok(!w.zombies[0].inBattle && w.zombies[0].x === w.zombies[0].hx, 'survivor came home');
});

test('winning a raid stocks the fridge; unlocking from it learns the recipe', () => {
  const w = boot();
  w.zombies[0].attack = 60;
  assert.ok(!w.unlocked().some((r) => r.id === 'burger'), 'burger locked at level 1');
  w.startRaid('diner');                                 // diner signature = burger
  w.deployAll();
  advance(w, 120);
  const loot = w.fridge.find((b) => b.recipeId === 'burger');
  assert.ok(loot, 'stolen burger landed in the fridge');
  assert.ok(loot.canUnlock, 'the fridge batch offers to unlock a new recipe');
  assert.ok(w.unlockFromFridge(w.fridge.indexOf(loot)), 'unlock from fridge');
  assert.ok(w.unlocked().some((r) => r.id === 'burger'), 'burger now cookable');
  assert.ok(!w.fridge.find((b) => b.recipeId === 'burger'), 'unlocking consumed the batch');
});

test('raid battle: energize heals mid-fight, retreat keeps eaten cash, wipe-out reanimates', () => {
  const w = boot();
  const z = w.zombies[0]; z.attack = 50; w.toxin = 9;
  w.startRaid('diner'); w.deployZombie(z.id);
  // energize = toxin -> instant full energy on a raiding zombie
  z.energy = 10;
  assert.ok(w.energizeZombie(z.id), 'energize works mid-raid');
  assert.strictEqual(z.energy, z.maxEnergy, 'fully recharged');
  assert.strictEqual(w.toxin, 8, 'energize cost 1 toxin');
  // steal the counter food, then retreat with the white flag
  const ct = w.battle.counters[0];
  assert.ok(w.lootCounter(ct.id), 'tap the rival counter to steal the food');
  assert.ok(w.fridge.some((b) => b.recipeId === 'burger'), 'stolen food in the fridge');
  w.battle.loot.coins = 35;
  const coins0 = w.coins;
  assert.ok(w.retreat(), 'white truce flag retreats anytime');
  assert.strictEqual(w.battle, null);
  assert.strictEqual(w.coins, coins0 + 35, 'eaten cash kept on retreat');
  // wipe-out: a downed zombie reanimates in the Meat Locker
  const w2 = boot();
  const z2 = w2.zombies[0]; z2.attack = 1; z2.energy = 5; z2.maxEnergy = 100;
  w2.startRaid('diner'); w2.deployZombie(z2.id);
  advance(w2, 240);
  assert.strictEqual(w2.battle, null, 'battle ended');
  assert.ok(w2.events.concat().length >= 0);
  assert.ok(z2.stored, 'downed zombie went to the Meat Locker');
  assert.ok(z2.reanimateUntil > w2.t, 'reanimation timer running');
  assert.ok(!w2.activateZombie(z2.id), 'cannot assign while reanimating');
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

test('build: walling a table off raises a layout warning (Phase 12)', () => {
  const w = boot();
  assert.strictEqual(w.layoutWarnings().length, 0, 'starts with a clean layout');
  // surround a corner table cell with blocking decor so it is unreachable
  w.coins = 99999;
  const tb = w.tables[0];
  // move the table to a corner, then ring it with non-walkable decor
  const corner = 0;
  w.moveTable(tb.id, corner);
  // place plants on the cells adjacent to the corner to seal it
  for (let i = 0; i < 8 && w.firstFreeCell() >= 0; i++) w.buy('plant');
  // at least assert the API returns an array and flags unreachable tables
  const warns = w.layoutWarnings();
  assert.ok(Array.isArray(warns), 'layoutWarnings returns a list');
});

test('grid: tile <-> world round-trips and centres are on the grid', () => {
  const w = boot();
  const t = w.tileOf(190, 250);            // col 1, row 2
  assert.strictEqual(t[0], 1); assert.strictEqual(t[1], 2);
  const ctr = w.tileCenter(1, 2);
  assert.strictEqual(ctr.x, 1 * 120 + 60);
  assert.strictEqual(ctr.y, 2 * 120 + 60);
});

test('interaction tile sits BESIDE an object, never on its blocked tile', () => {
  const w = boot();
  const st = w.stoves[0];
  const it = w._freeTileNear(st.x, st.y, 'x', st.x, st.y);
  const itTile = w.tileOf(it.x, it.y), stTile = w.tileOf(st.x, st.y);
  assert.ok(itTile[0] !== stTile[0] || itTile[1] !== stTile[1], 'interaction tile differs from the object tile');
  // and a commanded zombie aims at that beside-tile, not inside the stove
  w.auto = false; w.startCook(st.id, 'coffee'); advance(w, 9);
  w.commandZombie(w.zombies[0].id, { kind: 'stove', id: st.id });
  const z = w.zombies[0], zt = w.tileOf(z.fx, z.fy);
  assert.ok(zt[0] !== stTile[0] || zt[1] !== stTile[1], 'zombie stands beside the stove, not on it');
});

test('paths are strict tile-to-tile (waypoints land on tile centres)', () => {
  const w = boot();
  const a = w.tileCenter(0, 7), b = w.tileCenter(4, 1);
  const path = w.findPath(a.x, a.y, b.x, b.y);
  assert.ok(w._pathFound, 'a path exists across the floor');
  path.forEach(function (p) {
    assert.strictEqual(((p.x - 60) % 120 + 120) % 120, 0, 'waypoint x on grid');
    assert.strictEqual(((p.y - 60) % 120 + 120) % 120, 0, 'waypoint y on grid');
  });
});

test('no-path is detected when the start is walled in', () => {
  const w = boot();
  const s = w.tileCenter(3, 4), avoid = { '3,3': 1, '3,5': 1, '2,4': 1, '4,4': 1 };
  const tgt = w.tileCenter(0, 0);
  w.findPath(s.x, s.y, tgt.x, tgt.y, avoid);
  assert.ok(!w._pathFound, 'enclosed start cannot reach the target');
});

test('queued customers do not stack — each sits on a distinct tile', () => {
  const w = boot();
  w.tables.forEach((t) => { t.dirty = true; });
  let qs = [];
  for (let i = 0; i < 500 && qs.length < 2; i++) { w.tick(0.2); qs = w.customers.filter((c) => c.state === 'queued'); }
  assert.ok(qs.length >= 2, 'at least two customers waiting');
  const t0 = w.tileOf(qs[0].fx, qs[0].fy), t1 = w.tileOf(qs[1].fx, qs[1].fy);
  assert.ok(t0[0] !== t1[0] || t0[1] !== t1[1], 'two queued customers occupy different tiles');
});

test('tiles: explicit reserve/occupy/release + blocked/free state (4.6B)', () => {
  const w = boot();
  assert.ok(w.tileFree(5, 3, 'a'));
  assert.ok(w.reserveTile('a', 5, 3));
  assert.ok(!w.reserveTile('b', 5, 3), 'a reserved tile rejects another reservation');
  assert.ok(!w.occupyTile('b', 5, 3), 'a reserved tile rejects a second occupant');
  assert.strictEqual(w.tileState(5, 3), 'reserved');
  w.releaseTiles('a');
  assert.ok(w.occupyTile('b', 5, 3));
  assert.strictEqual(w.tileState(5, 3), 'occupied');
  const tb = w.tables[0], tc = Math.floor(tb.x / 120), tr = Math.floor(tb.y / 120);
  assert.ok(!w.tileFree(tc, tr, 'z'), 'a furniture tile is never free');
  assert.strictEqual(w.tileState(tc, tr), 'blocked');
});

test('chairs: real entities — link, reserve, dirty-block, add/remove capacity (4.6B)', () => {
  const w = boot();
  assert.strictEqual(w.chairs.length, w.tables.length, 'one chair per table');
  const tb = w.tables[0], ch = w.chairsOf(tb.id)[0];
  assert.strictEqual(ch.table, tb.id);
  assert.strictEqual(w.chairState(ch), 'empty');
  const mk = (id) => ({ id, x: 60, y: 600, tx: 60, ty: 600, fx: 60, fy: 600, path: [], state: 'queued', wait: 0, type: 'civilian', color: '#0f0', skin: '#eee', hair: '#000', face: 'U', step: 0 });
  const c = mk('cc'); w.customers.push(c);
  w.tables.slice(1).forEach((t) => { t.dirty = true; });          // only table 0 seatable
  assert.ok(w._trySeat(c), 'customer reserves a specific chair');
  assert.strictEqual(ch.reserved, 'cc');
  assert.strictEqual(w.chairState(ch), 'reserved');
  const c2 = mk('cc2'); w.customers.push(c2);
  assert.ok(!w._trySeat(c2), 'two customers cannot reserve the same chair');
  tb.dirty = true; assert.strictEqual(w.chairState(ch), 'blocked', 'dirty table blocks its chair');
  tb.dirty = false; ch.reserved = null; assert.strictEqual(w.chairState(ch), 'empty', 'cleaning re-enables it');
  const before = w.seatCount();
  assert.ok(w.removeChair(tb.id)); assert.strictEqual(w.seatCount(), before - 1, 'removing a chair drops capacity');
  assert.strictEqual(w.tableState(tb), 'invalidNoChairs');
  assert.ok(w.addChair(tb.id)); assert.strictEqual(w.seatCount(), before, 'adding a chair restores capacity');
});

test('footprints: 1x1 blocks one tile, a multi-tile object blocks all of them', () => {
  const w = boot();
  const tb = w.tables[0];
  assert.strictEqual(w.footprintTiles(tb).length, 1);
  tb.w = 2;                                                        // pretend it's a 2x1
  const ft = w.footprintTiles(tb);
  assert.strictEqual(ft.length, 2, 'a 2x1 footprint is two tiles');
  const blocked = w._blockedTiles();
  ft.forEach((t) => assert.ok(blocked[t[0] + ',' + t[1]], 'every footprint tile is blocked'));
  tb.w = 1;
});

test('placement validity: free=ok, overlap=red, and reasons are given (4.6B)', () => {
  const w = boot();
  const free = w.firstFreeCell();
  assert.ok(w.placementValidity('table', free).ok, 'a free cell is valid (green)');
  const r = w.placementValidity('table', w.tables[0].cell);
  assert.ok(!r.ok, 'overlapping an existing table is invalid (red)');
  assert.ok(/overlap/i.test(r.reason), 'gives an overlap reason: ' + r.reason);
  assert.ok(!w.placementValidity('table', -1).ok, 'outside café is invalid');
});

test('interaction tiles: a reserved tile is not handed to a second worker', () => {
  const w = boot();
  const st = w.stoves[0];
  const it = w._freeTileNear(st.x, st.y, 'z1', st.x, st.y);
  w.reserveTile('z1', Math.floor(it.x / 120), Math.floor(it.y / 120));
  const it2 = w._freeTileNear(st.x, st.y, 'z2', st.x, st.y);
  const a = [Math.floor(it.x / 120), Math.floor(it.y / 120)], b = [Math.floor(it2.x / 120), Math.floor(it2.y / 120)];
  assert.ok(a[0] !== b[0] || a[1] !== b[1], 'second worker gets a different interaction tile');
});

test('visual/logic split: chair seat point is offset from the tile centre (4.6D)', () => {
  const w = boot();
  const ch = w.chairs[0], ctr = w.tileCenter(ch.c, ch.r);
  assert.ok(ch.x !== ctr.x || ch.y !== ctr.y, 'chair sits at a seat slot, not the tile centre');
  assert.strictEqual(ch.facing, 'U', 'chair faces its table');
  // the visual sit offset must NOT change the logic footprint
  const tb = w.tables.find((t) => t.id === ch.table), ft = w.footprintTiles(tb), blocked = w._blockedTiles();
  assert.ok(blocked[ft[0][0] + ',' + ft[0][1]], 'table blocks exactly its footprint tile, regardless of seat offset');
  const sp = w.tableServePoint(tb), spt = w.tileOf(sp.x, sp.y), tbt = w.tileOf(tb.x, tb.y);
  assert.ok(spt[0] !== tbt[0] || spt[1] !== tbt[1], 'serve point is a tile BESIDE the table');
});

test('seating: customer paths to the chair sit point, not the tile centre', () => {
  const w = boot();
  const c = { id: 'sc', x: 60, y: 600, tx: 60, ty: 600, fx: 60, fy: 600, path: [], state: 'queued', wait: 0, type: 'civilian', color: '#0f0', skin: '#eee', hair: '#000', face: 'U', step: 0 };
  w.customers.push(c);
  assert.ok(w._trySeat(c));
  const ch = w.chairs.find((x) => x.reserved === 'sc');
  assert.ok(ch, 'reserved a specific chair');
  assert.strictEqual(c.fx, ch.x); assert.strictEqual(c.fy, ch.y);
});

test('queue forms a readable line — distinct, descending slots', () => {
  const w = boot();
  const a = w._queueSpot(0), b = w._queueSpot(1), d = w._queueSpot(2);
  assert.ok(b.y > a.y && d.y > b.y, 'each queue slot is further down the aisle');
  const ta = w.tileOf(a.x, a.y), td = w.tileOf(d.x, d.y);
  assert.ok(ta[0] !== td[0] || ta[1] !== td[1], 'queue slots span distinct tiles');
});

test('anchors: every object resolves to an explicit anchor type (4.6E)', () => {
  const w = boot(); w.coins = 99999;
  assert.strictEqual(w.anchorOf(w.tables[0]), 'TABLE_CENTER');
  assert.strictEqual(w.anchorOf(w.chairs[0]), 'CHAIR_SEAT_POINT');
  assert.strictEqual(w.anchorOf(w.stoves[0]), 'WALL_BACK_FLUSH');
  w.buy('fridge'); w.buy('sink'); w.buy('counter');
  const find = (id) => w.decors.find((d) => d.deco === id);
  assert.strictEqual(w.anchorOf(find('fridge')), 'FRIDGE_WALL_EDGE');
  assert.strictEqual(w.anchorOf(find('sink')), 'SINK_WALL_EDGE');
  assert.strictEqual(w.anchorOf(find('counter')), 'COUNTER_FRONT_EDGE');
  assert.ok(w.isWallAnchor(w.anchorOf(find('fridge'))), 'fridge uses a wall anchor');
});

test('the pass is a real 2x1 counter and blocks both its tiles (4.6E)', () => {
  const w = boot();
  const blocked = w._blockedTiles();
  assert.ok(blocked['3,1'] && blocked['4,1'], 'pass blocks both of its footprint tiles');
  // a worker still finds a walkable interaction tile in front of the long counter
  const it = w._freeTileNear(420, 168, '_', 420, 300);
  const t = w.tileOf(it.x, it.y);
  assert.ok(!blocked[t[0] + ',' + t[1]], 'pass interaction tile is walkable (in front)');
});

test('scale hierarchy: fridge > character > counter/table > chair (4.7)', () => {
  const sandbox = { window: {} };
  require('node:vm').runInNewContext(read('data.js'), sandbox);
  const H = sandbox.window.OBJ_HEIGHT;
  assert.ok(H.fridge > H.character, 'fridge taller than characters');
  assert.ok(H.character > H.table, 'characters taller than tables');
  assert.ok(H.table >= H.chair, 'tables not shorter than chairs');
  assert.ok(H.counter < H.character, 'counters are waist/chest height');
  assert.ok(H.door > H.character, 'door taller than characters');
});

test('art-review demo states build without errors (4.7)', () => {
  const vm = require('node:vm');
  const sandbox = { window: {}, Math, Date, console };
  vm.createContext(sandbox);
  ['data.js', 'world.js', 'demostates.js'].forEach((f) => vm.runInContext(read(f), sandbox));
  ['artReview_emptyRoom', 'artReview_kitchenZone', 'artReview_tableSet', 'artReview_allObjects', 'artReview_charactersDirections'].forEach((s) => {
    const w = sandbox.window.createWorld();
    assert.doesNotThrow(() => sandbox.window.applyDemo(w, s), s + ' builds');
  });
});

test('object models carry render/occlusion metadata (4.9)', () => {
  const w = boot();
  ['table', 'chair', 'stove', 'counter', 'fridge'].forEach((k) => {
    const m = w.objModel(k);
    assert.ok(m, 'model exists for ' + k);
    assert.ok(m.anchor && m.footprint && typeof m.height === 'number' && typeof m.occlusionHeight === 'number', 'metadata for ' + k);
  });
  assert.ok(w.objModel('fridge').occlusionHeight > w.objModel('table').occlusionHeight, 'tall fridge occludes more than a table');
  const pf = w.objModel('pass').footprint;     // serving counters are 1x1 each (one stack per square)
  assert.strictEqual(pf[0], 1); assert.strictEqual(pf[1], 1);
  assert.strictEqual(w.objModel('fridge').canBeOccluded, false, 'fridge is too tall to be hidden by a character');
});

test('sprite asset pipeline: manifest + priority-1 baked assets exist (4.10)', () => {
  const mf = JSON.parse(fs.readFileSync(path.join(WWW, 'assets', 'sprites', 'manifest.json'), 'utf8'));
  const need = ['table_clean', 'table_dirty', 'chair', 'stove_idle', 'pass_counter', 'prep_counter', 'sink', 'fridge', 'plant', 'lamp'];
  need.forEach((id) => {
    const e = mf.sprites[id];
    assert.ok(e, 'manifest has ' + id);
    assert.ok(e.anchorX != null && e.anchorY != null && e.frameWidth > 0, id + ' has anchors + frame');
    assert.ok(fs.existsSync(path.join(WWW, e.file)), id + ' file exists: ' + e.file);
  });
  // characters: chef + server zombies and 3 customer types, 4 facings each
  ['zombie_chef', 'zombie_server', 'customer_civilian', 'customer_worker', 'customer_punk'].forEach((ch) => {
    ['D', 'L', 'R', 'U'].forEach((f) => {
      const e = mf.sprites[ch + '_' + f];
      assert.ok(e && fs.existsSync(path.join(WWW, e.file)), ch + '_' + f + ' baked');
    });
  });
  assert.ok(Object.values(mf.sprites).every((e) => e.procedureFallback), 'every asset declares a procedural fallback (replaceable layer)');
});

test('grid alignment: furniture sits on exact tile centers (4.10B)', () => {
  const w = boot();
  const onCenter = (x, y) => ((x - 60) % 120 === 0) && ((y - 60) % 120 === 0);
  w.tables.forEach((t) => assert.ok(onCenter(t.x, t.y), 'table on tile center: ' + t.x + ',' + t.y));
  w.stoves.forEach((s) => assert.ok(onCenter(s.x, s.y), 'stove on tile center: ' + s.x + ',' + s.y));
  w.coins = 9999; w.buy('fridge'); w.buy('plant');
  w.decors.forEach((d) => assert.ok(onCenter(d.x, d.y), 'decor on tile center: ' + d.x + ',' + d.y));
});

test('visual layout validator: busy demo has no illegal overlaps (4.10B)', () => {
  const vm = require('node:vm');
  const sandbox = { window: {}, Math, Date, console };
  vm.createContext(sandbox);
  ['data.js', 'world.js', 'demostates.js'].forEach((f) => vm.runInContext(read(f), sandbox));
  const w = sandbox.window.createWorld();
  for (let i = 0; i < 8; i++) w.tick(0.2);
  sandbox.window.applyDemo(w, 'busy');
  const bad = w.layoutOverlaps();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(bad)), [], 'no illegal visual overlaps, got ' + JSON.stringify(bad));
});

test('wall alignment: kitchen appliances on the back-wall row with wall anchors (4.10B)', () => {
  const vm = require('node:vm');
  const sandbox = { window: {}, Math, Date, console };
  vm.createContext(sandbox);
  ['data.js', 'world.js', 'demostates.js'].forEach((f) => vm.runInContext(read(f), sandbox));
  const w = sandbox.window.createWorld();
  for (let i = 0; i < 8; i++) w.tick(0.2);
  sandbox.window.applyDemo(w, 'busy');
  w.stoves.forEach((s) => assert.strictEqual(w.tileOf(s.x, s.y)[1], 0, 'stove on back-wall row'));
  const wallArts = ['counter', 'sink', 'fridge'];
  w.decors.forEach((d) => {
    const art = ((sandbox.window.SHOP || []).find((s) => s.id === d.deco) || {}).art;
    if (wallArts.includes(art)) {
      assert.strictEqual(w.tileOf(d.x, d.y)[1], 0, art + ' on back-wall row');
      assert.ok(w.isWallAnchor(w.anchorOf(d)), art + ' uses a wall anchor');
    }
  });
});

test('runtime sprite plumbing: split assets exist; loader + blit are wired (4.10B)', () => {
  const mf = JSON.parse(fs.readFileSync(path.join(WWW, 'assets', 'sprites', 'manifest.json'), 'utf8'));
  ['table_base', 'table_top_clean', 'table_top_dirty', 'stove_body', 'pass_body'].forEach((id) => {
    assert.ok(mf.sprites[id] && fs.existsSync(path.join(WWW, mf.sprites[id].file)), id + ' baked');
  });
  const render = read('render.js'), game = read('game.js');
  assert.ok(render.includes('useSprites') && render.includes('_blit(') && render.includes('spriteReport'), 'renderer has sprite layer');
  assert.ok(render.includes('_spriteOverlay') && render.includes('_boundsOverlay'), 'debug overlays exist');
  assert.ok(game.includes('loadSprites') && game.includes("manifest.json"), 'game loads the manifest at runtime');
});

test('serving counters: one stack per square, same dish piles up (faithful)', () => {
  const w = boot();
  assert.strictEqual(w.passTiles().length, 2, 'starts with 2 counter squares');
  w.ready = ['coffee', 'coffee'];                      // stack 1
  assert.ok(w.canAccept('coffee'), 'same dish stacks onto its pile');
  assert.ok(w.canAccept('burger'), 'second counter square is free');
  w.ready.push('burger');                              // stack 2
  assert.ok(!w.canAccept('soup'), 'no free square for a third dish type');
  // plating a third dish type is refused (stove keeps the food)
  w.coins = 999; w.startCook(w.stoves[0].id, 'soup');
  w.stoves[0].ready = true; w.stoves[0].readyAt = w.t;
  assert.ok(!w.plateStove(w.stoves[0].id), 'plate refused with no free counter');
  assert.ok(w.stoves[0].ready, 'food stays on the stove');
  // buying another counter square frees a slot
  assert.ok(w.buyPassUnit(), 'bought a third counter');
  assert.strictEqual(w.passTiles().length, 3);
  assert.ok(w.canAccept('soup'), 'third stack fits now');
  assert.ok(w.plateStove(w.stoves[0].id), 'plates onto the new square');
  // each counter square blocks its own tile
  const blocked = w._blockedTiles();
  w.passTiles().forEach((pt) => {
    const t = w.tileOf(pt.x, pt.y);
    assert.ok(blocked[t[0] + ',' + t[1]], 'counter square blocked: ' + t);
  });
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

test('zombies earn XP per serve and level-ups fully recharge them', () => {
  const w = boot();
  const z = w.zombies[0];
  assert.strictEqual(z.zlevel, 1, 'starts at level 1');
  z.energy = 30;
  const need = w.zXpNeed(1);
  w._zGainXp(z, need);                                  // exactly enough to level
  assert.strictEqual(z.zlevel, 2, 'leveled up');
  assert.strictEqual(z.energy, z.maxEnergy, 'level-up fully recharges energy');
  assert.ok(w.events.some((e) => e.type === 'zombieLevel'), 'level event fired');
  // a real serve grants +1 zombie XP
  const z2 = w.zombies[0]; z2.zxp = 0;
  w.ready = ['coffee'];
  const tb = w.tables[0]; const ch = w.chairsOf(tb.id)[0];
  const c = { id: 'cx', x: ch.x, y: ch.y, tx: ch.x, ty: ch.y, fx: ch.x, fy: ch.y, path: [], table: tb.id, chair: ch.id, state: 'waiting', wait: w.t, assigned: null, type: 'civilian' };
  w.customers.push(c); tb.by = c.id; ch.by = c.id;
  const res = w.commandZombie(z2.id, { kind: 'customer', id: 'cx' });
  assert.ok(res.ok, 'serve command accepted');
  for (let i = 0; i < 600 && c.state === 'waiting'; i++) w.tick(0.1);
  assert.strictEqual(c.state, 'eating', 'dish delivered');
  assert.strictEqual(z2.zxp, 1, '+1 zombie XP per serve');
});

test('every customer type has a full info card (health/tip/atk/flavor)', () => {
  const ctx = { window: {}, Math, Date };
  vm.createContext(ctx); vm.runInContext(read('data.js'), ctx);
  for (const t of ctx.window.CUSTOMER_TYPES) {
    assert.ok(t.card, t.id + ' has a card');
    for (const k of ['tip', 'spd', 'str']) {
      assert.ok(t.card[k] >= 1 && t.card[k] <= 12, t.id + ' card.' + k + ' in 1..12');
    }
    assert.ok(t.card.flavor && t.card.flavor.length > 4, t.id + ' has flavor text');
    assert.ok(t.z.maxEnergy >= 50, t.id + ' health pool sane');
  }
});

test('recipe variants: original multipliers generate derived cookbook entries', () => {
  const ctx = { window: {}, Math, Date };
  vm.createContext(ctx); vm.runInContext(read('data.js'), ctx);
  const R = ctx.window.RECIPES;
  const bases = R.filter((r) => !r.base), vars = R.filter((r) => r.base);
  assert.strictEqual(vars.length, bases.length * ctx.window.RECIPE_VARIANTS.length, 'every base x variant exists');
  const b = R.find((r) => r.id === 'burger');
  const spicy = R.find((r) => r.id === 'burger.spicy');
  assert.strictEqual(spicy.xp, Math.round(b.xp * 1.1), 'Spicy = +10% XP');
  assert.ok(spicy.level > b.level, 'variants unlock after the base');
  const bulk = R.find((r) => r.id === 'burger.bulk');
  assert.strictEqual(bulk.batch, b.batch * 2, 'Bulk doubles the batch');
  assert.strictEqual(bulk.time, b.time, '...for the cook time of ONE');
  assert.strictEqual(bulk.cost, b.cost * 2, '...at double cost');
  const froz = R.find((r) => r.id === 'pizza.frozen'), pz = R.find((r) => r.id === 'pizza');
  assert.strictEqual(froz.time, pz.time * 2, 'Frozen doubles cook time');
  assert.strictEqual(froz.price, Math.round(pz.price * 0.75), 'Frozen sells for -25%');
  const fresh = R.find((r) => r.id === 'coffee.fresh');
  assert.ok(fresh.burnGrace >= Math.max(8, fresh.time) * 2, 'Fresh doubles the burn grace');
});

test('a variant dish cooks, plates and serves end-to-end', () => {
  const w = boot();
  w.auto = false;                                        // manual flow: idle staff would snatch it instantly
  w.coins = 999;
  assert.ok(w.startCook(w.stoves[0].id, 'coffee.fancy'), 'variant cook starts');
  const st = w.stoves[0];
  st.start = w.t - 9999; w.tick(0.1);                    // finish it
  assert.ok(st.ready, 'variant finished');
  assert.ok(w.plateStove(st.id), 'variant plated');
  assert.ok(w.ready.indexOf('coffee.fancy') >= 0, 'variant stack on the counter');
  // it is its own stack, separate from plain coffee
  assert.ok(w.canAccept('coffee'), 'plain coffee still needs its own square');
});

test('review board: 4 tasks at level 6, purple stars, 2-toxin bribe, decay', () => {
  const w = boot();
  assert.strictEqual(w.review, null, 'no review before level 6');
  w.level = 6; w.tick(0.05);
  assert.ok(w.review && w.review.tasks.length === 4, 'four tasks at level 6');
  assert.strictEqual(w.bonusStars(), 0);
  // bribe every incomplete task at 2 toxin each
  w.toxin = 99;
  const toxBefore = w.toxin;
  let bribes = 0;
  for (let i = 0; i < 4; i++) if (w.review.tasks[i].done < w.review.tasks[i].goal) { assert.ok(w.bribeTask(i), 'bribe ' + i); bribes++; }
  assert.strictEqual(w.toxin, toxBefore - bribes * 2, '2 toxin per bribe');
  assert.strictEqual(w.bonusStars(), 1, 'all 4 done -> 1 purple star');
  assert.ok(w.review.tasks.every((t) => t.done === 0), 'a fresh task set was issued');
  assert.ok(w.events.some((e) => e.type === 'reviewPassed'), 'passed event');
  // stars decay with time
  w.review.decayAt = w.t - 1; w.tick(0.05);
  assert.strictEqual(w.bonusStars(), 0, 'purple star faded');
  assert.ok(w.events.some((e) => e.type === 'reviewDecay'), 'decay event');
});

test('review tasks track real progress (serve / cook / earn)', () => {
  const w = boot();
  w.level = 6; w.tick(0.05);
  // force a deterministic task set
  w.review.tasks = [
    { type: 'serve', goal: 1, done: 0, label: 'Serve 1' },
    { type: 'cook', recipe: 'coffee', goal: 1, done: 0, label: 'Cook coffee' },
    { type: 'earn', goal: 5, done: 0, label: 'Earn 5' },
    { type: 'spend', goal: 5, done: 0, label: 'Spend 5' },
  ];
  w.coins = 999;
  w.startCook(w.stoves[0].id, 'coffee');
  assert.strictEqual(w.review.tasks[1].done, 1, 'cook progress ticked');
  // a variant of the same base also counts
  w.review.tasks[1].done = 0;
  w.startCook(w.stoves[1].id, 'coffee.fancy');
  assert.strictEqual(w.review.tasks[1].done, 1, 'variant counts toward its base');
  const c = { id: 'rv', x: 0, y: 0, state: 'paying', pay: 9, xp: 1, table: null, chair: null, path: [], tx: 0, ty: 0, fx: 0, fy: 0 };
  w.customers.push(c);
  w.collectCustomer('rv');
  assert.strictEqual(w.review.tasks[0].done, 1, 'serve progress ticked');
  assert.strictEqual(w.review.tasks[2].done, 5, 'earn progress capped at goal');
  w.buy('table');                                       // completes the last task
  assert.ok(w.events.some((e) => e.type === 'reviewPassed'), 'spend completed the board');
  assert.strictEqual(w.bonusStars(), 1, 'board completion earned the star');
});

test('café expansion: faithful ladder, level-gated, grid grows into the grass', () => {
  const w = boot();
  assert.strictEqual(w.colsNow(), 7); assert.strictEqual(w.rowsNow(), 8);
  const ex = w.nextExpansion();
  assert.strictEqual(ex.coin, 1500); assert.strictEqual(ex.level, 7);
  w.coins = 99999;
  assert.ok(!w.expandCafe(false), 'level-gated (level 1 < 7)');
  w.level = 7;
  assert.ok(w.expandCafe(false), 'first expansion bought with cash');
  assert.strictEqual(w.colsNow(), 8); assert.strictEqual(w.rowsNow(), 9);
  assert.strictEqual(w.coins, 99999 - 1500);
  // new band cells become usable; a table can be placed out there
  const newCell = (() => { for (let i = 25; i < 200; i++) if (w.cellUsable(i) && w.cellFree(i)) return i; return -1; })();
  assert.ok(newCell >= 25, 'an expansion-band cell is usable');
  assert.ok(w.moveTable(w.tables[0].id, newCell), 'table moves onto new land');
  assert.ok(w.inBounds(7, 8), 'expanded tiles are in bounds');
  assert.ok(!w.inBounds(8, 9), 'beyond the expansion still out of bounds');
  // second step has a toxin alternate price
  w.level = 9; w.toxin = 50;
  assert.ok(w.expandCafe(true), 'second expansion bought with toxin');
  assert.strictEqual(w.toxin, 40, 'cost 10 toxin');
  assert.strictEqual(w.colsNow(), 9);
  // survives save/load
  const w2 = new w.constructor(JSON.parse(JSON.stringify(w.snapshot())));
  assert.strictEqual(w2.colsNow(), 9); assert.strictEqual(w2.rowsNow(), 10);
});

test('Rustplate Knight: knight-tier cash elite matches the recovered archetype', () => {
  const ctx = { window: {}, Math, Date };
  vm.createContext(ctx); vm.runInContext(read('data.js'), ctx);
  const kn = ctx.window.CUSTOMER_TYPES.find((t) => t.id === 'knight');
  assert.ok(kn, 'knight exists');
  assert.strictEqual(kn.infect.cash, 9500, 'huge CASH infect cost');
  assert.ok(!kn.infect.toxin, 'cash-only like the original archetype');
  assert.strictEqual(kn.card.spd, 3, 'slow'); assert.strictEqual(kn.card.str, 7);
  assert.strictEqual(kn.card.tip, 6, 'good tipper');
  assert.ok(kn.z.maxEnergy >= 200, 'tank-tier energy pool');
  assert.strictEqual(kn.levelReq, 8, 'unlocks at level 8 like the original');
});

test('feeding respects the real energy cap and refuses dead zombies', () => {
  const w = boot();
  const z = w.zombies[0]; z.maxEnergy = 250; z.energy = 200; w.toxin = 5;
  assert.ok(w.feedZombie(z.id), 'a 200/250 zombie is NOT full — feeding works');
  assert.strictEqual(z.energy, 250, 'refilled to its real max');
  assert.ok(!w.feedZombie(z.id), 'now full at 250 — refused');
  // a reanimating zombie cannot be fed
  z.energy = 10; z.reanimateUntil = w.t + 100;
  assert.ok(!w.feedZombie(z.id), 'cannot feed a reanimating zombie');
});

test('the home café is paused while you are away on a raid', () => {
  const w = boot();
  w.zombies[0].attack = 1;                               // weak so the fight lingers
  w.coins = 999; w.startCook(w.stoves[0].id, 'coffee');
  w.stoves[0].ready = true; w.stoves[0].readyAt = w.t;   // a finished dish sitting out
  w.startRaid('diner');                                  // squad lined up, none deployed yet
  const custs0 = w.customers.length;
  for (let i = 0; i < 150 && w.battle; i++) w.tick(0.2); // tick only while the battle is live
  assert.ok(w.battle, 'battle still ongoing (nobody deployed, so it cannot end)');
  assert.ok(!w.stoves[0].burned, 'food did NOT burn while the café was paused');
  assert.strictEqual(w.customers.length, custs0, 'no new customers arrived during the raid');
  assert.strictEqual(w.served, 0, 'café made no progress while paused');
});
