/*
 * test/headless.js — Headless smoke + logic tests for the game.
 * Stubs the browser globals, loads the modules, and asserts core systems work.
 * Run with: npm test
 */
'use strict';

global.window = global;
var store = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; }
};
global.ZC = {};

var path = require('path');
var dir = path.join(__dirname, '..', 'js');
['data', 'audio', 'engine', 'entities', 'game', 'raid', 'scene'].forEach(function (m) {
  require(path.join(dir, m + '.js'));
});

var ZC = global.ZC, G = ZC.Game, C = ZC.CONFIG, iso = ZC.iso;

var failures = 0;
function ok(name, cond) {
  if (cond) { console.log('  ✓ ' + name); }
  else { console.log('  ✗ ' + name); failures++; }
}

// --- boot the model without a canvas ---
iso.setup();
G.canvas = { width: Math.round(iso.width), height: Math.round(iso.height) };
G.ctx = null;
G.entrance = { wx: C.cols - 0.5, wy: C.rows - 0.2 };
G.kitchen = { wx: 0.6, wy: 0.6 };
G.newGame();

console.log('Isometric & setup');
ok('iso projection round-trips', (function () {
  var p = iso.project(3.5, 2.25), u = iso.unproject(p.x, p.y);
  return Math.abs(u.wx - 3.5) < 1e-6 && Math.abs(u.wy - 2.25) < 1e-6;
})());
ok('starts with small usable area', G.usableCols === C.startUsableCols && G.usableRows === C.startUsableRows);
ok('starts with zombies, tables, a stove', G.zombies.length >= 2 && G.tables.length >= 1 && G.stoves.length >= 1);

console.log('Core economy loop');
var dt = 1 / 30;
for (var i = 0; i < 150 * 30; i++) G.update(dt);
ok('served customers over time', G.stats.served > 0);
ok('earned coins / xp', G.coins > 0 && G.xp >= 0);

console.log('Appliances');
G.coins = 6000;
ok('placing grill outside usable fails', G.placeItem('grill', C.cols - 1, C.rows - 1) === false);
ok('place grill inside usable', G.placeItem('grill', 3, 1) === true);
var grill = G.stoves[G.stoves.length - 1];
ok('grill cooks grill-station recipes', grill.station() === 'grill' && ZC.recipeById(grill.recipeId).station === 'grill');

console.log('Tending (manual control)');
var z = G.zombies[0]; z.state = 'idle'; z.energy = 100;
G.directToStove(z, G.stoves[0]);
var guard = 0; while (z.state !== 'tending' && guard < 600) { G.update(dt); guard++; }
ok('zombie reaches and tends a stove', z.state === 'tending' && G.stoves[0].tendedBy === z);

console.log('Manual serve with auto off');
G.autoServe = false;
G.zombies.forEach(function (zz) { G.releaseTending(zz); zz.state = 'idle'; zz.energy = 100; zz.task = null; zz.carrying = null; });
G.readyFood.push({ recipeId: 'coffee', price: 18 });
var cust = G.customers.find(function (c) { return c.state === 'waiting'; });
if (!cust) { G.spawnCustomer(); cust = G.customers[G.customers.length - 1]; var sp = cust.table.seat(); cust.wx = sp.wx; cust.wy = sp.wy; cust.state = 'waiting'; }
var served0 = G.stats.served;
G.directToServe(G.zombies[0], cust);
guard = 0; while (G.stats.served === served0 && guard < 900) { G.update(dt); guard++; }
ok('directed zombie completes a serve', G.stats.served > served0);

console.log('Expansion');
G.coins = 999999; G.toxin = 9999;
var before = G.usableCols + 'x' + G.usableRows;
G.expand();
ok('expand grows usable area', (G.usableCols + 'x' + G.usableRows) !== before);
ok('entrance moves with expansion', Math.abs(G.entrance.wy - (G.usableRows - 0.15)) < 1e-6);
guard = 0; while (!G.maxExpanded() && guard < 12) { G.expand(); guard++; }
ok('expands to full size', G.usableCols === C.cols && G.usableRows === C.rows);

