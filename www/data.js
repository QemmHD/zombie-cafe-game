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
  // Long dishes pay the best COINS-per-cook (idle play); short dishes stay the
  // best XP/hr (active play) — the original's core strategic tradeoff.
  { id: 'sushi',   name: 'Severed Sushi',  emoji: '🍣', cost: 120,  time: 300,  batch: 8,  price: 33,  xp: 25, level: 5 },
  { id: 'cake',    name: 'Monster Cake',   emoji: '🎂', cost: 250,  time: 600,  batch: 10, price: 54,  xp: 50, level: 7 },
  { id: 'stew',    name: 'Graveyard Stew', emoji: '🥘', cost: 400,  time: 1800, batch: 12, price: 88,  xp: 90, level: 9 },
  { id: 'pie',     name: 'Phantom Pie',    emoji: '🥧', cost: 800,  time: 3600, batch: 14, price: 140, xp: 160, level: 11 },
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
// `cat` groups items in the Store tabs. `sell` is the coin refund when sold in
// build mode; `store` means it can be stashed (and re-placed free) instead of
// sold. Decor/utility props sit on a floor cell (so they trade off seating) and
// `art` tells the renderer how to draw them. `blocks:false` = walkable.
window.SHOP = [
  // --- Furniture ---
  { id: 'table',   cat: 'Furniture', kind: 'table',  name: 'Bistro Table',  emoji: '🪑', cur: 'coin',  base: 100,  grow: 1.6, sell: 40, store: true, desc: 'Seat one more customer at a time.' },

  // --- Kitchen ---
  { id: 'stove',   cat: 'Kitchen',   kind: 'stove',  name: 'Cursed Stove',  emoji: '🔥', cur: 'coin',  base: 150,  grow: 1.8, sell: 60, store: true, desc: 'Another station to cook on.' },
  { id: 'servcounter', cat: 'Kitchen', kind: 'pass', name: 'Serving Counter', emoji: '🍽️', cur: 'coin', base: 300, grow: 1.5, sell: 0, desc: 'One more counter square — each holds ONE food stack.' },
  { id: 'counter', cat: 'Kitchen',   kind: 'decor',  name: 'Prep Counter',  emoji: '🍴', art: 'counter', cur: 'coin', base: 220, grow: 1.3, ambiance: 7, sell: 80, store: true, desc: '+7 ambiance. Grimy prep station.' },
  { id: 'sink',    cat: 'Kitchen',   kind: 'decor',  name: 'Rusty Sink',    emoji: '🚰', art: 'sink',    cur: 'coin', base: 260, grow: 1.3, ambiance: 8, sell: 90, store: true, desc: '+8 ambiance.' },
  { id: 'fridge',  cat: 'Kitchen',   kind: 'decor',  name: 'Grimy Fridge',  emoji: '🧊', art: 'fridge',  cur: 'coin', base: 340, grow: 1.3, ambiance: 6, sell: 120, store: true, desc: '+6 ambiance. Stained cold storage.' },

  // --- Staff ---
  { id: 'zombie',  cat: 'Staff',     kind: 'zombie', name: 'Hire Zombie',   emoji: '🧟', cur: 'toxin', base: 3,    grow: 1.5, desc: 'Staff cook, serve & clean. Goes to the Meat Locker if your active slots are full.' },

  // --- Decor (ambiance) ---
  { id: 'plant',   cat: 'Decor',  kind: 'decor',  name: 'Potted Fern',   emoji: '🪴', art: 'plant',   cur: 'coin', base: 120,  grow: 1.25, ambiance: 5,  sell: 50,  store: true, desc: '+5 ambiance. Customers arrive sooner & tip more.' },
  { id: 'lamp',    cat: 'Decor',  kind: 'decor',  name: 'Spooky Lamp',   emoji: '🕯️', art: 'lamp',    cur: 'coin', base: 300,  grow: 1.3,  ambiance: 9,  sell: 120, store: true, desc: '+9 ambiance.' },
  { id: 'rug',     cat: 'Decor',  kind: 'decor',  name: 'Crimson Rug',   emoji: '🟥', art: 'rug',      cur: 'coin', base: 600,  grow: 1.3,  ambiance: 14, blocks: false, sell: 240, store: true, desc: '+14 ambiance. Walkable.' },
  { id: 'trash',   cat: 'Decor',  kind: 'decor',  name: 'Trash Heap',    emoji: '🗑️', art: 'trash',   cur: 'coin', base: 90,   grow: 1.2,  ambiance: 4,  sell: 30,  store: true, desc: '+4 ambiance. Customers love grime.' },
  { id: 'jukebox', cat: 'Decor',  kind: 'decor',  name: 'Haunted Jukebox', emoji: '🎷', art: 'jukebox', cur: 'coin', base: 1800, grow: 1.35, ambiance: 26, sell: 700, store: true, desc: '+26 ambiance.' },
  { id: 'fountain',cat: 'Decor',  kind: 'decor',  name: 'Blood Fountain',emoji: '⛲', art: 'fountain', cur: 'toxin', base: 8,    grow: 1.4,  ambiance: 50, sell: 0,   store: true, desc: '+50 ambiance. The crowd loves it.' },

  // --- Utility ---
  { id: 'rest',    cat: 'Utility', kind: 'decor', name: 'Coffin Cot',     emoji: '⚰️', art: 'rest',    cur: 'coin', base: 400, grow: 1.3, ambiance: 0, utility: 'rest', sell: 150, store: true, desc: 'A spot for tired staff to rest faster.' },
];

