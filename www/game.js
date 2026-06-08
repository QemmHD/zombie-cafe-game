/* =====================================================================
 * Zombie Cafe — game engine
 *
 * Core loop:
 *   1. Tap a stove → pick a cursed recipe → it cooks in real time.
 *   2. A finished stove glows; tap to plate the batch onto the Ready Counter
 *      (auto-plates after a few seconds so the game keeps flowing while idle).
 *   3. Humans wander in and sit at tables. A free zombie carries a ready dish
 *      to a waiting customer; they eat, then glow gold — tap to collect coins.
 *   4. Some customers are "infectable" (green). Spend Toxin to turn them into a
 *      new zombie staff member instead of taking their money.
 *   5. Serving earns XP → level up → unlock pricier recipes, earn Toxin.
 *
 * Rendering keeps one DOM node per stove / table and mutates it in place each
 * tick, so CSS transitions (timer + patience bars, glows) stay smooth.
 * ===================================================================== */
(function () {
  'use strict';

  // ---- tunables -------------------------------------------------------
  var TICK_MS        = 200;     // game loop cadence
  var SERVE_TIME     = 3;       // seconds a zombie spends delivering a dish
  var EAT_TIME       = 4;       // seconds a customer spends eating
  var AUTO_PAY       = 10;      // seconds before a paying customer auto-pays
  var STOVE_AUTOPLATE= 6;       // seconds before a ready stove auto-plates
  var POOL_CAP       = 60;      // max servings on the Ready Counter
  var MAX_STOVES     = 10;
  var MAX_TABLES     = 16;
  var INFECT_CHANCE  = 0.14;    // chance a customer can be infected
  var INFECT_COST    = 2;       // toxin to infect one customer
  var SAVE_KEY       = 'zombiecafe.save.v1';

  var RECIPES = window.RECIPES, SHOP = window.SHOP, FACES = window.CUSTOMER_FACES;
  var RBY = {}; RECIPES.forEach(function (r) { RBY[r.id] = r; });

  // ---- helpers --------------------------------------------------------
  var now = function () { return Date.now() / 1000; };
  function el(id) { return document.getElementById(id); }
  function fmt(n) {
    n = Math.floor(n);
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k';
    return '' + n;
  }
  function clock(s) {
    s = Math.max(0, Math.ceil(s));
    if (s >= 3600) return Math.floor(s / 3600) + 'h' + Math.floor((s % 3600) / 60) + 'm';
    if (s >= 60) return Math.floor(s / 60) + 'm' + (s % 60) + 's';
    return s + 's';
  }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  // ---- state ----------------------------------------------------------
  var S = null;
  var nextSpawn = 0;

  function freshState() {
    return {
      coins: 60, toxin: 2, xp: 0, level: 1, zombies: 1,
      stoves: [ stove(), stove() ],
      tables: [ table(), table(), table() ],
      pool: [],                 // array of recipeIds ready to serve
      decor: {},                // id -> 1 (owned)
      lastRecipe: 'coffee',
      lastSeen: now(),
      served: 0,
    };
  }
  function stove() { return { id: uid(), recipe: null, start: 0, ready: false, readyAt: 0 }; }
  function table() { return { id: uid(), c: null }; }

  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { S = freshState(); return false; }
      S = JSON.parse(raw);
      // defensive defaults for forward-compat
      S.pool = S.pool || []; S.decor = S.decor || {};
      return true;
    } catch (e) { S = freshState(); return false; }
  }
  var lastSave = 0;
  function save(force) {
    var t = now();
    if (!force && t - lastSave < 4) return;
    lastSave = t; S.lastSeen = t;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
  }

  // ---- derived economy ------------------------------------------------
  function ambiance() {
    var a = 0;
    for (var id in S.decor) { var it = shopById(id); if (it) a += it.ambiance || 0; }
    return a;
  }
  function tipMult()    { return 1 + ambiance() / 200; }
  function patience()   { return 18 + ambiance() / 10; }
  function spawnEvery() { return Math.max(2.5, 7 / (1 + ambiance() / 50)); }
  function xpNeed(lvl)  { return Math.floor(60 * Math.pow(lvl, 1.4)); }
  function unlocked()   { return RECIPES.filter(function (r) { return r.level <= S.level; }); }
  function shopById(id) { for (var i = 0; i < SHOP.length; i++) if (SHOP[i].id === id) return SHOP[i]; return null; }

  function priceFor(item) {
    if (item.kind === 'decor') return item.base;            // one-time
    var owned = item.kind === 'stove' ? S.stoves.length
              : item.kind === 'table' ? S.tables.length
              : S.zombies;
    var freeStart = item.kind === 'stove' ? 2 : item.kind === 'table' ? 3 : 1;
    return Math.round(item.base * Math.pow(item.grow, owned - freeStart));
  }

  // ---- currency / progression ----------------------------------------
  function gainXp(amount) {
    S.xp += amount;
    var leveled = false, before = S.level;
    while (S.xp >= xpNeed(S.level)) {
      S.xp -= xpNeed(S.level); S.level++; leveled = true;
    }
    if (leveled) onLevelUp(before, S.level);
  }
  function onLevelUp(from, to) {
    var toxBonus = to - from;            // +1 toxin per level gained
    S.toxin += toxBonus;
    // figure out any recipes that just unlocked
    var newly = RECIPES.filter(function (r) { return r.level > from && r.level <= to; });
    showLevelUp(to, newly, toxBonus);
    save(true);
  }

  // ---- actions --------------------------------------------------------
  function startCook(stoveId, recipeId) {
    var st = byId(S.stoves, stoveId), r = RBY[recipeId];
    if (!st || !r || st.recipe) return;
    if (S.coins < r.cost) { toast('Not enough coins for ' + r.name); return; }
    S.coins -= r.cost; st.recipe = recipeId; st.start = now(); st.ready = false;
    S.lastRecipe = recipeId; save(true);
  }
  function plateStove(st) {
    if (!st.recipe || !st.ready) return;
    var r = RBY[st.recipe], added = 0;
    for (var i = 0; i < r.batch && S.pool.length < POOL_CAP; i++) { S.pool.push(r.id); added++; }
    var node = stoveNodes[st.id];
    if (node) floatFrom(node, '+' + added + ' ' + r.emoji, 'tox');
    st.recipe = null; st.start = 0; st.ready = false; st.readyAt = 0;
  }
  function boostStove(st) {
    if (!st.recipe || st.ready) return;
    var r = RBY[st.recipe], remain = (st.start + r.time) - now();
    if (remain <= 0) return;
    var cost = Math.max(1, Math.ceil(remain / 60));
    if (S.toxin < cost) { toast('Need ' + cost + ' ☣ to rush this'); return; }
    confirm('Rush ' + r.name + ' for ' + cost + ' ☣?', function () {
      S.toxin -= cost; st.start = now() - r.time; save(true);
    });
  }
  function collectCustomer(tb, viaTap) {
    var c = tb.c; if (!c || c.state !== 'paying') return;
    var pay = c.pay;
    S.coins += pay; S.served++;
    gainXp(c.xp);
    var node = tableNodes[tb.id];
    if (node) { floatFrom(node, '+' + fmt(pay), 'coin'); if (c.xp) floatFrom(node, '+' + c.xp + ' xp', 'xp'); }
    tb.c = null;
    save();
  }
  function infect(tb) {
    var c = tb.c; if (!c || !c.infectable) return;
    if (S.toxin < INFECT_COST) { toast('Need ' + INFECT_COST + ' ☣ to infect'); return; }
    S.toxin -= INFECT_COST; S.zombies++;
    gainXp((c.xp || 1) * 2);
    var node = tableNodes[tb.id];
    if (node) floatFrom(node, '🧟 +1 staff', 'tox');
    tb.c = null; toast('Infected! A new zombie joins your staff.'); save(true);
  }

  function buy(itemId) {
    var item = shopById(itemId); if (!item) return;
    var cost = priceFor(item), bag = item.cur;
    if ((bag === 'coin' ? S.coins : S.toxin) < cost) { toast('Not enough ' + (bag === 'coin' ? 'coins' : 'toxin')); return; }
    if (item.kind === 'stove' && S.stoves.length >= MAX_STOVES) { toast('Kitchen is full'); return; }
    if (item.kind === 'table' && S.tables.length >= MAX_TABLES) { toast('Dining room is full'); return; }
    if (item.kind === 'decor' && S.decor[item.id]) { toast('Already owned'); return; }

    if (bag === 'coin') S.coins -= cost; else S.toxin -= cost;
    if (item.kind === 'stove') S.stoves.push(stove());
    else if (item.kind === 'table') S.tables.push(table());
    else if (item.kind === 'zombie') S.zombies++;
    else if (item.kind === 'decor') S.decor[item.id] = 1;
    save(true);
    openShop();                 // refresh sheet prices
    toast(item.emoji + ' ' + item.name + ' added!');
  }

  function byId(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }

  // ---- spawning + simulation -----------------------------------------
  function trySpawn(t) {
    if (t < nextSpawn) return;
    var empties = S.tables.filter(function (tb) { return !tb.c; });
    nextSpawn = t + spawnEvery() * (0.6 + Math.random() * 0.8);
    if (!empties.length) return;
    var tb = pick(empties);
    tb.c = {
      id: uid(), face: pick(FACES), state: 'waiting',
      arrived: t, phaseStart: t,
      infectable: Math.random() < INFECT_CHANCE,
      dish: null, pay: 0, xp: 0,
    };
  }

  function simulate(t) {
    var busy = 0, i;
    for (i = 0; i < S.tables.length; i++) { var cc = S.tables[i].c; if (cc && cc.state === 'serving') busy++; }

    // stoves: cook -> ready -> auto-plate
    for (i = 0; i < S.stoves.length; i++) {
      var st = S.stoves[i];
      if (!st.recipe) continue;
      var r = RBY[st.recipe];
      if (!st.ready && t >= st.start + r.time) { st.ready = true; st.readyAt = t; }
      if (st.ready && t - st.readyAt >= STOVE_AUTOPLATE) plateStove(st);
    }

    // tables / customers
    for (i = 0; i < S.tables.length; i++) {
      var tb = S.tables[i], c = tb.c; if (!c) continue;
      if (c.state === 'waiting') {
        if (S.pool.length > 0 && busy < S.zombies) {
          c.dish = S.pool.shift(); c.state = 'serving'; c.phaseStart = t; busy++;
        } else if (t - c.arrived > patience()) {
          tb.c = null;                       // left, impatient
        }
      } else if (c.state === 'serving') {
        if (t - c.phaseStart >= SERVE_TIME) { c.state = 'eating'; c.phaseStart = t; }
      } else if (c.state === 'eating') {
        if (t - c.phaseStart >= EAT_TIME) {
          c.state = 'paying'; c.phaseStart = t;
          var rr = RBY[c.dish] || RBY.coffee;
          c.pay = Math.round(rr.price * tipMult());
          c.xp = rr.xp;
        }
      } else if (c.state === 'paying') {
        if (t - c.phaseStart >= AUTO_PAY) collectCustomer(tb, false);
      }
    }
  }

  // welcome-back: finish anything that completed while away, clear stale diners
  function reconcileOffline() {
    var t = now(), finished = 0;
    for (var i = 0; i < S.stoves.length; i++) {
      var st = S.stoves[i]; if (!st.recipe) continue;
      var r = RBY[st.recipe];
      if (t >= st.start + r.time) { st.ready = true; if (!st.readyAt) st.readyAt = t; finished++; }
    }
    for (var j = 0; j < S.tables.length; j++) S.tables[j].c = null;   // they got bored and left
    if (finished > 0 && t - S.lastSeen > 30) {
      setTimeout(function () { toast('🧟 Welcome back! ' + finished + ' dish' + (finished > 1 ? 'es are' : ' is') + ' ready.'); }, 500);
    }
  }

  // =====================================================================
  // Rendering
  // =====================================================================
  var stoveNodes = {}, tableNodes = {};

  function renderHUD() {
    var need = xpNeed(S.level), pct = Math.min(100, (S.xp / need) * 100);
    el('hud').innerHTML =
      '<div class="stat coins"><span class="ico">🪙</span>' + fmt(S.coins) + '</div>' +
      '<div class="stat toxin"><span class="ico">☣️</span>' + fmt(S.toxin) + '</div>' +
      '<div class="level-wrap">' +
        '<div class="level-row"><span>Lv <b>' + S.level + '</b></span>' +
        '<span class="tray-pill">🍽️ <b>' + S.pool.length + '</b> ready</span></div>' +
        '<div class="xpbar"><i style="width:' + pct + '%"></i></div>' +
      '</div>' +
      '<div class="stat zombies"><span class="ico">🧟</span>' + S.zombies + '</div>';
  }

  // keep node set in sync with state list, in order
  function syncNodes(container, list, nodeMap, build) {
    var seen = {};
    list.forEach(function (item, idx) {
      seen[item.id] = true;
      var node = nodeMap[item.id];
      if (!node) { node = build(item); nodeMap[item.id] = node; }
      if (container.children[idx] !== node) container.insertBefore(node, container.children[idx] || null);
    });
    Object.keys(nodeMap).forEach(function (id) {
      if (!seen[id]) { var n = nodeMap[id]; if (n.parentNode) n.parentNode.removeChild(n); delete nodeMap[id]; }
    });
  }

  function buildStove(st) {
    var n = document.createElement('div');
    n.className = 'card stove'; n.dataset.action = 'stove'; n.dataset.id = st.id;
    n.innerHTML = '<span class="tag"></span><span class="badge"></span>' +
      '<span class="big"></span><span class="sub"></span>' +
      '<div class="timerbar"><i></i></div>';
    return n;
  }
  function updateStove(st, t) {
    var n = stoveNodes[st.id];
    var tag = n.children[0], badge = n.children[1], big = n.children[2], sub = n.children[3], bar = n.children[4].firstChild;
    if (!st.recipe) {
      n.className = 'card stove empty';
      tag.textContent = ''; badge.textContent = ''; big.textContent = '➕';
      sub.textContent = 'Cook'; sub.className = 'sub'; bar.style.width = '0%';
      return;
    }
    var r = RBY[st.recipe];
    tag.textContent = r.emoji; badge.textContent = '';
    if (st.ready) {
      n.className = 'card stove ready';
      big.textContent = r.emoji; badge.textContent = r.batch;
      sub.textContent = 'Plate!'; sub.className = 'sub coin'; bar.style.width = '100%';
    } else {
      n.className = 'card stove cooking';
      var remain = (st.start + r.time) - t, pct = Math.min(100, (1 - remain / r.time) * 100);
      big.textContent = r.emoji;
      sub.textContent = clock(remain); sub.className = 'sub';
      bar.style.width = pct + '%';
    }
  }

  function buildTable(tb) {
    var n = document.createElement('div');
    n.className = 'card table'; n.dataset.action = 'table'; n.dataset.id = tb.id;
    n.innerHTML = '<span class="think"></span><span class="big"></span>' +
      '<span class="sub"></span><span class="serve-emoji"></span>' +
      '<button class="infect-btn" data-action="infect" data-id="' + tb.id + '" hidden>🧟</button>' +
      '<div class="patience"><i></i></div>';
    return n;
  }
  function updateTable(tb, t) {
    var n = tableNodes[tb.id], c = tb.c;
    var think = n.children[0], big = n.children[1], sub = n.children[2], serve = n.children[3], infectBtn = n.children[4], pbar = n.children[5].firstChild;
    if (!c) {
      n.className = 'card table empty';
      think.textContent = ''; big.textContent = '🪑'; sub.textContent = '';
      serve.textContent = ''; infectBtn.hidden = true; pbar.style.width = '0%';
      n.children[5].style.opacity = '0';
      return;
    }
    big.textContent = c.face;
    var dishEmoji = c.dish ? (RBY[c.dish] || {}).emoji : '';
    n.children[5].style.opacity = '0';
    infectBtn.hidden = !(c.infectable && (c.state === 'waiting' || c.state === 'paying'));

    if (c.state === 'waiting') {
      n.className = 'card table occupied' + (c.infectable ? ' infectable' : '');
      think.textContent = c.infectable ? '🧟' : '💭';
      sub.textContent = 'Hungry'; serve.textContent = '';
      var left = patience() - (t - c.arrived), p = Math.max(0, Math.min(100, (left / patience()) * 100));
      n.children[5].style.opacity = '1'; pbar.style.width = p + '%';
    } else if (c.state === 'serving') {
      n.className = 'card table serving';
      think.textContent = ''; sub.textContent = 'Order up!'; serve.textContent = '🧟' + dishEmoji;
    } else if (c.state === 'eating') {
      n.className = 'card table eating';
      think.textContent = ''; sub.textContent = 'Eating'; serve.textContent = dishEmoji;
    } else if (c.state === 'paying') {
      n.className = 'card table paying' + (c.infectable ? ' infectable' : '');
      think.textContent = c.infectable ? '🧟' : '';
      sub.textContent = '🪙 ' + fmt(c.pay); serve.textContent = '';
    }
  }

  function renderFloor(t) {
    syncNodes(el('kitchen'), S.stoves, stoveNodes, buildStove);
    syncNodes(el('dining'), S.tables, tableNodes, buildTable);
    S.stoves.forEach(function (st) { updateStove(st, t); });
    S.tables.forEach(function (tb) { updateTable(tb, t); });
  }

  // ---- FX -------------------------------------------------------------
  function floatFrom(node, text, cls) {
    var r = node.getBoundingClientRect();
    var f = document.createElement('div');
    f.className = 'float ' + (cls || '');
    f.textContent = text;
    f.style.left = (r.left + r.width / 2) + 'px';
    f.style.top = (r.top + r.height / 2) + 'px';
    f.style.transform = 'translate(-50%,-50%)';
    el('fx').appendChild(f);
    setTimeout(function () { f.remove(); }, 1000);
  }
  var toastTimer = null;
  function toast(msg) {
    var old = document.querySelector('.toast'); if (old) old.remove();
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.remove(); }, 2600);
  }
  function showLevelUp(lvl, newly, tox) {
    var wrap = document.createElement('div'); wrap.className = 'levelup';
    var names = newly.map(function (r) { return r.emoji + ' ' + r.name; }).join(', ');
    wrap.innerHTML = '<div class="card-up"><div class="lu-big">🧟‍♂️</div>' +
      '<div class="lu-t">Level ' + lvl + '!</div>' +
      '<div class="lu-s">+' + tox + ' ☣ toxin' + (names ? '<br>Unlocked: ' + names : '') + '</div></div>';
    document.body.appendChild(wrap);
    setTimeout(function () { wrap.remove(); }, 1900);
  }

  // =====================================================================
  // Modals
  // =====================================================================
  function openSheet(html) { el('modal-root').innerHTML = '<div class="overlay">' + html + '</div>'; }
  function closeSheet() { el('modal-root').innerHTML = ''; }

  function openCookPicker(stoveId) {
    var list = unlocked().map(function (r) {
      var aff = S.coins >= r.cost;
      return '<div class="row' + (aff ? '' : ' locked') + '">' +
        '<div class="r-ico">' + r.emoji + '</div>' +
        '<div class="r-body"><div class="r-name">' + r.name + '</div>' +
        '<div class="r-meta">⏱ ' + clock(r.time) + ' · makes <b>' + r.batch + '</b> · sells <b>🪙' + r.price + '</b> ea</div></div>' +
        '<button class="buy coin" data-action="cook-pick" data-stove="' + stoveId + '" data-id="' + r.id + '"' + (aff ? '' : ' disabled') + '>🪙 ' + r.cost + '</button>' +
      '</div>';
    }).join('');
    var locked = RECIPES.filter(function (r) { return r.level > S.level; });
    if (locked.length) {
      list += '<div class="r-meta" style="margin:14px 2px 4px;">🔒 Level up to unlock: ' +
        locked.slice(0, 3).map(function (r) { return r.emoji + ' ' + r.name + ' (Lv ' + r.level + ')'; }).join(' · ') + '</div>';
    }
    openSheet(
      '<div class="sheet"><div class="sheet-head"><h3>🔪 Cook a dish</h3>' +
      '<button class="close-x" data-action="close">✕</button></div>' +
      '<p class="hint">Pay ingredients now; the stove cooks in real time.</p>' +
      '<div class="list">' + list + '</div></div>'
    );
  }

  function openShop() {
    function section(title, items) {
      var rows = items.map(function (it) {
        var cost = priceFor(it), bag = it.cur;
        var owned = it.kind === 'decor' && S.decor[it.id];
        var full = (it.kind === 'stove' && S.stoves.length >= MAX_STOVES) || (it.kind === 'table' && S.tables.length >= MAX_TABLES);
        var have = bag === 'coin' ? S.coins : S.toxin;
        var aff = have >= cost && !owned && !full;
        var label = owned ? 'Owned' : full ? 'Max' : (bag === 'coin' ? '🪙 ' : '☣️ ') + fmt(cost);
        var countNote = it.kind === 'stove' ? ' · have ' + S.stoves.length
                      : it.kind === 'table' ? ' · have ' + S.tables.length
                      : it.kind === 'zombie' ? ' · have ' + S.zombies : '';
        return '<div class="row' + (aff || owned ? '' : ' locked') + '">' +
          '<div class="r-ico">' + it.emoji + '</div>' +
          '<div class="r-body"><div class="r-name">' + it.name + countNote + '</div>' +
          '<div class="r-desc">' + it.desc + '</div></div>' +
          '<button class="buy ' + bag + '" data-action="buy" data-id="' + it.id + '"' + (aff ? '' : ' disabled') + '>' + label + '</button>' +
        '</div>';
      }).join('');
      return '<div class="r-meta" style="margin:14px 2px 6px;font-size:13px;">' + title + '</div><div class="list">' + rows + '</div>';
    }
    var build = SHOP.filter(function (s) { return s.kind !== 'decor'; });
    var decor = SHOP.filter(function (s) { return s.kind === 'decor'; });
    openSheet(
      '<div class="sheet"><div class="sheet-head"><h3>🛒 Shop</h3>' +
      '<button class="close-x" data-action="close">✕</button></div>' +
      '<p class="hint">Ambiance: <b>' + ambiance() + '</b> — higher means customers arrive faster and tip more.</p>' +
      section('🏗️ Expand', build) + section('🖼️ Decor (ambiance)', decor) +
      '</div>'
    );
  }

  function openRecipes() {
    var rows = RECIPES.map(function (r) {
      var open = r.level <= S.level;
      return '<div class="row' + (open ? '' : ' locked') + '">' +
        '<div class="r-ico">' + r.emoji + '</div>' +
        '<div class="r-body"><div class="r-name">' + r.name + (open ? '' : ' 🔒') + '</div>' +
        '<div class="r-meta">' + (open ? 'Lv ' + r.level + ' · cost 🪙' + r.cost + ' · ⏱ ' + clock(r.time) + ' · makes ' + r.batch + ' · 🪙' + r.price + ' ea · +' + r.xp + 'xp'
                                       : 'Unlocks at level ' + r.level) + '</div></div></div>';
    }).join('');
    openSheet('<div class="sheet"><div class="sheet-head"><h3>📖 Recipe Book</h3>' +
      '<button class="close-x" data-action="close">✕</button></div>' +
      '<p class="hint">Pricier dishes cook longer but earn far more.</p>' +
      '<div class="list">' + rows + '</div></div>');
  }

  function openHelp() {
    openSheet('<div class="sheet"><div class="sheet-head"><h3>❓ How to play</h3>' +
      '<button class="close-x" data-action="close">✕</button></div>' +
      '<div class="list">' +
      help('🔪', 'Cook', 'Tap a stove, pick a dish. It cooks in real time, then glows — tap to plate it onto the Ready Counter.') +
      help('🧟', 'Serve', 'Customers sit at tables. Your zombie staff carry ready dishes to them automatically. More zombies = more served at once.') +
      help('🪙', 'Collect', 'When a customer glows gold, tap them to grab your coins + XP.') +
      help('🧟‍♀️', 'Infect', 'Some customers glow green. Spend ☣ Toxin to turn them into a new zombie worker instead of taking their money.') +
      help('🛒', 'Grow', 'Spend coins & toxin in the Shop on stoves, tables, staff, and spooky decor that boosts ambiance.') +
      help('⚡', 'Rush', 'Tap a cooking stove to spend Toxin and finish it instantly.') +
      '</div></div>');
  }
  function help(ico, name, body) {
    return '<div class="row"><div class="r-ico">' + ico + '</div><div class="r-body">' +
      '<div class="r-name">' + name + '</div><div class="r-desc">' + body + '</div></div></div>';
  }

  var confirmCb = null;
  function confirm(msg, cb) {
    confirmCb = cb;
    openSheet('<div class="sheet"><h3>Confirm</h3><p class="hint">' + msg + '</p>' +
      '<div class="list"><div class="row" style="gap:10px;">' +
      '<button class="buy toxin" data-action="confirm-yes" style="flex:1;justify-content:center;">Yes</button>' +
      '<button class="buy coin" data-action="close" style="flex:1;justify-content:center;background:#2a3a2e;color:#cfe;">No</button>' +
      '</div></div></div>');
  }

  // =====================================================================
  // Input
  // =====================================================================
  document.addEventListener('click', function (e) {
    if (e.target.classList && e.target.classList.contains('overlay')) { closeSheet(); return; }
    var a = e.target.closest('[data-action]'); if (!a) return;
    var act = a.dataset.action;
    switch (act) {
      case 'stove': {
        var st = byId(S.stoves, a.dataset.id); if (!st) break;
        if (!st.recipe) openCookPicker(st.id);
        else if (st.ready) plateStove(st);
        else boostStove(st);
        break;
      }
      case 'table': {
        var tb = byId(S.tables, a.dataset.id);
        if (tb && tb.c && tb.c.state === 'paying') collectCustomer(tb, true);
        break;
      }
      case 'infect': { e.stopPropagation(); infect(byId(S.tables, a.dataset.id)); break; }
      case 'cook-pick': { startCook(a.dataset.stove, a.dataset.id); closeSheet(); break; }
      case 'buy': buy(a.dataset.id); break;
      case 'open-shop': openShop(); break;
      case 'open-recipes': openRecipes(); break;
      case 'open-help': openHelp(); break;
      case 'confirm-yes': { var cb = confirmCb; confirmCb = null; closeSheet(); if (cb) cb(); break; }
      case 'close': closeSheet(); break;
    }
    renderHUD();
  });

  // =====================================================================
  // Loop
  // =====================================================================
  function tick() {
    var t = now();
    trySpawn(t);
    simulate(t);
    renderHUD();
    renderFloor(t);
    save(false);
  }

  function init() {
    var existing = load();
    nextSpawn = now() + 1.5;
    if (existing) reconcileOffline();
    renderHUD();
    renderFloor(now());
    if (!existing) setTimeout(openHelp, 400);
    setInterval(tick, TICK_MS);
    // pause-safe save when backgrounded
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(true); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
