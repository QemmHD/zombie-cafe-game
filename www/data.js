/*
 * Zombie Cafe — static game data.
 *
 * RECIPES drive the cooking loop: you pay `cost` coins in ingredients to start
 * a cook on a stove, wait `time` seconds, and it yields `batch` servings. Each
 * serving sold to a customer earns `price` coins (× ambiance tip multiplier)
 * and grants `xp`. Higher tiers cost more and cook longer but are far more
 * profitable — classic idle-restaurant progression.
 */
window.RECIPES = [
  { id: 'coffee',  name: 'Rotten Coffee',  emoji: '☕', cost: 5,    time: 8,    batch: 3,  price: 4,   xp: 1,  level: 1 },
  { id: 'soup',    name: 'Eyeball Soup',   emoji: '🍜', cost: 12,   time: 20,   batch: 4,  price: 6,   xp: 3,  level: 1 },
  { id: 'burger',  name: 'Brain Burger',   emoji: '🍔', cost: 25,   time: 45,   batch: 5,  price: 10,  xp: 6,  level: 2 },
  { id: 'pizza',   name: 'Zombie Pizza',   emoji: '🍕', cost: 60,   time: 120,  batch: 6,  price: 18,  xp: 12, level: 3 },
  { id: 'taco',    name: 'Toxic Taco',     emoji: '🌮', cost: 40,   time: 80,   batch: 5,  price: 14,  xp: 9,  level: 4 },
  { id: 'sushi',   name: 'Severed Sushi',  emoji: '🍣', cost: 120,  time: 300,  batch: 8,  price: 28,  xp: 25, level: 5 },
  { id: 'cake',    name: 'Monster Cake',   emoji: '🎂', cost: 250,  time: 600,  batch: 10, price: 45,  xp: 50, level: 7 },
  { id: 'stew',    name: 'Graveyard Stew', emoji: '🥘', cost: 400,  time: 1800, batch: 12, price: 70,  xp: 90, level: 9 },
  { id: 'pie',     name: 'Phantom Pie',    emoji: '🥧', cost: 800,  time: 3600, batch: 14, price: 110, xp: 160, level: 11 },
];

/*
 * SHOP items. `kind` decides what buying does:
 *   - 'stove'  : +1 cooking station
 *   - 'table'  : +1 table (more simultaneous customers)
 *   - 'zombie' : +1 staff member (faster / more parallel serving)
 *   - 'decor'  : permanent ambiance boost (faster spawns + bigger tips)
 * `cur` is the currency ('coin' or 'toxin'). For repeatable structural items
 * the price scales with how many you already own (see priceFor in game.js).
 */
window.SHOP = [
  { id: 'stove',   kind: 'stove',  name: 'Cursed Stove',  emoji: '🔥', cur: 'coin',  base: 150,  grow: 1.8, desc: 'Another station to cook on.' },
  { id: 'table',   kind: 'table',  name: 'Bistro Table',  emoji: '🪑', cur: 'coin',  base: 100,  grow: 1.6, desc: 'Seat one more customer at a time.' },
  { id: 'zombie',  kind: 'zombie', name: 'Hire Zombie',   emoji: '🧟', cur: 'toxin', base: 3,    grow: 1.5, desc: 'Staff serve customers. More = faster service.' },

  { id: 'lamp',    kind: 'decor',  name: 'Spooky Lamp',   emoji: '🕯️', cur: 'coin', base: 300,   grow: 1, ambiance: 6,  desc: '+6 ambiance. Customers arrive sooner & tip more.' },
  { id: 'cobweb',  kind: 'decor',  name: 'Cobweb Corner', emoji: '🕸️', cur: 'coin', base: 900,   grow: 1, ambiance: 14, desc: '+14 ambiance.' },
  { id: 'jukebox', kind: 'decor',  name: 'Haunted Jukebox', emoji: '🎷', cur: 'coin', base: 2500,  grow: 1, ambiance: 30, desc: '+30 ambiance.' },
  { id: 'fountain',kind: 'decor',  name: 'Blood Fountain',emoji: '⛲',       cur: 'toxin', base: 12,    grow: 1, ambiance: 60, desc: '+60 ambiance. The crowd loves it.' },
];

// Shirt colours for the humans who wander in — drawn procedurally on canvas.
window.CUSTOMER_COLORS = [
  '#e06666', '#6fa8dc', '#f6b26b', '#93c47d', '#c27ba0',
  '#ffd966', '#8e7cc3', '#76a5af', '#d5a6bd', '#a4c2f4',
];
window.SKIN_TONES = ['#f1c89b', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

/*
 * RIVALS — the other cafes you can raid ("take over other places"). Send a
 * squad of zombies; if your power (squad size + level) beats the rival's
 * `defense`, you win `reward` coins (+ sometimes toxin). Raids take real time;
 * your zombies are away serving in the squad until they return with the loot.
 */
window.RIVALS = [
  { id: 'diner',   name: "Greasy Joe's Diner",  emoji: '🍳', defense: 12,  squad: 1, time: 30,   reward: 120,   toxin: 0, level: 1 },
  { id: 'taqueria',name: 'El Muerto Taqueria',  emoji: '🌮', defense: 30,  squad: 2, time: 60,   reward: 320,   toxin: 1, level: 2 },
  { id: 'noodle',  name: 'Phantom Noodle Bar',  emoji: '🍜', defense: 60,  squad: 3, time: 120,  reward: 750,   toxin: 1, level: 4 },
  { id: 'steak',   name: 'Bonepit Steakhouse',  emoji: '🥩', defense: 110, squad: 4, time: 240,  reward: 1800,  toxin: 2, level: 6 },
  { id: 'sushi',   name: 'Kraken Sushi Co.',    emoji: '🍣', defense: 200, squad: 6, time: 480,  reward: 4200,  toxin: 3, level: 8 },
  { id: 'casino',  name: 'Necropolis Casino',   emoji: '🎰', defense: 380, squad: 8, time: 900,  reward: 11000, toxin: 6, level: 10 },
];
