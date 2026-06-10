/* =====================================================================
 * Zombie Cafe — glue: game loop, HUD, input, modals, persistence.
 * Ties the World simulation to the 2D Renderer, handles taps on the cafe,
 * the shop, the recipe picker, and the raid map (take over rival cafes).
 * ===================================================================== */
(function () {
  'use strict';
  var SAVE_KEY = 'zombiecafe.save.v2';
  var world, renderer, canvas, lastFrame = 0, lastSave = 0;

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
  function renderHUD() {
    var need = world.xpNeed(world.level), pct = Math.min(100, world.xp / need * 100);
    var raidNote = world.raid ? '<span class="raidpill">⚔️ ' + clock(world.raid.returnsAt - world.t) + '</span>' : '';
    el('hud').innerHTML =
      '<div class="stat coins"><span class="ico">🪙</span>' + fmt(world.coins) + '</div>' +
      '<div class="stat toxin"><span class="ico">☣️</span>' + fmt(world.toxin) + '</div>' +
      '<div class="level-wrap"><div class="level-row"><span>Lv <b>' + world.level + '</b></span>' + raidNote + '</div>' +
      '<div class="xpbar"><i style="width:' + pct + '%"></i></div></div>' +
      '<div class="stat zombies"><span class="ico">🧟</span>' + world.zombies.length + (world.raid ? '<small>+' + world.raid.squad + '</small>' : '') + '</div>';
  }

  // ---- FX -------------------------------------------------------------
  function toScreen(x, y) {
    var dpr = canvas.width / canvas.clientWidth;
    return { x: (x * renderer.scale + renderer.ox) / dpr, y: (y * renderer.scale + renderer.oy) / dpr };
  }
  function floatText(wx, wy, text, cls) {
    var p = toScreen(wx, wy), f = document.createElement('div');
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

  function drainEvents() {
    var evs = world.events; world.events = [];
    evs.forEach(function (e) {
      if (e.type === 'coin') { floatText(e.x, e.y - 30, '+' + fmt(e.amount), 'coin'); if (e.xp) floatText(e.x + 18, e.y - 12, '+' + e.xp + 'xp', 'xp'); }
      else if (e.type === 'level') levelBanner(e.level, e.newly, e.toxin);
      else if (e.type === 'warn') toast(e.msg);
      else if (e.type === 'bought') toast(e.item.emoji + ' ' + e.item.name + ' added!');
      else if (e.type === 'infect') { floatText(e.x, e.y - 30, '🧟 +1 staff', 'tox'); }
      else if (e.type === 'raidStart') toast('⚔️ Squad sent to raid ' + e.rival.name);
      else if (e.type === 'raidEnd') raidResult(e);
    });
  }

  // ---- loop -----------------------------------------------------------
  function frame(ts) {
    var dt = lastFrame ? (ts - lastFrame) / 1000 : 0; lastFrame = ts;
    world.tick(dt);
    drainEvents();
    renderer.draw(world, ts / 1000);
    renderHUD();
    save(false);
    requestAnimationFrame(frame);
  }

  // ---- input on the cafe ---------------------------------------------
  function onTap(clientX, clientY) {
    var w = renderer.toWorld(clientX, clientY);
    var hit = world.pickAt(w.x, w.y);
    if (!hit) return;
    if (hit.kind === 'stove') {
      var st = world.stoves.filter(function (s) { return s.id === hit.id; })[0];
      if (!st.recipe) openCook(st.id); else rushConfirm(st.id);
    } else if (hit.kind === 'customer') {
      if (hit.paying) world.collectCustomer(hit.id);
      else if (hit.infectable) infectConfirm(hit.id);
    }
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

  function openShop() {
    function section(title, items) {
      return '<div class="r-meta" style="margin:14px 2px 6px;font-size:13px;">' + title + '</div><div class="list">' + items.map(function (it) {
        var cost = world.priceFor(it), bag = it.cur, owned = it.kind === 'decor' && world.decor[it.id];
        var full = (it.kind === 'stove' && world.stoves.length >= 6) || (it.kind === 'table' && world.tables.length >= 16);
        var have = bag === 'coin' ? world.coins : world.toxin, aff = have >= cost && !owned && !full;
        var label = owned ? 'Owned' : full ? 'Max' : (bag === 'coin' ? '🪙 ' : '☣️ ') + fmt(cost);
        var note = it.kind === 'stove' ? ' · have ' + world.stoves.length : it.kind === 'table' ? ' · have ' + world.tables.length : it.kind === 'zombie' ? ' · have ' + world.zombies.length : '';
        return '<div class="row' + (aff || owned ? '' : ' locked') + '"><div class="r-ico">' + it.emoji + '</div><div class="r-body"><div class="r-name">' + it.name + note + '</div><div class="r-desc">' + it.desc + '</div></div>' +
          '<button class="buy ' + bag + '" data-act="buy" data-id="' + it.id + '"' + (aff ? '' : ' disabled') + '>' + label + '</button></div>';
      }).join('') + '</div>';
    }
    var b = (window.SHOP || []).filter(function (s) { return s.kind !== 'decor'; }), d = (window.SHOP || []).filter(function (s) { return s.kind === 'decor'; });
    openSheet('<div class="sheet">' + head('🛒 Shop') + '<p class="hint">Ambiance: <b>' + world.ambiance() + '</b> — higher means customers arrive faster and tip more.</p>' + section('🏗️ Expand', b) + section('🖼️ Decor', d) + '</div>');
  }

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
      '<div class="r-s">Your squad returns to work.</div>' +
      '<button class="buy coin" data-act="close" style="margin-top:14px;justify-content:center;width:100%;">Nice</button></div></div>');
  }

  function openHelp() {
    function h(i, n, b) { return '<div class="row"><div class="r-ico">' + i + '</div><div class="r-body"><div class="r-name">' + n + '</div><div class="r-desc">' + b + '</div></div></div>'; }
    openSheet('<div class="sheet">' + head('❓ How to play') + '<div class="list">' +
      h('🔪', 'Cook', 'Tap a stove in the kitchen, pick a dish. It cooks in real time, then lands on the pass counter.') +
      h('🧟', 'Serve', 'Your zombie staff walk dishes from the pass to seated customers automatically. More zombies = faster service.') +
      h('🪙', 'Collect', 'When a customer shows a coin, tap them to grab coins + XP.') +
      h('🧟‍♀️', 'Infect', 'Tap a customer with a green 🧟 bubble to spend toxin and turn them into a new zombie worker.') +
      h('⚔️', 'Raid', 'Open the Raid Map to send zombie squads to take over rival cafes for loot.') +
      h('🛒', 'Grow', 'Buy stoves, tables, staff and decor in the Shop. Decor raises ambiance (faster, richer customers).') +
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
    else if (act === 'open-recipes') openRecipes();
    else if (act === 'open-map') openMap();
    else if (act === 'open-help') openHelp();
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
    if (!existing) setTimeout(openHelp, 450);
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
