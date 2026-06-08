/*
 * raid.js — Interactive raid mini-scene. Send your free zombies to storm a
 * rival cafe: they auto-attack, you tap to pile on extra damage, and you
 * collect loot (coins/flesh/toxin and captured humans) before the timer runs out.
 */
(function (ZC) {
  'use strict';
  var CONFIG = ZC.CONFIG, util = ZC.util, S = ZC.sprites;

  var RaidScene = ZC.RaidScene = {
    party: [], enemyHP: 0, enemyMax: 0, timer: 0, duration: 0,
    damageDone: 0, loot: null, finished: false, victory: false,
    sparks: [], shake: 0, _t: 0, btns: {},

    // Called from the Raid button. Sets up and switches to this scene.
    launch: function () {
      var G = ZC.Game;
      if (G.raid.cooldown > 0) { if (ZC.ui) ZC.ui.toast('Raid on cooldown (' + Math.ceil(G.raid.cooldown) + 's).'); return false; }
      var avail = [];
      for (var i = 0; i < G.zombies.length; i++) if (G.zombies[i].isAvailable()) avail.push(G.zombies[i]);
      if (avail.length === 0) { if (ZC.ui) ZC.ui.toast('No rested zombies free to raid!'); if (ZC.sfx) ZC.sfx.error(); return false; }
      this.party = avail.slice(0, 3);
      for (var k = 0; k < this.party.length; k++) {
        G.releaseTending(this.party[k]);
        if (this.party[k] === G.selectedZombie) G.deselect();
        this.party[k].state = 'raiding';
      }
      ZC.scenes.switchTo(this);
      return true;
    },

    enter: function () {
      var G = ZC.Game;
      if (ZC.ui) ZC.ui.setCafeChrome(false);
      this.enemyMax = 120 + G.level * 28 + Math.round(util.rand(0, 40));
      this.enemyHP = this.enemyMax;
      this.duration = CONFIG.raidDuration;
      this.timer = this.duration;
      this.damageDone = 0;
      this.finished = false; this.victory = false;
      this.loot = null; this.sparks = []; this.shake = 0; this._t = 0;
      this.partyPower = this.party.length * 7;   // auto damage per second
    },
    exit: function () { if (ZC.ui) ZC.ui.setCafeChrome(true); },

    update: function (dt) {
      this._t += dt;
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3);
      for (var i = this.sparks.length - 1; i >= 0; i--) {
        var s = this.sparks[i]; s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 120 * dt;
        if (s.life <= 0) this.sparks.splice(i, 1);
      }
      for (i = 0; i < this.party.length; i++) this.party[i].phase = (this.party[i].phase || 0) + dt * 12;
      if (this.finished) return;

      this.dealDamage(this.partyPower * dt, false);
      this.timer -= dt;
      if (this.enemyHP <= 0) { this.enemyHP = 0; this.finish(true); }
      else if (this.timer <= 0) { this.timer = 0; this.finish(false); }
    },

    dealDamage: function (amount, isTap) {
      if (this.finished || amount <= 0) return;
      var real = Math.min(amount, this.enemyHP);
      this.enemyHP -= real;
      this.damageDone += real;
      if (isTap) {
        this.shake = 1;
        var W = ZC.scenes.canvas.width;
        for (var i = 0; i < 6; i++) this.sparks.push({ x: W * 0.66, y: 150, vx: util.rand(-70, 70), vy: util.rand(-120, -20), life: 0.5, color: util.pick(['#f1c40f', '#e74c3c', '#fff']) });
        if (ZC.sfx) ZC.sfx.build();
      }
    },

    finish: function (victory) {
      this.finished = true; this.victory = victory;
      var G = ZC.Game, frac = util.clamp(this.damageDone / this.enemyMax, 0, 1);
      var coins = Math.round(this.enemyMax * 0.8 * frac) + (victory ? Math.round(this.enemyMax * 0.4) : 0);
      var flesh = Math.round((2 + G.level * 0.3) * frac) + (victory ? 2 : 0);
      var toxin = Math.round((1 + G.level * 0.2) * frac) + (victory ? 1 : 0);
      var captives = (victory && G.zombies.length < G.maxZombies() && Math.random() < 0.6) ? 1 : 0;
      this.loot = { coins: coins, flesh: flesh, toxin: toxin, captives: captives };
      if (ZC.sfx) ZC.sfx.coin();
    },

    // Collect loot and go home.
    collect: function () {
      var G = ZC.Game, l = this.loot || { coins: 0, flesh: 0, toxin: 0, captives: 0 };
      G.addCoins(l.coins); G.addFlesh(l.flesh); G.addToxin(l.toxin);
      // return party to the cafe
      for (var i = 0; i < this.party.length; i++) {
        var z = this.party[i];
        z.state = 'returning'; z.energy = Math.max(5, z.energy - 18);
        z.wx = G.kitchen.wx + 0.5; z.wy = G.kitchen.wy + 0.5;
      }
      for (var c = 0; c < l.captives; c++) {
        var nz = G.spawnZombie(G.kitchen.wx + 0.5, G.kitchen.wy + 0.8); nz.state = 'returning';
      }
      G.raid.cooldown = CONFIG.raidCooldown;
      G.stats.raids++;
      G.checkQuests();
      this.party = [];
      ZC.scenes.switchTo(ZC.CafeScene);
      if (ZC.ui) {
        ZC.ui.updateHUD();
        ZC.ui.toast('Raid loot: 🪙' + l.coins + ' 🥩' + l.flesh + ' 🧪' + l.toxin + (l.captives ? ' +' + l.captives + ' zombie!' : ''));
      }
    },

    /* ------------------------------ Render -------------------------------- */
    render: function (ctx) {
      var W = ZC.scenes.canvas.width, H = ZC.scenes.canvas.height;
      var sx = this.shake > 0 ? (Math.random() - 0.5) * 6 * this.shake : 0;
      var sy = this.shake > 0 ? (Math.random() - 0.5) * 6 * this.shake : 0;
      ctx.save(); ctx.translate(sx, sy);

      // dark street backdrop
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#1a1530'); g.addColorStop(1, '#0d0a18');
      ctx.fillStyle = g; ctx.fillRect(-6, -6, W + 12, H + 12);
      // moon
      ctx.fillStyle = '#cdd6e0'; ctx.beginPath(); ctx.arc(W * 0.2, 60, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1530'; ctx.beginPath(); ctx.arc(W * 0.2 + 10, 54, 24, 0, Math.PI * 2); ctx.fill();
      // ground
      ctx.fillStyle = '#241c33'; ctx.fillRect(0, H - 90, W, 90);

      // title
      ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('⚔️ RAID ON A RIVAL CAFE', W / 2, 30);

      // rival cafe building + boss
      this.drawRival(ctx, W * 0.66, H - 96);

      // enemy HP bar
      var bw = W * 0.5, bx = W * 0.5 - bw / 2, by = 48;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by, bw, 14);
      ctx.fillStyle = '#e74c3c'; ctx.fillRect(bx, by, bw * util.clamp(this.enemyHP / this.enemyMax, 0, 1), 14);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, 14);
      ctx.fillStyle = '#fff'; ctx.font = '11px system-ui';
      ctx.fillText('Rival defense', W / 2, by + 11);

      // your raiding party
      for (var i = 0; i < this.party.length; i++) {
        var zx = 60 + i * 36, zy = H - 96 + i * 6;
        S.zombie(ctx, zx, zy, { phase: this.party[i].phase || 0, facing: 1, energy: this.party[i].energy, showEnergy: false });
      }

      // sparks
      for (i = 0; i < this.sparks.length; i++) {
        var s = this.sparks[i]; ctx.globalAlpha = util.clamp(s.life / 0.5, 0, 1);
        ctx.fillStyle = s.color; ctx.fillRect(s.x, s.y, 3, 3); ctx.globalAlpha = 1;
      }

      // timer
      ctx.fillStyle = '#fff'; ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center';
      if (!this.finished) ctx.fillText('⏱ ' + Math.ceil(this.timer) + 's   —   TAP THE RIVAL TO ATTACK!', W / 2, H - 60);

      // buttons
      this.btns = {};
      if (this.finished) {
        this.panel(ctx, W, H);
      } else {
        this.button(ctx, 'retreat', 'Retreat', W / 2 - 55, H - 44, 110, 32, '#7f3a3a');
      }
      ctx.restore();
    },

    drawRival: function (ctx, x, y) {
      // building
      ctx.fillStyle = '#3a2f4a'; ctx.fillRect(x - 55, y - 110, 110, 110);
      ctx.fillStyle = '#2a2238'; ctx.fillRect(x - 55, y - 122, 110, 14);
      ctx.fillStyle = '#7b241c'; ctx.fillRect(x - 18, y - 40, 36, 40);  // door
      ctx.fillStyle = '#c0392b'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
      ctx.fillText("RIVAL CAFE", x, y - 96);
      // windows glow
      ctx.fillStyle = 'rgba(241,196,15,0.5)';
      ctx.fillRect(x - 42, y - 80, 20, 18); ctx.fillRect(x + 22, y - 80, 20, 18);
      // boss zombie guarding the door
      var bob = Math.sin(this._t * 3) * 2;
      ctx.save(); ctx.translate(x, y - 2 + bob); ctx.scale(1.5, 1.5);
      S.zombie(ctx, 0, 0, { phase: 0, facing: -1, resting: false, showEnergy: false, energy: 100 });
      ctx.restore();
    },

    button: function (ctx, id, label, x, y, w, h, color) {
      ctx.fillStyle = color; ZC.roundRect(ctx, x, y, w, h, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, x + w / 2, y + h / 2); ctx.textBaseline = 'alphabetic';
      this.btns[id] = { x: x, y: y, w: w, h: h };
    },

    panel: function (ctx, W, H) {
      var l = this.loot;
      ctx.fillStyle = 'rgba(0,0,0,0.78)'; ZC.roundRect(ctx, W / 2 - 130, H / 2 - 80, 260, 150, 14); ctx.fill();
      ctx.fillStyle = this.victory ? '#2ecc71' : '#f1c40f'; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(this.victory ? '🏆 VICTORY!' : '⏱ TIME UP', W / 2, H / 2 - 50);
      ctx.fillStyle = '#fff'; ctx.font = '14px system-ui';
      ctx.fillText('🪙 ' + l.coins + '    🥩 ' + l.flesh + '    🧪 ' + l.toxin, W / 2, H / 2 - 18);
      ctx.fillText(l.captives ? ('Captured ' + l.captives + ' new zombie!') : 'No captives this time', W / 2, H / 2 + 6);
      this.button(ctx, 'collect', '📥 Collect Loot', W / 2 - 80, H / 2 + 24, 160, 36, '#27ae60');
    },

    hit: function (id, x, y) {
      var b = this.btns[id]; return b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    },

    handleClick: function (sx, sy) {
      if (this.finished) {
        if (this.hit('collect', sx, sy)) this.collect();
        return;
      }
      if (this.hit('retreat', sx, sy)) { this.finish(false); return; }
      // any other tap = attack
      this.dealDamage(Math.max(4, ZC.Game.level * 0.8 + 4), true);
    },
    handleHover: function () {}
  };

})(window.ZC || (window.ZC = {}));
