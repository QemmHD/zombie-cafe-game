/*
 * ui.js — DOM-based HUD, shop / build bar, recipe menu, toasts.
 */
(function (ZC) {
  'use strict';
  var G = ZC.Game, CONFIG = ZC.CONFIG;

  var ui = ZC.ui = {
    el: {},

    init: function () {
      this.el.coins = document.getElementById('stat-coins');
      this.el.toxin = document.getElementById('stat-toxin');
      this.el.flesh = document.getElementById('stat-flesh');
      this.el.level = document.getElementById('stat-level');
      this.el.xpbar = document.getElementById('xp-fill');
      this.el.zombies = document.getElementById('stat-zombies');
      this.el.toast = document.getElementById('toast');
      this.el.modeLabel = document.getElementById('mode-label');
      this.el.stoveMenu = document.getElementById('stove-menu');

      this.buildShopBar();
      this.bindButtons();
      this.updateHUD();
    },

    buildShopBar: function () {
      var bar = document.getElementById('shop-bar');
      var self = this;
      ZC.SHOP.forEach(function (item) {
        var b = document.createElement('button');
        b.className = 'shop-btn';
        b.innerHTML = '<span class="shop-name">' + item.name + '</span><span class="shop-cost">🪙 ' + item.cost + '</span>';
        b.title = item.desc;
        b.addEventListener('click', function () { self.setBuildMode(item.id, b); });
        b.dataset.shop = item.id;
        bar.appendChild(b);
      });
    },

    setBuildMode: function (shopId, btn) {
      // toggle off if already selected
      if (G.mode === 'build:' + shopId) { this.clearMode(); return; }
      G.mode = 'build:' + shopId;
      this.highlightActive(btn);
      var item = ZC.shopById(shopId);
      this.setModeLabel('Building: ' + item.name + ' — click a floor tile (ESC to cancel)');
    },

    bindButtons: function () {
      var self = this;
      document.getElementById('btn-infect').addEventListener('click', function () {
        if (G.mode === 'infect') { self.clearMode(); return; }
        G.mode = 'infect';
        self.highlightActive(this);
        self.setModeLabel('Infect mode: click a seated customer (costs ' + CONFIG.infectCost + ' toxin)');
      });
      document.getElementById('btn-raid').addEventListener('click', function () { G.startRaid(); });
      document.getElementById('btn-flesh').addEventListener('click', function () { G.buyFlesh(); });
      document.getElementById('btn-pause').addEventListener('click', function () {
        G.paused = !G.paused;
        this.textContent = G.paused ? '▶ Resume' : '⏸ Pause';
      });
      document.getElementById('btn-save').addEventListener('click', function () {
        G.save(); self.toast('Game saved.');
      });
      document.getElementById('btn-reset').addEventListener('click', function () {
        if (confirm('Start a brand new cafe? Your current save will be erased.')) { G.reset(); self.toast('New cafe started!'); }
      });
      document.getElementById('btn-help').addEventListener('click', function () {
        document.getElementById('help-modal').classList.toggle('hidden');
      });
      document.getElementById('help-close').addEventListener('click', function () {
        document.getElementById('help-modal').classList.add('hidden');
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { self.clearMode(); self.closeStoveMenu(); }
        if (e.key === ' ') { document.getElementById('btn-pause').click(); e.preventDefault(); }
      });
    },

    highlightActive: function (btn) {
      var btns = document.querySelectorAll('.shop-btn, .tool-btn');
      for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
      if (btn) btn.classList.add('active');
    },

    clearMode: function () {
      G.mode = 'none';
      this.highlightActive(null);
      this.setModeLabel('');
    },

    setModeLabel: function (txt) {
      this.el.modeLabel.textContent = txt;
      this.el.modeLabel.style.opacity = txt ? '1' : '0';
    },

    /* --------------------------- Stove recipe menu ------------------------ */
    openStoveMenu: function (stove) {
      var menu = this.el.stoveMenu;
      menu.innerHTML = '';
      var title = document.createElement('div');
      title.className = 'menu-title';
      title.textContent = 'Set Stove Recipe';
      menu.appendChild(title);

      var self = this;
      ZC.RECIPES.forEach(function (rec) {
        var locked = rec.unlockLevel > G.level;
        var row = document.createElement('button');
        row.className = 'recipe-row' + (locked ? ' locked' : '') + (stove.recipeId === rec.id ? ' selected' : '');
        row.innerHTML =
          '<span class="r-icon">' + rec.icon + '</span>' +
          '<span class="r-info"><b>' + rec.name + '</b><small>cost 🪙' + rec.cost + ' • ' + rec.servings + ' servings • sells 🪙' + rec.price + ' ea • ' + rec.cookTime + 's</small></span>' +
          (locked ? '<span class="r-lock">🔒 Lv ' + rec.unlockLevel + '</span>' : '');
        if (!locked) {
          row.addEventListener('click', function () {
            stove.recipeId = rec.id;
            self.toast(rec.name + ' set on this stove.');
            self.closeStoveMenu();
            G.save();
          });
        }
        menu.appendChild(row);
      });

      var close = document.createElement('button');
      close.className = 'menu-close';
      close.textContent = 'Close';
      close.addEventListener('click', function () { self.closeStoveMenu(); });
      menu.appendChild(close);

      menu.classList.remove('hidden');
    },

    closeStoveMenu: function () {
      if (this.el.stoveMenu) this.el.stoveMenu.classList.add('hidden');
    },

    /* ------------------------------- HUD ---------------------------------- */
    updateHUD: function () {
      if (!this.el.coins) return;
      this.el.coins.textContent = Math.floor(G.coins);
      this.el.toxin.textContent = Math.floor(G.toxin);
      this.el.flesh.textContent = Math.floor(G.flesh);
      this.el.level.textContent = G.level;
      this.el.zombies.textContent = G.zombies.length;
      var need = ZC.xpForLevel(G.level);
      this.el.xpbar.style.width = ZC.util.clamp(G.xp / need * 100, 0, 100) + '%';
    },

    _toastTimer: null,
    toast: function (msg) {
      var t = this.el.toast;
      if (!t) return;
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
    }
  };

})(window.ZC || (window.ZC = {}));
