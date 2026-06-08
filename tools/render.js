/* Headless preview: render one frame of the cafe to a PNG using node-canvas. */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

global.window = global;
global.navigator = {};
global.performance = { now: () => Date.now() };
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.document = {
  readyState: 'complete',
  addEventListener: () => {},
  getElementById: () => null,
  createElement: (t) => (t === 'canvas' ? createCanvas(10, 10) : { style: {}, addEventListener: () => {} })
};
global.ZC = {};

const dir = path.join(__dirname, '..', 'js');
['data', 'audio', 'engine', 'entities', 'game', 'raid', 'scene'].forEach(m => require(path.join(dir, m + '.js')));

const ZC = global.ZC, G = ZC.Game, C = ZC.CONFIG, iso = ZC.iso;
iso.setup();
const canvas = createCanvas(Math.round(iso.width), Math.round(iso.height));
G.canvas = canvas; G.ctx = canvas.getContext('2d'); G._t = 1.2;
G.entrance = { wx: C.cols - 0.5, wy: C.rows - 0.2 };
G.kitchen = { wx: 0.6, wy: 0.6 };
G.newGame();

// Build a lively cafe
G.coins = 999999; G.toxin = 999;
while (!G.maxExpanded()) G.expand();
G.tables = []; G.stoves = []; G.decor = [];
for (let r = 2; r <= 7; r += 2) for (let c = 2; c <= 8; c += 2) G.tables.push(new ZC.Table(c, r));
G.stoves.push(new ZC.Stove(1, 1, 'stove'));
G.stoves.push(new ZC.Stove(3, 1, 'grill'));
G.stoves.push(new ZC.Stove(5, 1, 'oven'));
G.decor.push(new ZC.Decor(9, 2, 'plant'));
G.decor.push(new ZC.Decor(9, 5, 'lamp'));
G.decor.push(new ZC.Decor(1, 7, 'juke'));
for (let i = 0; i < 6; i++) G.spawnZombie(G.kitchen.wx + 0.5 + (i % 3) * 0.5, G.kitchen.wy + 0.6 + Math.floor(i / 3) * 0.5);
G.stoves.forEach(s => { s.cooking = true; s.timer = s.recipe().cookTime * 0.5; });
for (let i = 0; i < 12; i++) G.readyFood.push({ recipeId: 'coffee', price: 18 });

// Simulate so customers seat, get served, and some are eating
const dt = 1 / 30;
for (let i = 0; i < 18 * 30; i++) G.update(dt);

G.render();
const out = path.join(__dirname, '..', 'preview.png');
fs.writeFileSync(out, canvas.toBuffer('image/png'));
console.log('wrote', out, canvas.width + 'x' + canvas.height,
  '| customers', G.customers.length, 'eating', G.customers.filter(c => c.state === 'eating').length,
  'zombies', G.zombies.length, 'ready', G.readyFood.length);