// Shirt colours for the humans who wander in — drawn procedurally on canvas.
window.CUSTOMER_COLORS = [
  '#e06666', '#6fa8dc', '#f6b26b', '#93c47d', '#c27ba0',
  '#ffd966', '#8e7cc3', '#76a5af', '#d5a6bd', '#a4c2f4',
];
window.SKIN_TONES = ['#f1c89b', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

/*
 * CUSTOMER_TYPES — the different humans who walk in (Phase 5). `weight` is the
 * base spawn chance; `levelReq`/`ratingReq` gate rarer guests behind progress.
 *   pay     : payment multiplier on the dish price
 *   tip     : chance of an extra tip
 *   patience: multiplier on base patience (how long they wait)
 *   infect  : recruitment cost { toxin, cash } to turn them into a zombie
 *   z       : the zombie they BECOME — role + stat multipliers + a trait, so
 *             infecting different people yields genuinely different workers.
 *   shirt/hat: drive the procedural sprite so types read at a glance.
 */
window.CUSTOMER_TYPES = [
  { id: 'civilian', name: 'Civilian',     rarity: 'common', weight: 30, levelReq: 1, ratingReq: 0,
    pay: 1.0, tip: 0.15, patience: 1.0, infect: { toxin: 2 }, shirt: '#6fa8dc', hat: null,
    z: { role: 'Server',  speed: 1.0, serve: 1.05, clean: 1.0, cook: 1.0, attack: 8,  maxEnergy: 100, patience: 1.0, rarity: 'common', trait: 'Reliable' } },
  { id: 'worker',   name: 'Dock Worker',  rarity: 'common', weight: 16, levelReq: 1, ratingReq: 0,
    pay: 1.0, tip: 0.10, patience: 1.1, infect: { toxin: 3 }, shirt: '#f6b26b', hat: 'hardhat',
    z: { role: 'Bruiser', speed: 0.85, serve: 0.95, clean: 1.1, cook: 1.0, attack: 18, maxEnergy: 135, patience: 1.2, rarity: 'common', trait: 'Sturdy' } },
  { id: 'cook',     name: 'Line Cook',    rarity: 'rare',   weight: 8,  levelReq: 1, ratingReq: 0,
    pay: 1.1, tip: 0.15, patience: 1.0, infect: { toxin: 4 }, shirt: '#dddddd', hat: 'chef',
    z: { role: 'Chef',    speed: 1.0, serve: 1.1, clean: 1.0, cook: 1.6, attack: 10, maxEnergy: 105, patience: 1.0, rarity: 'rare',   trait: 'Fast Cook' } },
  { id: 'athlete',  name: 'Athlete',      rarity: 'rare',   weight: 9,  levelReq: 1, ratingReq: 0,
    pay: 1.0, tip: 0.20, patience: 0.9, infect: { toxin: 4 }, shirt: '#93c47d', hat: 'visor',
    z: { role: 'Runner',  speed: 1.45, serve: 1.3, clean: 1.05, cook: 1.0, attack: 12, maxEnergy: 110, patience: 0.9, rarity: 'rare',  trait: 'Sprinter' } },
  { id: 'business', name: 'Executive',    rarity: 'rare',   weight: 9,  levelReq: 2, ratingReq: 0,
    pay: 1.4, tip: 0.40, patience: 1.0, infect: { toxin: 4, cash: 200 }, shirt: '#3a3f55', hat: null,
    z: { role: 'Host',    speed: 1.05, serve: 1.15, clean: 1.0, cook: 1.0, attack: 9, maxEnergy: 100, patience: 1.1, rarity: 'rare',  trait: 'Big Tipper' } },
  { id: 'elder',    name: 'Pensioner',    rarity: 'common', weight: 8,  levelReq: 1, ratingReq: 0,
    pay: 0.9, tip: 0.15, patience: 1.7, infect: { toxin: 2 }, shirt: '#c27ba0', hat: null,
    z: { role: 'Busser',  speed: 0.7, serve: 0.85, clean: 1.3, cook: 1.0, attack: 7, maxEnergy: 100, patience: 1.6, rarity: 'common', trait: 'Patient' } },
  { id: 'punk',     name: 'Punk',         rarity: 'rare',   weight: 7,  levelReq: 2, ratingReq: 0,
    pay: 0.9, tip: 0.10, patience: 0.7, infect: { toxin: 3 }, shirt: '#8e7cc3', hat: 'mohawk',
    z: { role: 'Bruiser', speed: 1.1, serve: 1.0, clean: 0.95, cook: 1.0, attack: 22, maxEnergy: 105, patience: 0.6, rarity: 'rare',  trait: 'Rowdy' } },
  { id: 'tourist',  name: 'Tourist',      rarity: 'rare',   weight: 7,  levelReq: 3, ratingReq: 0,
    pay: 1.1, tip: 0.30, patience: 1.0, infect: { toxin: 4 }, shirt: '#ffd966', hat: 'sun',
    z: { role: 'Server',  speed: 1.05, serve: 1.1, clean: 1.05, cook: 1.0, attack: 10, maxEnergy: 110, patience: 1.1, rarity: 'rare', trait: 'Generous' } },
  { id: 'rich',     name: 'Socialite',    rarity: 'elite',  weight: 4,  levelReq: 4, ratingReq: 3,
    pay: 2.0, tip: 0.60, patience: 1.0, infect: { toxin: 8, cash: 500 }, shirt: '#d4af37', hat: 'tophat',
    z: { role: 'Host',    speed: 1.2, serve: 1.3, clean: 1.15, cook: 1.1, attack: 14, maxEnergy: 120, patience: 1.2, rarity: 'elite', trait: 'Lavish' } },
  { id: 'oddball',  name: 'Oddball',      rarity: 'elite',  weight: 2,  levelReq: 5, ratingReq: 3.5,
    pay: 1.5, tip: 0.50, patience: 1.2, infect: { toxin: 6 }, shirt: '#5fae8f', hat: 'wizard',
    z: { role: 'Cryptid', speed: 1.35, serve: 1.35, clean: 1.35, cook: 1.35, attack: 25, maxEnergy: 140, patience: 1.4, rarity: 'elite', trait: 'Eldritch' } },
  // Rare fighters are VISUALLY unique (gloves, mohawk crest, heavier build) and
  // read as raid material at a glance: terrible tipper, monster in a fight.
  { id: 'brawler',  name: 'Brawler',      rarity: 'elite',  weight: 3,  levelReq: 3, ratingReq: 2.5,
    pay: 1.0, tip: 0.05, patience: 0.8, infect: { cash: 500 }, shirt: '#8a2f2f', hat: 'mohawk', gloves: '#c43a2e',
    z: { role: 'Slugger', speed: 1.3, serve: 1.0, clean: 0.9, cook: 0.9, attack: 28, maxEnergy: 150, patience: 0.7, rarity: 'elite', trait: 'Knockout' } },
];

/*
 * RIVALS — the other cafes you can raid ("take over other places"). Send a
 * squad of zombies; if your power (squad size + level) beats the rival's
 * `defense`, you win `reward` coins (+ sometimes toxin). Raids take real time;
 * your zombies are away serving in the squad until they return with the loot.
 */
// `recipe` is the rival's signature dish — beating them steals the recipe and
// unlocks it early (just like raiding for recipes in the original).
window.RIVALS = [
  { id: 'diner',   name: "Greasy Joe's Diner",  emoji: '🍳', defense: 12,  squad: 1, time: 30,   reward: 120,   toxin: 0, level: 1, recipe: 'burger' },
  { id: 'taqueria',name: 'El Muerto Taqueria',  emoji: '🌮', defense: 30,  squad: 2, time: 60,   reward: 320,   toxin: 1, level: 2, recipe: 'taco' },
  { id: 'noodle',  name: 'Phantom Noodle Bar',  emoji: '🍜', defense: 60,  squad: 3, time: 120,  reward: 750,   toxin: 1, level: 4, recipe: 'pizza' },
  { id: 'steak',   name: 'Bonepit Steakhouse',  emoji: '🥩', defense: 110, squad: 4, time: 240,  reward: 1800,  toxin: 2, level: 6, recipe: 'sushi' },
  { id: 'sushi',   name: 'Kraken Sushi Co.',    emoji: '🍣', defense: 200, squad: 6, time: 480,  reward: 4200,  toxin: 3, level: 8, recipe: 'cake' },
  { id: 'casino',  name: 'Necropolis Casino',   emoji: '🎰', defense: 380, squad: 8, time: 900,  reward: 11000, toxin: 6, level: 10, recipe: 'pie' },
];

/*
 * Visual ANCHOR types (Stage 4.6E). The LOGIC grid places objects on tiles; the
 * VISUAL composer draws them from an anchor + orientation so they read as
 * hand-arranged furniture (wall-flush appliances, table sets) — never as cubes
 * centred on cells. `anchorOf()` in world.js resolves an object to one of these.
 */
window.ANCHORS = [
  'FLOOR_BASE_CENTER', 'FLOOR_BASE_FRONT', 'FLOOR_BASE_BACK',
  'WALL_BACK_FLUSH', 'WALL_LEFT_FLUSH', 'WALL_RIGHT_FLUSH', 'WALL_MOUNTED_BACK',
  'COUNTER_FRONT_EDGE', 'STOVE_FRONT_EDGE', 'FRIDGE_WALL_EDGE', 'SINK_WALL_EDGE',
  'TABLE_CENTER', 'CHAIR_SEAT_POINT', 'DOOR_THRESHOLD', 'QUEUE_POINT',
  'CHARACTER_FEET', 'PLATE_ON_TABLE', 'PLATE_ON_COUNTER',
];
// the anchor each decor `art` (and core object) uses
window.ANCHOR_BY_ART = {
  counter: 'COUNTER_FRONT_EDGE', sink: 'SINK_WALL_EDGE', fridge: 'FRIDGE_WALL_EDGE',
  jukebox: 'WALL_MOUNTED_BACK', plant: 'FLOOR_BASE_CENTER', lamp: 'FLOOR_BASE_CENTER',
  rug: 'FLOOR_BASE_CENTER', trash: 'FLOOR_BASE_CENTER', fountain: 'FLOOR_BASE_CENTER', rest: 'FLOOR_BASE_CENTER',
};

// Relative visual HEIGHT per object (Stage 4.7 scale hierarchy). Used to keep a
// believable scale: fridge taller than characters, characters taller than
// tables, counters/stoves waist/chest height, chairs lowest.
window.OBJ_HEIGHT = {
  fridge: 0.92, door: 0.86, lamp: 0.70, character: 0.78, jukebox: 0.74,
  stove: 0.52, counter: 0.36, sink: 0.34, pass: 0.36, plant: 0.46,
  table: 0.36, chair: 0.26, trash: 0.34, rest: 0.18, plate: 0.06,
};

// Object "model" metadata (Stage 4.9). Each renderable furniture/appliance is a
// chunky toon-volume MODEL with explicit anchor, grid footprint, visual height,
// occlusionHeight (how much it hides characters behind it) and a render layer.
// Logic stays tile-based; this drives correct depth/occlusion + build ghosts.
window.OBJ_MODELS = {
  table:   { anchor: 'TABLE_CENTER',       footprint: [1, 1], height: 0.36, occlusionHeight: 0.40, renderLayer: 1, bounds: [0.90, 0.70], canOcclude: true, canBeOccluded: true },
  chair:   { anchor: 'CHAIR_SEAT_POINT',   footprint: [1, 1], height: 0.26, occlusionHeight: 0.30, renderLayer: 1, bounds: [0.40, 0.55], canOcclude: false, canBeOccluded: true },
  stove:   { anchor: 'WALL_BACK_FLUSH',    footprint: [1, 1], height: 0.52, occlusionHeight: 0.62, renderLayer: 1, bounds: [0.90, 1.00], canOcclude: true, canBeOccluded: true },
  counter: { anchor: 'COUNTER_FRONT_EDGE', footprint: [1, 1], height: 0.36, occlusionHeight: 0.45, renderLayer: 1, bounds: [0.90, 0.70], canOcclude: true, canBeOccluded: true },
  pass:    { anchor: 'COUNTER_FRONT_EDGE', footprint: [1, 1], height: 0.36, occlusionHeight: 0.45, renderLayer: 1, bounds: [0.85, 0.78], canOcclude: true, canBeOccluded: true },
  sink:    { anchor: 'SINK_WALL_EDGE',     footprint: [1, 1], height: 0.34, occlusionHeight: 0.45, renderLayer: 1, bounds: [0.90, 0.70], canOcclude: true, canBeOccluded: true },
  fridge:  { anchor: 'FRIDGE_WALL_EDGE',   footprint: [1, 1], height: 0.92, occlusionHeight: 1.00, renderLayer: 2, bounds: [0.70, 1.15], canOcclude: true, canBeOccluded: false },
};
