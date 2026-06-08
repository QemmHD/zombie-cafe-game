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

// Cosmetic pool of the humans who wander in. Purely visual variety.
window.CUSTOMER_FACES = [
  '👨', '👩', '🧑', '👴', '👵',
  '👱', '👲', '👳', '👶', '🧔',
];
