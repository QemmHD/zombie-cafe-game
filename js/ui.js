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

      this.el.editBar = document.getElementById('edit-bar');
      this.el.editText = document.getElementById('edit-text');
      this.el.goalsBadge = document.getElementById('goals-badge');

      this.buildShopBar();
      this.bindButtons();
      this.updateHUD();
      this.refreshGoalsBadge();
      this.showAwayEarnings();
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
      G.deselect();
      G.mode = 'build:' + shopId;
      this.highlightActive(btn);
      var item = ZC.shopById(shopId);
      this.setModeLabel('Building: ' + item.name + ' — click a floor tile (ESC to cancel)');
    },

    bindButtons: function () {
      var self = this;
      document.getElementById('btn-infect').addEventListener('click', function () {
        if (G.mode === 'infect') { self.clearMode(); return; }
        G.deselect();
        G.mode = 'infect';
        self.highlightActive(this);
        self.setModeLabel('Infect mode: click a seated customer (costs ' + CONFIG.infectCost + ' toxin)');
      });
      document.getElementById('btn-edit').addEventListener('click', function () {
        if (G.mode === 'edit') { self.clearMode(); G.clearHeld(); self.refreshEditBar(); return; }
        G.deselect();
        G.mode = 'edit'; G.held = null;
        self.highlightActive(this);
        self.setModeLabel('Edit mode: tap furniture to pick it up, tap a tile to drop, or Sell');
        self.refreshEditBar();
      });
      document.getElementById('edit-sell').addEventListener('click', function () { G.sellHeld(); });
      document.getElementById('edit-done').addEventListener('click', function () { self.clearMode(); G.clearHeld(); self.refreshEditBar(); });

      var autoBtn = document.getElementById('btn-auto');
      autoBtn.textContent = G.autoServe ? '🤖 Auto: On' : '🤖 Auto: Off';
      autoBtn.classList.toggle('active', !G.autoServe);
      autoBtn.addEventListener('click', function () {
        G.autoServe = !G.autoServe;
        this.textContent = G.autoServe ? '🤖 Auto: On' : '🤖 Auto: Off';
        this.classList.toggle('active', !G.autoServe);
        self.toast(G.autoServe ? 'Auto-serve on — idle zombies serve by themselves.' : 'Auto-serve off — tap a zombie, then a customer, to serve.');
        G.save();
      });

      document.getElementById('btn-goals').addEventListener('click', function () { self.openGoals(); });
      document.getElementById('goals-close').addEventListener('click', function () { document.getElementById('goals-modal').classList.add('hidden'); });
      document.getElementById('away-close').addEventListener('click', function () { document.getElementById('away-modal').classList.add('hidden'); });

      document.getElementById('btn-raid').addEventListener('click', function () { G.startRaid(); });
      document.getElementById('btn-flesh').addEventListener('click', function () { G.buyFlesh(); });
      document.getElementById('btn-pause').addEventListener('click', function () {
        G.paused = !G.paused;
        this.textContent = G.paused ? '▶ Resume' : '⏸ Pause';
      });
      var soundBtn = document.getElementById('btn-sound');
      if (ZC.sfx) soundBtn.textContent = ZC.sfx.isEnabled() ? '🔊 Sound' : '🔇 Muted';
      soundBtn.addEventListener('click', function () {
        if (!ZC.sfx) return;
        var on = ZC.sfx.toggle();
        this.textContent = on ? '🔊 Sound' : '🔇 Muted';
        self.toast(on ? 'Sound on' : 'Sound muted');
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
      G.held = null;
      G.deselect();
      this.highlightActive(null);
      this.setModeLabel('');
      this.refreshEditBar();
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

    /* ---------------------------- Edit bar -------------------------------- */
    refreshEditBar: function () {
      var bar = this.el.editBar; if (!bar) return;
      if (G.mode !== 'edit') { bar.classList.add('hidden'); return; }
      bar.classList.remove('hidden');
      var sellBtn = document.getElementById('edit-sell');
      if (G.held) {
        var refund = Math.round(G.costOf(G.held) * ZC.CONFIG.refundRate);
        this.el.editText.textContent = 'Holding ' + (G.held.kind) + ' — drop on a tile';
        sellBtn.textContent = '🧺 Sell +' + refund;
        sellBtn.disabled = false; sellBtn.style.opacity = '1';
      } else {
        this.el.editText.textContent = 'Tap furniture to pick it up';
        sellBtn.textContent = '🧺 Sell';
        sellBtn.disabled = true; sellBtn.style.opacity = '0.4';
      }
    },

    /* ------------------------------ Goals --------------------------------- */
    refreshGoalsBadge: function () {
      var badge = this.el.goalsBadge; if (!badge) return;
      var ready = 0;
      for (var i = 0; i < ZC.QUESTS.length; i++) if (G.questReady(ZC.QUESTS[i])) ready++;
      if (ready > 0) { badge.textContent = ready; badge.classList.remove('hidden'); }
      else badge.classList.add('hidden');
    },

    openGoals: function () {
      var list = document.getElementById('goals-list');
      list.innerHTML = '';
      var self = this;
      ZC.QUESTS.forEach(function (q) {
        var prog = Math.min(q.progress(G), q.target);
        var claimed = !!G.questsClaimed[q.id];
        var ready = G.questReady(q);
        var row = document.createElement('div');
        row.className = 'goal-row' + (claimed ? ' done' : '');
        row.innerHTML =
          '<div class="goal-info"><b>' + q.name + '</b>' +
          '<div class="goal-bar"><div class="goal-fill" style="width:' + (prog / q.target * 100) + '%"></div></div>' +
          '<small>' + prog + ' / ' + q.target + ' · reward ' + G.rewardText(q.reward) + '</small></div>';
        var btn = document.createElement('button');
        btn.className = 'goal-claim';
        if (claimed) { btn.textContent = '✓ Claimed'; btn.disabled = true; }
        else if (ready) { btn.textContent = 'Claim'; btn.addEventListener('click', function () { G.claimQuest(q.id); self.openGoals(); }); }
        else { btn.textContent = 'Locked'; btn.disabled = true; btn.classList.add('locked'); }
        row.appendChild(btn);
        list.appendChild(row);
      });
      document.getElementById('goals-modal').classList.remove('hidden');
    },

    /* ----------------------- While you were away -------------------------- */
    showAwayEarnings: function () {
      if (!G.awayEarned || G.awayEarned <= 0) return;
      document.getElementById('away-text').textContent =
        'While you were away your zombies kept the cafe running and earned 🪙 ' + G.awayEarned + ' coins!';
      document.getElementById('away-close').textContent = 'Collect 🪙 ' + G.awayEarned;
      document.getElementById('away-modal').classList.remove('hidden');
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
