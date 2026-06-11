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
  var ghost = null;                        // live placement preview {cell, ok, reason, stove}
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
    var bonus = world.bonusStars ? world.bonusStars() : 0;   // purple review stars
    if (bonus) out += '<span style="color:#b06bff">' + new Array(bonus + 1).join('✦') + '</span>';
    return out;
  }
  function renderHUD() {
    var need = world.xpNeed(world.level), pct = Math.min(100, world.xp / need * 100);
    var raidNote = world.battle ? '<span class="raidpill">⚔️ RAID!</span>' : '';
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
      else if (e.type === 'raidStart') toast('⚔️ Your squad lines up outside ' + e.rival.name + ' — tap a zombie to send it in!');
      else if (e.type === 'raidEnd') { raidResult(e); battleBar(); deselect(); }
      else if (e.type === 'hit') floatText(e.x, e.y - 36, '-' + e.n, e.enemy ? 'coin' : 'bad');
      else if (e.type === 'battleKill') floatText(e.x, e.y - 30, '+🪙' + e.coins, 'coin');
      else if (e.type === 'zombieDown') toast('💀 ' + e.name + ' was knocked out — reanimating in the Meat Locker');
      else if (e.type === 'deployed') toast('🧟 ' + e.name + ' charges in!');
      else if (e.type === 'energized') floatText(e.x, e.y - 40, '☣⚡', 'tox');
      else if (e.type === 'stole') { floatText(e.x, e.y - 30, '+' + e.n + ' ' + e.emoji, 'tox'); toast('🧊 Stole the food — it\'s in your fridge!'); }
      else if (e.type === 'sold') toast('💰 Sold for 🪙' + e.coins);
      else if (e.type === 'fridge') floatText(e.x, e.y - 30, '+' + e.n + ' ' + e.emoji, 'tox');
      else if (e.type === 'FoodBurned') { floatText(e.x, e.y - 30, '🔥 burnt!', 'bad'); toast('🔥 A dish burned — move finished food to the pass faster!'); }
      else if (e.type === 'ZombieScaredCustomer') { floatText(e.x, e.y - 20, '😱', 'bad'); toast('😱 A starving zombie scared a customer off! Feed your staff.'); }
      else if (e.type === 'ZombieDaydreaming') floatText(e.x, e.y - 40, '💭');
      else if (e.type === 'recipeUnlocked') toast('📖 New recipe unlocked: ' + e.recipe.emoji + ' ' + e.recipe.name);
      else if (e.type === 'zombieLevel') { floatText(e.x, e.y - 44, '⬆ Lv ' + e.level, 'xp'); toast('⬆ ' + e.name + ' reached level ' + e.level + ' — energy fully restored!'); }
      else if (e.type === 'reviewPassed') toast('📋 Review passed — ✦ purple bonus star earned! (' + e.stars + '/3)');
      else if (e.type === 'reviewDecay') toast('📋 A purple bonus star faded (' + e.stars + '/3 left)');
      else if (e.type === 'expanded') toast('📐 Café expanded to ' + e.cols + '×' + e.rows + ' — more floor to fill!');
      else if (e.type === 'ratingUp') { repFlash = 30; repFlashDir = 1; }
      else if (e.type === 'ratingDown') { repFlash = 30; repFlashDir = -1; }
    });
  }

  // ---- loop -----------------------------------------------------------
  function frame(ts) {
    var dt = lastFrame ? (ts - lastFrame) / 1000 : 0; lastFrame = ts;
    if (!editMode) world.tick(dt);        // freeze the sim while rearranging
    drainEvents();
    if (world.battle || el('battlebar')) battleBar();   // live battle status
    renderer.draw(world, ts / 1000, { edit: editMode, selected: selected, selZ: selZ, ghost: ghost, debugGrid: !!window.__GRID__ });
    renderHUD();
    save(false);
    requestAnimationFrame(frame);
  }

  // ---- input on the cafe: tap-command grammar --------------------------
  // tap zombie = select it; tap a valid target = command it; tap floor =
  // deselect. With nothing selected, taps fall through to context actions.
  function onTap(clientX, clientY) {
    var w = renderer.toWorld(clientX, clientY);
    if (world.battle) return onTapBattle(w);
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
      '<p class="hint">' + rar + ' zombie · Lv ' + (z.zlevel || 1) + ' (' + (z.zxp || 0) + '/' + world.zXpNeed(z.zlevel || 1) + 'xp) · doing: <b>' + (z.state === 'resting' ? 'resting' : z.role) + '</b></p>' +
      '<div class="ebar"><i style="width:' + Math.max(0, z.energy) + '%;background:' + ecol + '"></i></div>' +
      '<div class="zstats">' + stat('Energy', Math.round(z.energy) + '%') + stat('Speed', '×' + z.speed.toFixed(2)) + stat('Serve', '×' + z.serve.toFixed(2)) + stat('Clean', '×' + z.clean.toFixed(2)) + '</div>' +
      '<div class="r-meta" style="margin:12px 2px 6px;">Job</div><div class="rolerow">' + rb + '</div>' +
      '<button class="buy toxin" data-act="feed" data-id="' + zid + '" style="width:100%;justify-content:center;margin-top:12px;">☣️ Feed (1 toxin) — refill energy</button>' +
      '</div>');
  }
  // Build mode: tap a piece to lift it; live ghost shows green/red; tap a VALID
  // spot to drop it. Invalid spots are rejected with the reason.
  function updateGhost(clientX, clientY) {
    if (!editMode || !selected) { ghost = null; return; }
    var w = renderer.toWorld(clientX, clientY);
    var cell = selected.kind === 'stove' ? world.stoveSlotAt(w.x, w.y) : world.cellAt(w.x, w.y);
    var v = cell < 0 ? { ok: false, reason: 'Outside café' } : world.placementValidity(selected.kind, cell, selected.id);
    ghost = { cell: cell, stove: selected.kind === 'stove', ok: v.ok, reason: v.reason };
    buildBar();
  }
  function onTapEdit(w, clientX, clientY) {
    if (selected) {
      var cell = selected.kind === 'stove' ? world.stoveSlotAt(w.x, w.y) : world.cellAt(w.x, w.y);
      var v = cell < 0 ? { ok: false, reason: 'Outside café' } : world.placementValidity(selected.kind, cell, selected.id);
      if (cell >= 0 && v.ok) {
        var ok = selected.kind === 'stove' ? world.moveStove(selected.id, cell) : selected.kind === 'table' ? world.moveTable(selected.id, cell) : world.moveDecor(selected.id, cell);
        if (ok) { selected = null; ghost = null; buildBar(); checkLayout(); return; }
      } else if (cell >= 0) { toast('⛔ ' + (v.reason || 'Invalid spot')); }
      var p = world.pickFurnitureAt(w.x, w.y); if (p) { selected = p; } buildBar(); return;
    }
    selected = world.pickFurnitureAt(w.x, w.y); buildBar();
    if (!selected) toast('Tap a table, stove or decoration to move, store or sell it');
  }
  function buildBar() {
    var b = el('buildbar'); if (!b) return;
    if (selected) {
      var sellv = selected.kind === 'table' ? 40 : selected.kind === 'stove' ? 60 : ((shopItem((world.decors.filter(function (d) { return d.id === selected.id; })[0] || {}).deco) || {}).sell || 0);
      var status = ghost && ghost.cell >= 0 ? (ghost.ok ? '<b style="color:var(--toxic)">✓ valid spot</b>' : '<b style="color:var(--blood)">⛔ ' + (ghost.reason || 'invalid') + '</b>') : '✋ tap a spot to move';
      b.innerHTML = status + ' · ' +
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
    // grouped by BASE recipe; unlocked variants (Spicy/Fancy/Bulk...) appear as
    // chips under their base — each variant is its own cookable entry.
    var all = world.unlocked(), bases = all.filter(function (r) { return !r.base; });
    var rows = bases.map(function (r) {
      var aff = world.coins >= r.cost;
      var chips = all.filter(function (v) { return v.base === r.id; }).map(function (v) {
        var va = world.coins >= v.cost;
        return '<button class="vchip" data-act="cook" data-stove="' + stoveId + '" data-id="' + v.id + '"' + (va ? '' : ' disabled') + '>' + (v.tag || '✨') + ' ' + v.vname + ' 🪙' + v.cost + '</button>';
      }).join('');
      return '<div class="row' + (aff ? '' : ' locked') + '"><div class="r-ico">' + r.emoji + '</div>' +
        '<div class="r-body"><div class="r-name">' + r.name + '</div><div class="r-meta">⏱ ' + clock(r.time) + ' · makes <b>' + r.batch + '</b> · 🪙' + r.price + ' ea</div>' +
        (chips ? '<div class="vchips">' + chips + '</div>' : '') + '</div>' +
        '<button class="buy coin" data-act="cook" data-stove="' + stoveId + '" data-id="' + r.id + '"' + (aff ? '' : ' disabled') + '>🪙 ' + r.cost + '</button></div>';
    }).join('');
    var locked = (window.RECIPES || []).filter(function (r) { return !r.base && r.level > world.level; });
    if (locked.length) rows += '<div class="r-meta" style="margin:12px 2px;">🔒 ' + locked.slice(0, 3).map(function (r) { return r.emoji + ' ' + r.name + ' (Lv ' + r.level + ')'; }).join(' · ') + '</div>';
    openSheet('<div class="sheet">' + head('🔪 Cook a dish') + '<p class="hint">Pay ingredients now; it cooks in real time, then your zombies serve it. Variant dishes cost more but pay off in XP, coins, batch size or speed.</p><div class="list">' + rows + '</div></div>');
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
      if (shopTab === 'Utility') {
        // café expansion: buy the grass next door (cash or toxin, level-gated)
        var ex = world.nextExpansion();
        var exRow;
        if (!ex) exRow = '<div class="row"><div class="r-ico">📐</div><div class="r-body"><div class="r-name">Expand Café</div><div class="r-desc">Your café is at its largest — the whole corner lot is yours.</div></div></div>';
        else {
          var locked2 = world.level < ex.level;
          var sz = (world.colsNow() + 1) + '×' + (world.rowsNow() + 1);
          exRow = '<div class="row' + (locked2 ? ' locked' : '') + '"><div class="r-ico">📐</div><div class="r-body"><div class="r-name">Expand Café → ' + sz + '</div>' +
            '<div class="r-desc">' + (locked2 ? 'Unlocks at level ' + ex.level : 'Buy the grass next door — a bigger floor for tables, decor and staff.') + '</div></div>' +
            '<div class="zbtns"><button class="mini coin" data-act="expand-coin"' + (locked2 || world.coins < ex.coin ? ' disabled' : '') + '>🪙 ' + fmt(ex.coin) + '</button>' +
            (ex.toxin ? '<button class="mini toxin" data-act="expand-tox"' + (locked2 || world.toxin < ex.toxin ? ' disabled' : '') + '>☣ ' + ex.toxin + '</button>' : '') + '</div></div>';
        }
        body = body.slice(0, body.lastIndexOf('</div>')) + exRow + '</div>';
      }
    }
    openSheet('<div class="sheet">' + head('🛒 Store') + '<div class="tabs">' + tabs + '</div>' +
      '<p class="hint">Ambiance <b>' + world.ambiance() + '</b> · pieces sit on the floor — rearrange or sell them in 🔨 Build.</p>' + body + '</div>');
  }
  function shopItem(id) { return (window.SHOP || []).filter(function (s) { return s.id === id; })[0]; }

  function openRecipes() {
    var R = window.RECIPES || [];
    var rows = R.filter(function (r) { return !r.base; }).map(function (r) {
      var open = r.level <= world.level;
      var vars = R.filter(function (v) { return v.base === r.id; });
      var got = vars.filter(function (v) { return v.level <= world.level; });
      var next = vars.filter(function (v) { return v.level > world.level; }).sort(function (a, b) { return a.level - b.level; })[0];
      var vline = open ? ('Variants ' + got.length + '/' + vars.length +
        (got.length ? ' — ' + got.map(function (v) { return (v.tag || '') + v.vname; }).join(' · ') : '') +
        (next ? ' · 🔒 ' + next.vname + ' Lv' + next.level : '')) : '';
      return '<div class="row' + (open ? '' : ' locked') + '"><div class="r-ico">' + r.emoji + '</div><div class="r-body"><div class="r-name">' + r.name + (open ? '' : ' 🔒') + '</div>' +
        '<div class="r-meta">' + (open ? 'Lv ' + r.level + ' · 🪙' + r.cost + ' · ⏱ ' + clock(r.time) + ' · x' + r.batch + ' · 🪙' + r.price + ' ea' : 'Unlocks at level ' + r.level) + '</div>' +
        (vline ? '<div class="r-meta">' + vline + '</div>' : '') + '</div></div>';
    }).join('');
    openSheet('<div class="sheet">' + head('📖 Recipe Book') + '<div class="list">' + rows + '</div></div>');
  }

  function openMap() {
    var ready = world.activeZombies().filter(function (z) { return z.reanimateUntil <= world.t; }).length;
    var rows = (window.RIVALS || []).map(function (rv) {
      var locked = world.level < rv.level, can = world.canRaid(rv.id);
      var sub = locked ? 'Unlocks at level ' + rv.level : 'Chef HP ' + rv.defense + ' · best with ' + rv.squad + '+🧟 · loot 🪙' + fmt(rv.reward) + (rv.toxin ? ' +' + rv.toxin + '☣' : '');
      var btn = locked ? '<button class="buy" disabled>🔒</button>'
        : world.battle ? '<button class="buy" disabled>Busy</button>'
        : '<button class="buy ' + (can ? 'coin' : '') + '" data-act="raid" data-id="' + rv.id + '"' + (can ? '' : ' disabled') + '>' + (ready ? 'Raid' : 'No squad') + '</button>';
      return '<div class="row' + (locked ? ' locked' : '') + '"><div class="r-ico">' + rv.emoji + '</div><div class="r-body"><div class="r-name">' + rv.name + '</div><div class="r-meta">' + sub + '</div></div>' + btn + '</div>';
    }).join('');
    openSheet('<div class="sheet">' + head('⚔️ Raid Map') + '<p class="hint">Your squad lines up on the sidewalk — tap a zombie to send it in <b>one at a time</b>. Waiters are weak; the Head Chef is the boss. Tap the counter to steal food, ☣ Energize to heal mid-fight, 🏳️ to retreat.</p><div class="list">' + rows + '</div></div>');
  }
  function raidResult(e) {
    var w = e.win;
    openSheet('<div class="sheet"><div class="result ' + (w ? 'win' : 'lose') + '"><div class="r-big">' + (w ? '🏆' : e.retreated ? '🏳️' : '💀') + '</div>' +
      '<div class="r-t">' + (w ? 'Café conquered!' : e.retreated ? 'Retreated' : 'Squad wiped out') + '</div>' +
      '<div class="r-s">' + e.rival.emoji + ' ' + e.rival.name + '</div>' +
      '<div class="loot">+🪙' + fmt(e.loot) + (e.toxin ? ' +☣' + e.toxin : '') + '</div>' +
      (e.recipe ? '<div class="r-s" style="color:var(--toxic);margin-top:8px;">📖 Stole recipe: ' + e.recipe.emoji + ' ' + e.recipe.name + '!</div>' : '') +
      '<div class="r-s">' + (w ? 'Your squad returns to work.' : 'Downed zombies reanimate in the Meat Locker.') + '</div>' +
      '<button class="buy coin" data-act="close" style="margin-top:14px;justify-content:center;width:100%;">' + (w ? 'Nice' : 'Ugh') + '</button></div></div>');
  }
  // ---- battle mode: bar + tap grammar ---------------------------------
  function battleBar() {
    var b = el('battlebar'); if (!world.battle) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'battlebar'; b.className = 'buildbar'; document.body.appendChild(b); }
    var B = world.battle, rv = (window.RIVALS || []).filter(function (r) { return r.id === B.rival; })[0] || {};
    var staff = B.enemies.filter(function (e) { return e.kind !== 'patron' && e.hp > 0; }).length;
    b.innerHTML = '⚔️ <b>' + (rv.name || 'Raid') + '</b> · ' + B.lineup.length + '🧟 waiting · ' + B.inside.length + ' inside · ' + staff + ' defenders · 🪙' + B.loot.coins +
      ' <button class="mini coin" data-act="deploy-all">Send all</button>' +
      '<button class="mini" data-act="retreat">🏳️ Retreat</button>';
  }
  function battleSelBar(z) {
    var b = el('selbar'); if (b) b.remove();
    b = document.createElement('div'); b.id = 'selbar'; b.className = 'buildbar selbar';
    b.innerHTML = '🧟 <b>' + z.name + '</b> ' + Math.round(z.energy) + '/' + (z.maxEnergy || 100) + '⚡ — tap an enemy to ATTACK it' +
      '<button class="buy toxin" data-act="energize" data-id="' + z.id + '">☣ Energize</button>' +
      '<button class="buy coin" data-act="sel-info">Info</button>' +
      '<button class="buy" data-act="sel-off" style="background:#2a3a2e;color:#cfe;">✕</button>';
    document.body.appendChild(b);
  }
  function onTapBattle(w) {
    var B = world.battle;
    var z = world.pickZombieAt(w.x, w.y);
    if (z && B.lineup.indexOf(z.id) >= 0) {              // sidewalk: tap = send THIS one in
      world.deployZombie(z.id); selZ = z.id; battleSelBar(z); return;
    }
    if (z && B.inside.indexOf(z.id) >= 0) { selZ = z.id; battleSelBar(z); return; }
    var ct = world.pickCounterAt(w.x, w.y);
    if (ct) { world.lootCounter(ct.id); return; }
    if (selZ) {
      var en = world.pickEnemyAt(w.x, w.y);
      if (en) { world.setBattleTarget(selZ, en.id); toast('⚔️ Attacking the ' + en.name.toLowerCase()); return; }
    }
    deselect();
  }

  // ---- Review Board (level 6): 4 tasks -> purple bonus star ----------
  function openReview() {
    if (!world.reviewUnlocked()) { openSheet('<div class="sheet">' + head('📋 Review Board') + '<p class="hint">The food critics arrive at <b>café level 6</b>. Keep growing!</p></div>'); return; }
    var rv = world.review; if (!rv) { world.tick(0); rv = world.review; }
    var bonus = world.bonusStars();
    var rows = rv.tasks.map(function (t, i) {
      var done = t.done >= t.goal, pct = Math.min(100, t.done / t.goal * 100);
      return '<div class="row' + (done ? '' : '') + '"><div class="r-ico">' + (done ? '✅' : '📋') + '</div>' +
        '<div class="r-body"><div class="r-name">' + t.label + (t.bribed ? ' <span style="color:#b06bff">(bribed)</span>' : '') + '</div>' +
        '<div class="ebar"><i style="width:' + pct + '%;background:' + (done ? 'var(--toxic)' : 'var(--gold)') + '"></i></div>' +
        '<div class="r-meta">' + Math.min(t.done, t.goal) + ' / ' + t.goal + '</div></div>' +
        (done ? '' : '<button class="buy toxin" data-act="bribe" data-id="' + i + '"' + (world.toxin >= 2 ? '' : ' disabled') + '>☣ 2 Bribe</button>') + '</div>';
    }).join('');
    openSheet('<div class="sheet">' + head('📋 Review Board') +
      '<p class="hint">Complete all four tasks to earn a <span style="color:#b06bff">✦ purple bonus star</span> (max 3 — they fade over time). Stuck? Bribe the inspector: ☣ 2 per task.</p>' +
      '<div class="r-meta" style="margin:4px 2px 10px;">Bonus stars: <span style="color:#b06bff;font-size:16px;">' + (bonus ? new Array(bonus + 1).join('✦') : '—') + '</span></div>' +
      '<div class="list">' + rows + '</div></div>');
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
      '<div class="zsub">Lv ' + (z.zlevel || 1) + ' (' + (z.zxp || 0) + '/' + world.zXpNeed(z.zlevel || 1) + 'xp) · ' + (z.kind || 'Server') + (z.trait ? ' · ' + z.trait : '') + ' · ' + statePill + '</div></div>' +
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
    // per-type info card (like the original's customer cards): health cur/max
    // (= the zombie energy pool), tip/atk ratings on a 1-12 scale, flavor text.
    var cd = t.card || { tip: 2, spd: 3, str: 2, flavor: '' };
    openSheet('<div class="sheet">' + head('🧟‍♀️ Recruit a ' + t.name) +
      '<div class="cust-panel">' +
        '<div class="cust-col"><div class="r-meta">' + t.name + ' ' + rarTag(t.rarity) + '</div>' +
          kv('Health', z.maxEnergy + '/' + z.maxEnergy) +
          '<div class="ebar"><i style="width:100%;background:var(--toxic)"></i></div>' +
          kv('Tip Rating', cd.tip + '/12') + kv('Atk Speed', cd.spd + '/12') + kv('Atk Strength', cd.str + '/12') +
          kv('Mood', mood) + kv('Patience', (t.patience).toFixed(1) + '×') +
          (cd.flavor ? '<p class="hint" style="font-style:italic;margin:8px 2px 0;">“' + cd.flavor + '”</p>' : '') +
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
    else if (act === 'raid') { world.startRaid(a.dataset.id); closeSheet(); battleBar(); }
    else if (act === 'deploy-all') { world.deployAll(); battleBar(); }
    else if (act === 'expand-coin') { world.expandCafe(false); openShop('Utility'); }
    else if (act === 'expand-tox') { world.expandCafe(true); openShop('Utility'); }
    else if (act === 'retreat') { world.retreat(); deselect(); }
    else if (act === 'energize') { world.energizeZombie(a.dataset.id); var bz = world.zombies.filter(function (s) { return s.id === a.dataset.id; })[0]; if (bz) battleSelBar(bz); }
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
    else if (act === 'open-review') openReview();
    else if (act === 'bribe') { world.bribeTask(+a.dataset.id); openReview(); }
    else if (act === 'soon-pedia') toast('📚 The Zombiepedia is coming soon');
    else if (act === 'role') { world.setZombieRole(a.dataset.id, a.dataset.role); openZombie(a.dataset.id); }
    else if (act === 'feed') { world.feedZombie(a.dataset.id); openZombie(a.dataset.id); }
    else if (act === 'sel-info') { if (selZ) openZombie(selZ); }
    else if (act === 'sel-off') deselect();
    else if (act === 'toggle-auto') { world.auto = !world.auto; updateAutoBtn(); toast(world.auto ? '🤖 Auto on — zombies work on their own' : '👆 Auto off — tap a zombie, then a target'); }
    renderHUD();
  });

  // ---- runtime sprite layer (Stage 4.10B) -----------------------------
  // Fetch the baked-asset manifest and install each PNG into the renderer as it
  // loads; painters blit installed sprites and fall back procedurally otherwise.
  function loadSprites() {
    if (!window.fetch) return;
    fetch('assets/sprites/manifest.json').then(function (r) { return r.json(); }).then(function (mf) {
      var imgs = {}, pending = 0;
      Object.keys(mf.sprites || {}).forEach(function (id) {
        var e = mf.sprites[id]; if (!e || !e.file) return;
        pending++;
        var im = new Image();
        im.onload = function () { imgs[id] = im; renderer.useSprites(mf, imgs); if (--pending === 0) console.log('[sprites] installed', Object.keys(imgs).length); };
        im.onerror = function () { pending--; };
        im.src = e.file;
      });
    }).catch(function () { /* no manifest: procedural fallback */ });
  }

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
    // live placement ghost follows the finger/cursor while a piece is lifted
    canvas.addEventListener('pointermove', function (e) { if (editMode && selected && !el('modal-root').firstChild) updateGhost(e.clientX, e.clientY); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(true); });
    window.__setWorld = function (nw) { world = nw; selZ = null; selected = null; editMode = false; deselect(); renderHUD(); };   // debug loader hook
    loadSprites();                                       // runtime sprite layer (manifest -> images -> renderer)
    updateAutoBtn();
    if (!existing) setTimeout(openHelp, 450);
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