console.log('Quests & VIP');
var q = ZC.questById('serve25');
ok('serve25 goal completes', q.progress(G) >= q.target && G.questReady(q));
var cb = Math.round(G.coins); G.claimQuest('serve25');
ok('claiming a goal pays out once', Math.round(G.coins) === cb + 200 && G.claimQuest('serve25') === false);

console.log('Orders & customer types');
ok('menu lists cookable dishes', G.menu().length > 0);
G.autoServe = true;
G.zombies.forEach(function (zz) { G.releaseTending(zz); zz.state = 'idle'; zz.energy = 100; zz.task = null; zz.carrying = null; });
G.customers = []; G.readyFood = [];
G.spawnCustomer();
var oc = G.customers[G.customers.length - 1];
oc.order = 'coffee'; var osp = oc.table.seat(); oc.wx = osp.wx; oc.wy = osp.wy; oc.state = 'waiting'; oc.patience = C.customerPatience; oc.assignedZombie = null;
G.readyFood.push({ recipeId: 'fries', price: 26 });
G.readyFood.push({ recipeId: 'coffee', price: 18 });
G.dispatchZombies();
ok('dispatch matches the ordered dish', oc.assignedZombie && oc.assignedZombie.task.portion.recipeId === 'coffee');

var zk = G.zombies[0]; zk.carrying = { recipeId: 'coffee', price: 18 }; zk.task = null;
var kid = new ZC.Customer(0, 0); kid.type = 'kid'; kid.patience = 0;
var coinsK = Math.round(G.coins); G.serveCustomer(zk, kid);
ok('kid customer pays 0.8x', Math.round(G.coins) - coinsK === Math.round(18 * 0.8));

var zl = G.zombies[0]; zl.level = 1; zl.xp = 0; G.gainZombieXP(zl, 100);
ok('zombie levels up from XP', zl.level > 1 && zl.speedMul() > 1);

console.log('Zombie roster persistence');
G.zombies[0].name = 'TESTZOM'; G.zombies[0].level = 3;
G.save(); var rcount = G.zombies.length; G.zombies = []; G.load();
ok('roster persists names & levels', G.zombies.length === rcount && G.zombies.some(function (z) { return z.name === 'TESTZOM' && z.level === 3; }));

console.log('Raid scene');
ZC.scenes.canvas = { width: 400, height: 400 };
G.zombies.forEach(function (zz) { zz.state = 'idle'; zz.energy = 100; });
G.raid.cooldown = 0;
var launched = ZC.RaidScene.launch();
ok('raid launches and switches scene', launched && ZC.scenes.current === ZC.RaidScene);
guard = 0; while (!ZC.RaidScene.finished && guard < 60 * 30) { ZC.RaidScene.update(dt); guard++; }
ok('raid resolves to a finish', ZC.RaidScene.finished === true && ZC.RaidScene.loot);
var rc = Math.round(G.coins);
ZC.RaidScene.collect();
ok('collecting loot returns to cafe & pays', ZC.scenes.current === ZC.CafeScene && Math.round(G.coins) >= rc);

console.log('Save / load / transfer');
G.save();
var snapshot = Math.round(G.coins);
G.coins = 0; G.usableCols = 0; G.stoves = [];
ok('load restores state', G.load() && Math.round(G.coins) === snapshot && G.usableCols === C.cols);
var code = G.exportSave();
ok('export produces a code', typeof code === 'string' && code.indexOf('ZC1') === 0);
G.coins = 123;
ok('import restores from code', G.importSave(code) && Math.round(G.coins) === snapshot);

console.log('');
if (failures) { console.log('FAILED: ' + failures + ' check(s)'); process.exit(1); }
console.log('All checks passed.');
