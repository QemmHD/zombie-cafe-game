/* =====================================================================
 * Zombie Cafe — glue: game loop, HUD, input, modals, persistence.
 * Ties the World simulation to the 2D Renderer, handles taps on the cafe,
 * the shop, the recipe picker, and the raid map (take over rival cafes).
 * ===================================================================== */
(function () {
  'use strict';
  var SAVE_KEY = 'zombiecafe.save.v4';
  var world, renderer, canvas, lastFrame = 0, lastSave = 0;
  var editMode = false, selected = null;   // build mode + currently lifted furniture
  var selZ = null;                         // tap-command: currently selected zombie id

  function el(id) { return document.getElementById(id); }
  function now() { return Date.now() / 1000; }
  function fmt(n) { n = Math.floor(n); if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k'; return '' + n; }
  function clock(s) { s = Math.max(0, Math.ceil(s)); if (s >= 3600) return Math.floor(s / 3600) + 'h' + Math.floor(s % 3600 / 60) + 'm'; if (s >= 60) return Math.floor(s / 60) + 'm' + (s % 60) + 's'; return s + 's'; }
  function recipeById(id) { return (window.RECIPES || []).filter(function (r) { return r.id === id; })[0]; }

  // ---- persistence ----------------------------------------------------
  function save(force) {
    var t = now(); if (!force && t - lastSave < 4) return; lastSave = t;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ at: t, w: world.snapshot() })); } catch (e) {}
  }
  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY); if (!raw) return false;
      var data = JSON.parse(raw); world = window.createWorld(data.w);
      world.fastForward(now() - (data.at || now())); return true;
    } catch (e) { world = window.createWorld(); return false; }
  }

  // ---- HUD ------------------------------------------------------------
  var repFlash = 0, repFlashDir = 1;
  function stars() {
    var s = world.ratingStars(), full = Math.floor(s + 0.001), half = (s - full) >= 0.5;
    var out = ''; for (var i = 0; i < 5; i++) out += i < full ? '★' : (i === full && half ? '⯨' : '☆');
    return out;
  }
  function renderHUD() {
    var need = world.xpNeed(world.level), pct = Math.min(100, world.xp / need * 100);
    var raidNote = world.raid ? '<span class="raidpill">⚔️ ' + clock(world.raid.returnsAt - world.t) + '</span>' : '';
    var flashCls = repFlash > 0 ? (repFlashDir > 0 ? ' up' : ' down') : '';
    if (repFlash > 0) repFlash--;
    var act = world.activeZombies().length, slots = world.activeSlots(), stored = world.storedZombies().length;
    el('hud').innerHTML =
      '<div class="hud-left">' +
        '<div class="cafe-line"><span class="lvbadge">' + world.level + '</span>' +
          '<div class="cafe-id"><div class="cafename">' + world.cafeName + '</div>' +
          '<div class="rating' + flashCls + '">' + stars() + '</div></div>' + raidNote + '</div>' +
        '<div class="xpbar"><i style="width:' + pct + '%"></i><b>' + fmt(world.xp) + '/' + fmt(need) + '</b></div>' +
      '</div>' +
      '<div class="hud-right">' +
        '<div class="stat coins"><span class="ico">🪙</span>' + fmt(world.coins) + '<button class="plus" data-act="open-shop">+</button></div>' +
        '<div class="stat toxin"><span class="ico">☣️</span>' + fmt(world.toxin) + '<button class="plus" data-act="open-roster">+</button></div>' +
        '<div class="logo-badge" data-act="open-help">🧟</div>' +
      '</div>';
  }

  // ---- FX -------------------------------------------------------------
  function floatText(wx, wy, text, cls) {
    var p = renderer.toClient(wx, wy), f = document.createElement('div');
    f.className = 'float ' + (cls || ''); f.textContent = text;
    f.style.left = p.x + 'px'; f.style.top = p.y + 'px';
    el('fx').appendChild(f); setTimeout(function () { f.remove(); }, 1000);
  }
  var toastTimer = null;
  function toast(msg) {
    var old = document.querySelector('.toast'); if (old) old.remove();
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.remove(); }, 2600);
  }
  function levelBanner(lvl, newly, tox) {
    var wrap = document.createElement('div'); wrap.className = 'levelup';
    var names = newly.map(function (r) { return r.emoji + ' ' + r.name; }).join(', ');
    wrap.innerHTML = '<div class="card-up"><div class="lu-big">🧟‍♂️</div><div class="lu-t">Level ' + lvl + '!</div>' +
      '<div class="lu-s">+' + tox + ' ☣ toxin' + (names ? '<br>Unlocked: ' + names : '') + '</div></div>';
    document.body.appendChild(wrap); setTimeout(function () { wrap.remove(); }, 1900);
  }

  // green toxin cloud where a customer was infected
  function transformFx(wx, wy) {
    var p = renderer.toClient(wx, wy - 20);
    var cloud = document.createElement('div'); cloud.className = 'toxcloud';
    cloud.style.left = p.x + 'px'; cloud.style.top = p.y + 'px'; cloud.textContent = '☣️';
    el('fx').appendChild(cloud); setTimeout(function () { cloud.remove(); }, 900);
  }
  // "new recruit" card popup after an infection
  function zombiePopup(z, stored) {
    if (!z) return;
    var wrap = document.createElement('div'); wrap.className = 'levelup';
    wrap.innerHTML = '<div class="card-up"><div class="lu-big">🧟</div>' +
      '<div class="lu-t">' + z.name + '!</div>' +
      '<div class="lu-s">' + (z.kind || 'Server') + (z.trait ? ' · ' + z.trait : '') + '<br>' +
      '⚡×' + z.speed.toFixed(2) + ' · 🍽️×' + z.serve.toFixed(2) + ' · 👊' + z.attack +
      (stored ? '<br>📦 Sent to the Meat Locker' : '<br>🟢 Joined your staff') + '</div></div>';
    document.body.appendChild(wrap); setTimeout(function () { wrap.remove(); }, 2100);
  }

  function drainEvents() {
    var evs = world.events; world.events = [];
    evs.forEach(function (e) {
      if (e.type === 'coin') { floatText(e.x, e.y - 30, '+' + fmt(e.amount), 'coin'); if (e.xp) floatText(e.x + 18, e.y - 12, '+' + e.xp + 'xp', 'xp'); }
      else if (e.type === 'level') levelBanner(e.level, e.newly, e.toxin);
      else if (e.type === 'warn') toast(e.msg);
      else if (e.type === 'bought') toast(e.item.emoji + ' ' + e.item.name + ' added!');
      else if (e.type === 'CustomerInfected') { transformFx(e.x, e.y); setTimeout(function () { zombiePopup(e.zombie, e.stored); }, 650); }
      else if (e.type === 'plated') { floatText(e.x, e.y - 30, '+' + e.n + ' ' + e.emoji, 'tox'); }
      else if (e.type === 'raidStart') toast('⚔️ Squad sent to raid ' + e.rival.name);
      else if (e.type === 'raidEnd') raidResult(e);
      else if (e.type === 'sold') toast('💰 Sold for 🪙' + e.coins);
      else if (e.type === 'fridge') floatText(e.x, e.y - 30, '+' + e.n + ' ' + e.emoji, 'tox');
      else if (e.type === 'FoodBurned') { floatText(e.x, e.y - 30, '🔥 burnt!', 'bad'); toast('🔥 A dish burned — move finished food to the pass faster!'); }
      else if (e.type === 'ZombieScaredCustomer') { floatText(e.x, e.y - 20, '😱', 'bad'); toast('😱 A starving zombie scared a customer off! Feed your staff.'); }
      else if (e.type === 'ZombieDaydreaming') floatText(e.x, e.y - 40, '💭');
      else if (e.type === 'recipeUnlocked') toast('📖 New recipe unlocked: ' + e.recipe.emoji + ' ' + e.recipe.name);
      else if (e.type === 'ratingUp') { repFlash = 30; repFlashDir = 1; }
      else if (e.type === 'ratingDown') { repFlash = 30; repFlashDir = -1; }
    });
  }

  // ---- loop -----------------------------------------------------------
  function frame(ts) {
    var dt = lastFrame ? (ts - lastFrame) / 1000 : 0; lastFrame = ts;
    if (!editMode) world.tick(dt);        // freeze the sim while rearranging
    drainEvents();
    renderer.draw(world, ts / 1000, { edit: editMode, selected: selected, selZ: selZ, debugGrid: !!window.__GRID__ });
    renderHUD();
    save(false);
    requestAnimationFrame(frame);
  }

  // ---- input on the cafe: tap-command grammar --------------------------
  // tap zombie = select it; tap a valid target = command it; tap floor =
  // deselect. With nothing selected, taps fall through to context actions.
  function onTap(clientX, clientY) {
    var w = renderer.toWorld(clientX, clientY);
    if (editMode) return onTapEdit(w);
    var z = world.pickZombieAt(w.x, w.y);

    if (selZ) {
      if (!world.zombies.some(function (s) { return s.id === selZ; })) { deselect(); return; }
      if (z && z.id !== selZ) { select(z.id); return; }          // switch selection
      if (z && z.id === selZ) { openZombie(z.id); return; }      // tap again = info
      var hit = world.pickTargetAt(w.x, w.y);
      if (hit) {
        if (hit.kind === 'customer' && hit.state === 'paying') { world.collectCustomer(hit.id); return; }
        var res = world.commandZombie(selZ, hit);
        if (res.ok) { if (res.msg) toast(res.msg); deselect(); }
        else { redX(clientX, clientY); if (res.msg) toast(res.msg); }
        return;
      }
      deselect(); return;                                        // empty floor
    }

    if (z) { select(z.id); return; }
    var hit2 = world.pickAt(w.x, w.y);
    if (!hit2) return;
    if (hit2.kind === 'stove') {
      var st = world.stoves.filter(function (s) { return s.id === hit2.id; })[0];
      if (st.burned) { world.clearBurned(st.id); toast('🧽 Wiped the burnt food off the stove'); }
      else if (st.ready) {
        if (world.auto) world.plateStove(st.id);                 // casual tap-to-serve
        else { redX(clientX, clientY); toast('Auto is off — tap a zombie, then this stove'); }
      } else if (st.recipe) rushConfirm(st.id);
      else openCook(st.id);
    } else if (hit2.kind === 'customer') {
      if (hit2.paying) world.collectCustomer(hit2.id);
      else openCustomer(hit2.id);                 // tap a seated/queued customer -> recruit panel
    }
  }

  function select(zid) {
    selZ = zid;
    var z = world.zombies.filter(function (s) { return s.id === zid; })[0]; if (!z) return;
    var b = el('selbar'); if (b) b.remove();
    b = document.createElement('div'); b.id = 'selbar'; b.className = 'buildbar selbar';
    b.innerHTML = '🧟 <b>' + z.name + '</b> · ' + Math.round(z.energy) + '%⚡ — tap a glowing stove, hungry customer, or dirty table' +
      '<button class="buy coin" data-act="sel-info">Info</button><button class="buy" data-act="sel-off" style="background:#2a3a2e;color:#cfe;">✕</button>';
    document.body.appendChild(b);
  }
  function deselect() { selZ = null; var b = el('selbar'); if (b) b.remove(); }
  function redX(cx, cy) {
    var f = document.createElement('div'); f.className = 'float bad'; f.textContent = '✖';
    f.style.left = cx + 'px'; f.style.top = cy + 'px';
    el('fx').appendChild(f); setTimeout(function () { f.remove(); }, 700);
  }

  function openZombie(zid) {
    var z = world.zombies.filter(function (s) { return s.id === zid; })[0]; if (!z) return;
    var rar = z.rarity === 'elite' ? '⭐ Elite' : z.rarity === 'rare' ? '🔹 Rare' : 'Common';
    var ecol = z.energy > 45 ? 'var(--toxic)' : z.energy > 22 ? 'var(--gold)' : 'var(--blood)';
    var roles = [['auto', 'Auto'], ['waiter', 'Waiter'], ['cleaner', 'Cleaner'], ['rest', 'Rest']];
    var rb = roles.map(function (r) { return '<button class="rolebtn' + (z.role === r[0] ? ' on' : '') + '" data-act="role" data-id="' + zid + '" data-role="' + r[0] + '">' + r[1] + '</button>'; }).join('');
    var stat = function (n, v) { return '<div class="zstat"><span>' + n + '</span><b>' + v + '</b></div>'; };
    openSheet('<div class="sheet">' + head('🧟 ' + z.name) +
      '<p class="hint">' + rar + ' zombie · doing: <b>' + (z.state === 'resting' ? 'resting' : z.role) + '</b></p>' +
      '<div class="ebar"><i style="width:' + Math.max(0, z.energy) + '%;background:' + ecol + '"></i></div>' +
      '<div class="zstats">' + stat('Energy', Math.round(z.energy) + '%') + stat('Speed', '×' + z.speed.toFixed(2)) + stat('Serve', '×' + z.serve.toFixed(2)) + stat('Clean', '×' + z.clean.toFixed(2)) + '</div>' +
      '<div class="r-meta" style="margin:12px 2px 6px;">Job</div><div class="rolerow">' + rb + '</div>' +
      '<button class="buy toxin" data-act="feed" data-id="' + zid + '" style="width:100%;justify-content:center;margin-top:12px;">☣️ Feed (1 toxin) — refill energy</button>' +
      '</div>');
  }
  // Build mode: tap a piece to lift it (Move/Store/Sell bar appears); tap a
  // valid spot to drop it there.
  function onTapEdit(w) {
    if (selected) {
      if (selected.kind === 'stove') { var slot = world.stoveSlotAt(w.x, w.y); if (slot >= 0 && world.moveStove(selected.id, slot)) { selected = null; buildBar(); return; } }
      else { var cell = world.cellAt(w.x, w.y); if (cell >= 0) { var ok = selected.kind === 'table' ? world.moveTable(selected.id, cell) : world.moveDecor(selected.id, cell); if (ok) { selected = null; buildBar(); checkLayout(); return; } } }
      var p = world.pickFurnitureAt(w.x, w.y); selected = p || null; buildBar(); return;
    }
    selected = world.pickFurnitureAt(w.x, w.y); buildBar();
    if (!selected) toast('Tap a table, stove or decoration to move, store or sell it');
  }
  function buildBar() {
    var b = el('buildbar'); if (!b) return;
    if (selected) {
      var sellv = selected.kind === 'table' ? 40 : selected.kind === 'stove' ? 60 : ((shopItem((world.decors.filter(function (d) { return d.id === selected.id; })[0] || {}).deco) || {}).sell || 0);
      b.innerHTML = '✋ Tap a spot to move · or ' +
        '<button class="mini" data-act="build-store">📦 Store</button>' +
        '<button class="mini coin" data-act="build-sell">💰 Sell 🪙' + sellv + '</button>' +
        '<button class="mini" data-act="build-done">Done</button>';
    } else {
      b.innerHTML = '🔨 Build — tap a table / stove / decoration to move, store or sell <button class="mini coin" data-act="build-done">Done</button>';
    }
  }
  function updateAutoBtn() {
    var b = el('autobtn'); if (!b) return;
    b.innerHTML = (world.auto ? '🤖' : '👆') + '<span>Auto ' + (world.auto ? 'ON' : 'OFF') + '</span>';
    b.classList.toggle('off', !world.auto);
  }
  function checkLayout() { var p = world.layoutWarnings(); if (p.length) toast('⚠ ' + p[0]); }
  function setEdit(on) {
    editMode = on; selected = null; deselect();
    if (!on && world.repathAll) { world.repathAll(); checkLayout(); }   // furniture moved: re-route + warn
    var b = el('buildbar');
    if (on) { if (!b) { b = document.createElement('div'); b.id = 'buildbar'; b.className = 'buildbar'; document.body.appendChild(b); } buildBar(); }
    else if (b) b.remove();
    renderHUD();
  }

  // ---- modals ---------------------------------------------------------
  function openSheet(html) { el('modal-root').innerHTML = '<div class="overlay">' + html + '</div>'; }
  function closeSheet() { el('modal-root').innerHTML = ''; }
  function head(title) { return '<div class="sheet-head"><h3>' + title + '</h3><button class="close-x" data-act="close">✕</button></div>'; }

  function openCook(stoveId) {
    var rows = world.unlocked().map(function (r) {
      var aff = world.coins >= r.cost;
      return '<div class="row' + (aff ? '' : ' locked') + '"><div class="r-ico">' + r.emoji + '</div>' +
        '<div class="r-body"><div class="r-name">' + r.name + '</div><div class="r-meta">⏱ ' + clock(r.time) + ' · makes <b>' + r.batch + '</b> · 🪙' + r.price + ' ea</div></div>' +
        '<button class="buy coin" data-act="cook" data-stove="' + stoveId + '" data-id="' + r.id + '"' + (aff ? '' : ' disabled') + '>🪙 ' + r.cost + '</button></div>';
    }).join('');
    var locked = (window.RECIPES || []).filter(function (r) { return r.level > world.level; });
    if (locked.length) rows += '<div class="r-meta" style="margin:12px 2px;">🔒 ' + locked.slice(0, 3).map(function (r) { return r.emoji + ' ' + r.name + ' (Lv ' + r.level + ')'; }).join(' · ') + '</div>';
    openSheet('<div class="sheet">' + head('🔪 Cook a dish') + '<p class="hint">Pay ingredients now; it cooks in real time, then your zombies serve it.</p><div class="list">' + rows + '</div></div>');
  }

  var shopTab = 'Furniture';
  function openShop(tab) {
    if (tab) shopTab = tab;
    var cats = ['Furniture', 'Kitchen', 'Staff', 'Decor', 'Utility', 'Storage'];
    var tabs = cats.map(function (cat) { return '<button class="tab' + (cat === shopTab ? ' on' : '') + '" data-act="shop-tab" data-id="' + cat + '">' + cat + '</button>'; }).join('');
    var body;
    if (shopTab === 'Storage') {
      body = world.storage.length ? '<div class="list">' + world.storage.map(function (it, i) {
        var name = it.kind === 'decor' ? (shopItem(it.deco) || {}).name : it.kind === 'table' ? 'Bistro Table' : 'Cursed Stove';
        var emoji = it.kind === 'decor' ? (shopItem(it.deco) || {}).emoji : it.kind === 'table' ? '🪑' : '🔥';
        return '<div class="row"><div class="r-ico">' + emoji + '</div><div class="r-body"><div class="r-name">' + name + '</div><div class="r-desc">Stashed — place it back free.</div></div>' +
          '<button class="buy coin" data-act="place-storage" data-id="' + i + '">Place</button></div>';
      }).join('') + '</div>' : '<p class="hint">Nothing stashed. Store furniture in Build mode to keep it without selling.</p>';
    } else {
      var items = (window.SHOP || []).filter(function (s) { return (s.cat || 'Decor') === shopTab; });
      body = '<div class="list">' + (items.length ? items.map(function (it) {
        var cost = world.priceFor(it), bag = it.cur;
        var full = (it.kind === 'stove' && world.freeStoveSlot() < 0) || ((it.kind === 'table' || it.kind === 'decor') && world.firstFreeCell() < 0);
        var have = bag === 'coin' ? world.coins : world.toxin, aff = have >= cost && !full;
        var label = full ? 'No room' : (bag === 'coin' ? '🪙 ' : '☣️ ') + fmt(cost);
        var note = it.kind === 'stove' ? ' · have ' + world.stoves.length : it.kind === 'table' ? ' · have ' + world.tables.length : it.kind === 'zombie' ? ' · ' + world.activeZombies().length + '/' + world.activeSlots() : '';
        return '<div class="row' + (aff ? '' : ' locked') + '"><div class="r-ico">' + it.emoji + '</div><div class="r-body"><div class="r-name">' + it.name + note + '</div><div class="r-desc">' + it.desc + '</div></div>' +
          '<button class="buy ' + bag + '" data-act="buy" data-id="' + it.id + '"' + (aff ? '' : ' disabled') + '>' + label + '</button></div>';
      }).join('') : '<p class="hint">Nothing here yet.</p>') + '</div>';
    }
    openSheet('<div class="sheet">' + head('🛒 Store') + '<div class="tabs">' + tabs + '</div>' +
      '<p class="hint">Ambiance <b>' + world.ambiance() + '</b> · pieces sit on the floor — rearrange or sell them in 🔨 Build.</p>' + body + '</div>');
  }
  function shopItem(id) { return (window.SHOP || []).filter(function (s) { return s.id === id; })[0]; }

  function openRecipes() {
    var rows = (window.RECIPES || []).map(function (r) {
      var open = r.level <= world.level;
      return '<div class="row' + (open ? '' : ' locked') + '"><div class="r-ico">' + r.emoji + '</div><div class="r-body"><div class="r-name">' + r.name + (open ? '' : ' 🔒') + '</div>' +
        '<div class="r-meta">' + (open ? 'Lv ' + r.level + ' · 🪙' + r.cost + ' · ⏱ ' + clock(r.time) + ' · x' + r.batch + ' · 🪙' + r.price + ' ea' : 'Unlocks at level ' + r.level) + '</div></div></div>';
    }).join('');
    openSheet('<div class="sheet">' + head('📖 Recipe Book') + '<div class="list">' + rows + '</div></div>');
  }

  function openMap() {
    var active = '';
    if (world.raid) { var rv = (window.RIVALS || []).filter(function (r) { return r.id === world.raid.rival; })[0]; active = '<div class="raidbar">⚔️ Raiding <b>' + rv.name + '</b> — squad returns in ' + clock(world.raid.returnsAt - world.t) + '</div>'; }
    var rows = (window.RIVALS || []).map(function (rv) {
      var locked = world.level < rv.level, enough = world.zombies.length >= rv.squad, can = world.canRaid(rv.id);
      var sub = locked ? 'Unlocks at level ' + rv.level : 'Defense ' + rv.defense + ' · needs ' + rv.squad + '🧟 · ' + clock(rv.time) + ' · loot 🪙' + fmt(rv.reward) + (rv.toxin ? ' +' + rv.toxin + '☣' : '');
      var btn = locked ? '<button class="buy" disabled>🔒</button>'
        : world.raid ? '<button class="buy" disabled>Busy</button>'
        : '<button class="buy ' + (can ? 'coin' : '') + '" data-act="raid" data-id="' + rv.id + '"' + (can ? '' : ' disabled') + '>' + (enough ? 'Raid' : 'Need ' + rv.squad + '🧟') + '</button>';
      return '<div class="row' + (locked ? ' locked' : '') + '"><div class="r-ico">' + rv.emoji + '</div><div class="r-body"><div class="r-name">' + rv.name + '</div><div class="r-meta">' + sub + '</div></div>' + btn + '</div>';
    }).join('');
    openSheet('<div class="sheet">' + head('⚔️ Raid Map') + '<p class="hint">Send a squad of zombies to take over rival cafes. Win to loot coins & toxin. Power = squad size + your level.</p>' + active + '<div class="list">' + rows + '</div></div>');
  }
  function raidResult(e) {
    var w = e.win;
    openSheet('<div class="sheet"><div class="result ' + (w ? 'win' : 'lose') + '"><div class="r-big">' + (w ? '🏆' : '💀') + '</div>' +
      '<div class="r-t">' + (w ? 'Raid successful!' : 'Raid repelled') + '</div>' +
      '<div class="r-s">' + e.rival.emoji + ' ' + e.rival.name + '</div>' +
      '<div class="loot">+🪙' + fmt(e.loot) + (e.toxin ? ' +☣' + e.toxin : '') + '</div>' +
      (e.recipe ? '<div class="r-s" style="color:var(--toxic);margin-top:8px;">📖 Stole recipe: ' + e.recipe.emoji + ' ' + e.recipe.name + '!</div>' : '') +
      '<div class="r-s">Your squad returns to work.</div>' +
      '<button class="buy coin" data-act="close" style="margin-top:14px;justify-content:center;width:100%;">Nice</button></div></div>');
  }

  function ctype(id) { return (window.CUSTOMER_TYPES || []).filter(function (t) { return t.id === id; })[0] || (window.CUSTOMER_TYPES || [])[0]; }
  function rarTag(r) { return r === 'elite' ? '<span class="rar elite">★ Elite</span>' : r === 'rare' ? '<span class="rar rare">◆ Rare</span>' : '<span class="rar">Common</span>'; }
  function ebar(z) { var p = Math.max(0, z.energy / (z.maxEnergy || 100) * 100); var col = p > 45 ? 'var(--toxic)' : p > 22 ? 'var(--gold)' : 'var(--blood)'; return '<div class="ebar"><i style="width:' + p + '%;background:' + col + '"></i></div>'; }

  // ---- Staff roster / Meat Locker (Phase 10) -------------------------
  function zombieCard(z) {
    var reanim = z.reanimateUntil > world.t;
    var statePill = z.stored ? (reanim ? '🩸 reanimating ' + clock(z.reanimateUntil - world.t) : '📦 in locker') :
      (z.state === 'resting' ? '😴 resting' : z.state === 'daydream' ? '💭 dazed' : z.role === 'rest' ? '😴 off-duty' : '🟢 ' + (z.state === 'idle' ? 'ready' : 'working'));
    var stats = '<div class="zstats">' +
      zs('⚡', 'Spd', '×' + z.speed.toFixed(2)) + zs('🍽️', 'Srv', '×' + z.serve.toFixed(2)) +
      zs('🧽', 'Cln', '×' + z.clean.toFixed(2)) + zs('🍳', 'Cook', '×' + (z.cook || 1).toFixed(2)) +
      zs('👊', 'Atk', '' + z.attack) + zs('🧠', 'Pat', (z.patience || 1).toFixed(1)) + '</div>';
    var btns = '<div class="zbtns">';
    if (z.stored) btns += '<button class="mini coin" data-act="z-activate" data-id="' + z.id + '"' + (reanim ? ' disabled' : '') + '>Assign</button>';
    else { btns += '<button class="mini" data-act="z-store" data-id="' + z.id + '">Store</button>'; btns += '<button class="mini" data-act="z-rest" data-id="' + z.id + '">Rest</button>'; }
    btns += '<button class="mini toxin" data-act="z-feed" data-id="' + z.id + '">☣ Refill</button>';
    btns += '<button class="mini" data-act="z-rename" data-id="' + z.id + '">Rename</button>';
    btns += '<button class="mini" data-act="z-raid" data-id="' + z.id + '" disabled>Raid</button>';
    btns += '</div>';
    return '<div class="zcard"><div class="zhead"><span class="zportrait">🧟</span>' +
      '<div class="zmeta"><div class="zname">' + z.name + ' ' + rarTag(z.rarity) + '</div>' +
      '<div class="zsub">' + (z.kind || 'Server') + (z.trait ? ' · ' + z.trait : '') + ' · ' + statePill + '</div></div>' +
      '<div class="zen">' + Math.round(z.energy) + '/' + (z.maxEnergy || 100) + '⚡</div></div>' +
      ebar(z) + stats + btns + '</div>';
  }
  function zs(i, n, v) { return '<div class="zstat"><span class="zi">' + i + '</span><span class="zn">' + n + '</span><b>' + v + '</b></div>'; }
  function openRoster() {
    var active = world.activeZombies(), stored = world.storedZombies();
    var slotCost = 4 + (world.extraSlots || 0) * 2;
    var html = '<div class="sheet">' + head('🧟 Staff — Active ' + active.length + '/' + world.activeSlots()) +
      '<p class="hint">Active staff work the floor. The rest wait in the Meat Locker. ' +
      '<button class="mini toxin" data-act="buy-slot">+1 slot (☣' + slotCost + ')</button></p>' +
      '<div class="list">' + (active.length ? active.map(zombieCard).join('') : '<p class="hint">No active staff!</p>') + '</div>';
    if (stored.length) html += '<div class="r-meta" style="margin:14px 2px 6px;">🪦 Meat Locker (' + stored.length + ')</div><div class="list">' + stored.map(zombieCard).join('') + '</div>';
    openSheet(html + '</div>');
  }

  // ---- Customer info + infection panel (Phase 9) ---------------------
  function openCustomer(cid) {
    var c = world.customers.filter(function (x) { return x.id === cid; })[0]; if (!c) return;
    var t = ctype(c.type), z = t.z, cost = world.infectCost(c);
    var full = world.activeZombies().length >= world.activeSlots();
    var canAfford = world.toxin >= (cost.toxin || 0) && world.coins >= (cost.cash || 0);
    var costStr = (cost.toxin ? '☣ ' + cost.toxin : '') + (cost.cash ? (cost.toxin ? ' + ' : '') + '🪙 ' + cost.cash : '');
    var mood = c.mood || (c.annoyed ? 'impatient' : 'content');
    openSheet('<div class="sheet">' + head('🧟‍♀️ Recruit a ' + t.name) +
      '<div class="cust-panel">' +
        '<div class="cust-col"><div class="r-meta">Customer</div>' +
          kv('Type', t.name + ' ' + rarTag(t.rarity)) + kv('Mood', mood) +
          kv('Spends', '🪙 ' + Math.round((recipeById(world.lastRecipe) || { price: 5 }).price * t.pay) + ' · tip ' + Math.round(t.tip * 100) + '%') +
          kv('Patience', (t.patience).toFixed(1) + '×') +
        '</div>' +
        '<div class="cust-col zprev"><div class="r-meta">Becomes</div>' +
          '<div class="zname">🧟 ' + z.role + ' ' + rarTag(z.rarity) + '</div>' +
          kv('Speed', '×' + z.speed.toFixed(2)) + kv('Serve', '×' + z.serve.toFixed(2)) +
          kv('Clean', '×' + z.clean.toFixed(2)) + kv('Attack', '' + z.attack) +
          kv('Energy', '' + z.maxEnergy) + kv('Trait', z.trait || '—') +
        '</div>' +
      '</div>' +
      (full ? '<p class="hint">⚠ Active staff full — this zombie goes to the Meat Locker.</p>' : '') +
      '<button class="buy ' + (canAfford ? 'toxin' : '') + '" data-act="infect-do" data-id="' + cid + '"' + (canAfford ? '' : ' disabled') + ' style="width:100%;justify-content:center;margin-top:10px;">' +
        (canAfford ? '🧟 Infect (' + costStr + ')' : 'Need ' + costStr) + '</button>' +
      '<button class="buy" data-act="close" style="width:100%;justify-content:center;margin-top:8px;background:#2a3a2e;color:#cfe;">Close</button>' +
      '</div>');
  }
  function kv(k, v) { return '<div class="kv"><span>' + k + '</span><b>' + v + '</b></div>'; }

  function openFridge() {
    var rows = world.fridge.map(function (b, i) {
      var r = recipeById(b.recipeId) || { emoji: '🍽️', name: b.recipeId, level: 1 };
      var known = r.level <= world.level || (world.extraRecipes || []).indexOf(b.recipeId) >= 0;
      var lowLvl = !known && r.level > world.level;
      var btns = '<button class="mini coin" data-act="fridge-serve" data-id="' + i + '">Serve ' + b.servings + '</button>';
      if (b.canUnlock && !known) btns += '<button class="mini toxin" data-act="fridge-unlock" data-id="' + i + '"' + (lowLvl ? ' disabled' : '') + '>📖 Unlock</button>';
      btns += '<button class="mini" data-act="fridge-discard" data-id="' + i + '">🗑</button>';
      return '<div class="row"><div class="r-ico">' + r.emoji + '</div><div class="r-body"><div class="r-name">' + r.name +
        (known ? '' : ' <span style="color:var(--toxic)">NEW</span>') + '</div><div class="r-meta">' + b.servings + ' servings · from ' + (b.source || 'a raid') +
        (lowLvl ? ' · 🔒 needs Lv ' + r.level : '') + '</div></div><div class="zbtns">' + btns + '</div></div>';
    }).join('');
    if (!world.fridge.length) rows = '<p class="hint">The fridge is empty. Win raids to stock it with stolen food and new recipes.</p>';
    openSheet('<div class="sheet">' + head('🧊 Fridge') + '<p class="hint">Raid loot. Serve it on the pass, or unlock a brand-new recipe (uses the batch).</p><div class="list">' + rows + '</div></div>');
  }

  function openHelp() {
    function h(i, n, b) { return '<div class="row"><div class="r-ico">' + i + '</div><div class="r-body"><div class="r-name">' + n + '</div><div class="r-desc">' + b + '</div></div></div>'; }
    openSheet('<div class="sheet">' + head('❓ How to play') + '<div class="list">' +
      h('🔪', 'Cook', 'Tap a stove, pick a dish. It cooks in real time, then glows with a SERVE tag.') +
      h('👆', 'Command', 'Tap a zombie to select it (green ring), then tap a glowing target: a ready stove to carry food, a hungry customer to serve, a dirty table to clean. Tap the floor to deselect.') +
      h('🤖', 'Auto', 'Auto ON: zombies find work themselves and tapping a SERVE stove plates instantly. Auto OFF: nothing happens until YOU command it — full Zombie Cafe style.') +
      h('🪙', 'Collect', 'When a customer shows a coin, tap them to grab coins + XP.') +
      h('🔥', 'Don\'t burn it!', 'Finished food sits on the stove — move it to the pass (or let Auto carry it) before it burns. Burnt food is wasted and drops your rating. Tap a burnt stove to wipe it clean.') +
      h('⭐', 'Rating', 'The stars (top bar) rise with fast, happy service and clean tables, and fall from long waits, dirty tables and burnt food. Higher rating = more & richer customers.') +
      h('🧟‍♀️', 'Infect', 'Tap a customer with a green 🧟 bubble to spend toxin and turn them into a new zombie worker.') +
      h('⚔️', 'Raid', 'Open the Raid Map to send zombie squads to take over rival cafes — win loot into your 🧊 Fridge and unlock their recipe.') +
      h('🧊', 'Fridge', 'Stolen raid food lives here. Serve it on the pass, or unlock a brand-new recipe from it.') +
      h('😴', 'Staff', 'Tap a zombie to see its energy & stats. Working tires them; tired zombies rest. Set a job (Auto/Waiter/Cleaner/Rest) or Feed them toxin to refill.') +
      h('🧽', 'Clean', 'After customers eat, tables get dirty (flies!). Zombies bus them so new customers can sit.') +
      h('🔨', 'Build', 'Tap Build, then tap a table / stove / decoration and tap where to move it. Rearrange your whole cafe.') +
      h('🛒', 'Grow', 'Buy stoves, tables, staff and decor in the Shop. Decor sits on the floor and raises ambiance (faster, richer customers).') +
      '</div></div>');
  }

  var confirmCb = null;
  function confirm(msg, cb) {
    confirmCb = cb;
    openSheet('<div class="sheet"><h3>Confirm</h3><p class="hint">' + msg + '</p><div class="list"><div class="row" style="gap:10px;">' +
      '<button class="buy toxin" data-act="yes" style="flex:1;justify-content:center;">Yes</button>' +
      '<button class="buy" data-act="close" style="flex:1;justify-content:center;background:#2a3a2e;color:#cfe;">No</button></div></div></div>');
  }
  function rushConfirm(stoveId) {
    var st = world.stoves.filter(function (s) { return s.id === stoveId; })[0]; if (!st || !st.recipe) return;
    var r = recipeById(st.recipe), remain = (st.start + r.time) - world.t, cost = Math.max(1, Math.ceil(remain / 60));
    confirm('Rush ' + r.name + ' for ' + cost + ' ☣ toxin?', function () { world.rushCook(stoveId); });
  }
  function infectConfirm(cid) { confirm('Infect this customer for 2 ☣ toxin? They become a zombie worker.', function () { world.infect(cid); }); }

  // ---- delegated UI clicks -------------------------------------------
  document.addEventListener('click', function (e) {
    if (e.target.classList && e.target.classList.contains('overlay')) { closeSheet(); return; }
    var a = e.target.closest('[data-act]'); if (!a) return;
    var act = a.dataset.act;
    if (act === 'close') closeSheet();
    else if (act === 'cook') { world.startCook(a.dataset.stove, a.dataset.id); closeSheet(); }
    else if (act === 'buy') { world.buy(a.dataset.id); openShop(); }
    else if (act === 'raid') { world.startRaid(a.dataset.id); closeSheet(); }
    else if (act === 'yes') { var cb = confirmCb; confirmCb = null; closeSheet(); if (cb) cb(); }
    else if (act === 'open-shop') openShop();
    else if (act === 'shop-tab') openShop(a.dataset.id);
    else if (act === 'place-storage') { world.placeFromStorage(+a.dataset.id); openShop('Storage'); }
    else if (act === 'open-recipes') openRecipes();
    else if (act === 'open-map') openMap();
    else if (act === 'open-fridge') openFridge();
    else if (act === 'fridge-serve') { world.serveFromFridge(+a.dataset.id); openFridge(); }
    else if (act === 'fridge-unlock') { world.unlockFromFridge(+a.dataset.id); openFridge(); }
    else if (act === 'fridge-discard') { world.discardFridge(+a.dataset.id); openFridge(); }
    else if (act === 'open-roster') openRoster();
    else if (act === 'z-activate') { world.activateZombie(a.dataset.id); openRoster(); }
    else if (act === 'z-store') { world.storeZombie(a.dataset.id); openRoster(); }
    else if (act === 'z-rest') { world.restZombie(a.dataset.id); openRoster(); }
    else if (act === 'z-feed') { world.feedZombie(a.dataset.id); openRoster(); }
    else if (act === 'z-rename') { var nm = prompt('Rename zombie:'); if (nm) { world.renameZombie(a.dataset.id, nm); } openRoster(); }
    else if (act === 'buy-slot') { world.buySlot(); openRoster(); }
    else if (act === 'infect-do') { var id = a.dataset.id; closeSheet(); world.infect(id); }
    else if (act === 'open-help') openHelp();
    else if (act === 'open-build') setEdit(true);
    else if (act === 'build-done') setEdit(false);
    else if (act === 'build-store') { if (selected) { world.storeFurniture(selected.kind, selected.id); selected = null; buildBar(); toast('📦 Stored — find it in Store ▸ Storage'); } }
    else if (act === 'build-sell') { if (selected) { world.sellFurniture(selected.kind, selected.id); selected = null; buildBar(); } }
    else if (act === 'soon-tasks') toast('📋 Review Tasks arrive in a later update');
    else if (act === 'soon-pedia') toast('📚 The Zombiepedia is coming soon');
    else if (act === 'role') { world.setZombieRole(a.dataset.id, a.dataset.role); openZombie(a.dataset.id); }
    else if (act === 'feed') { world.feedZombie(a.dataset.id); openZombie(a.dataset.id); }
    else if (act === 'sel-info') { if (selZ) openZombie(selZ); }
    else if (act === 'sel-off') deselect();
    else if (act === 'toggle-auto') { world.auto = !world.auto; updateAutoBtn(); toast(world.auto ? '🤖 Auto on — zombies work on their own' : '👆 Auto off — tap a zombie, then a target'); }
    renderHUD();
  });

  // ---- init -----------------------------------------------------------
  function init() {
    canvas = el('game'); renderer = new window.Renderer(canvas);
    var existing = load(); if (!world) world = window.createWorld();
    window.addEventListener('resize', function () { renderer.resize(); });
    // tap handling on the canvas; ignore if a modal is open
    canvas.addEventListener('pointerdown', function (e) {
      if (el('modal-root').firstChild) return;
      onTap(e.clientX, e.clientY);
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(true); });
    window.__setWorld = function (nw) { world = nw; selZ = null; selected = null; editMode = false; deselect(); renderHUD(); };   // debug loader hook
    updateAutoBtn();
    if (!existing) setTimeout(openHelp, 450);
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
