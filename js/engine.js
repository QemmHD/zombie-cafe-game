/*
 * engine.js — Helpers: math, isometric projection, input, procedural sprites.
 */
(function (ZC) {
  'use strict';
  var CONFIG = ZC.CONFIG;

  ZC.util = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    dist: function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); },
    rand: function (a, b) { return a + Math.random() * (b - a); },
    pick: function (arr) { return arr[(Math.random() * arr.length) | 0]; },
    id: (function () { var n = 1; return function () { return n++; }; })()
  };

  /* ----------------------------- Isometric ------------------------------- */
  // World units are tiles (floats). iso.project converts to screen pixels.
  var iso = ZC.iso = {
    ox: 0, oy: 0,
    setup: function () {
      this.ox = CONFIG.rows * (CONFIG.tileW / 2) + CONFIG.margin;
      this.oy = CONFIG.wallH + CONFIG.margin;
      this.width = (CONFIG.cols + CONFIG.rows) * (CONFIG.tileW / 2) + CONFIG.margin * 2;
      this.height = this.oy + (CONFIG.cols + CONFIG.rows) * (CONFIG.tileH / 2) + CONFIG.margin * 2.4;
    },
    project: function (wx, wy) {
      return {
        x: this.ox + (wx - wy) * (CONFIG.tileW / 2),
        y: this.oy + (wx + wy) * (CONFIG.tileH / 2)
      };
    },
    unproject: function (sx, sy) {
      var a = (sx - this.ox) / (CONFIG.tileW / 2);   // wx - wy
      var b = (sy - this.oy) / (CONFIG.tileH / 2);   // wx + wy
      return { wx: (a + b) / 2, wy: (b - a) / 2 };
    }
  };

  // Move entity in tile-space toward (tx,ty). Returns true on arrival.
  ZC.moveTo = function (e, tx, ty, speed, dt) {
    var dx = tx - e.wx, dy = ty - e.wy;
    var d = Math.sqrt(dx * dx + dy * dy);
    var step = speed * dt;
    if (d <= step || d === 0) { e.wx = tx; e.wy = ty; return true; }
    e.wx += (dx / d) * step;
    e.wy += (dy / d) * step;
    // facing from iso screen-x direction
    e.facing = ((dx - dy) < 0) ? -1 : 1;
    return false;
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  ZC.roundRect = roundRect;

  /* ----------------------------- Sprites --------------------------------- */
  var S = ZC.sprites = {};

  S.shadow = function (ctx, x, y, w) {
    ctx.save();
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, y + 2, w, w * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  // Zombie waiter
  S.zombie = function (ctx, x, y, opt) {
    opt = opt || {};
    var bob = Math.sin(opt.phase || 0) * 2.2;
    var face = opt.facing || 1;
    S.shadow(ctx, x, y, 13);
    ctx.save();
    ctx.translate(x, y - 2 + bob);
    // legs
    ctx.fillStyle = '#34502a';
    ctx.fillRect(-7, 6, 5, 11); ctx.fillRect(2, 6, 5, 11);
    // apron/body
    ctx.fillStyle = opt.resting ? '#54663f' : '#6aa84f';
    roundRect(ctx, -10, -12, 20, 21, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(18,28,12,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';      // little apron
    roundRect(ctx, -6, -2, 12, 11, 2); ctx.fill();
    // arms
    ctx.fillStyle = '#5e9445';
    ctx.fillRect(-13, -8, 4, 13); ctx.fillRect(9, -8, 4, 13);
    // head
    ctx.fillStyle = '#7cbf5e';
    roundRect(ctx, -8, -27, 16, 17, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(18,28,12,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#6aa84f';                       // ear
    ctx.fillRect(face > 0 ? 7 : -9, -21, 3, 5);
    // eyes
    ctx.fillStyle = opt.resting ? '#1d2a14' : '#fff';
    var ex = face > 0 ? 1 : -1;
    ctx.fillRect(-5 + ex, -22, 4, 4); ctx.fillRect(2 + ex, -22, 4, 4);
    if (!opt.resting) { ctx.fillStyle = '#c0392b'; ctx.fillRect(-4 + ex, -21, 2, 2); ctx.fillRect(3 + ex, -21, 2, 2); }
    // stitched mouth
    ctx.strokeStyle = '#2c3e1f'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-4, -13); ctx.lineTo(4, -13);
    ctx.moveTo(-2, -15); ctx.lineTo(-2, -11); ctx.moveTo(1, -15); ctx.lineTo(1, -11); ctx.stroke();
    // headgear
    if (opt.hat === 'hardhat') {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath(); ctx.ellipse(0, -27, 11, 4, 0, 0, Math.PI * 2); ctx.fill();   // brim
      ctx.beginPath(); ctx.moveTo(-8, -27); ctx.quadraticCurveTo(0, -38, 8, -27); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e0a90b'; ctx.fillRect(-1.5, -36, 3, 9);   // ridge
    } else if (opt.hat === 'bandana') {
      ctx.fillStyle = '#7b241c';
      ctx.beginPath(); ctx.moveTo(-8, -25); ctx.quadraticCurveTo(0, -31, 8, -25); ctx.lineTo(8, -22); ctx.lineTo(-8, -22); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; for (var d = -6; d < 8; d += 4) ctx.fillRect(d, -24, 1.5, 1.5);
    }
    // carried plate
    if (opt.carrying) {
      ctx.fillStyle = '#ecf0f1';
      ctx.beginPath(); ctx.ellipse(face * 13, -4, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
      if (opt.carryColor) { ctx.fillStyle = opt.carryColor; ctx.beginPath(); ctx.ellipse(face * 13, -5, 4, 3, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
    // energy bar
    if (opt.showEnergy) {
      var w = 22, e = ZC.util.clamp(opt.energy / 100, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - w / 2, y - 40, w, 4);
      ctx.fillStyle = e > 0.3 ? '#2ecc71' : '#e74c3c';
      ctx.fillRect(x - w / 2, y - 40, w * e, 4);
    }
  };

  // Downed zombie tombstone
  S.tombstone = function (ctx, x, y) {
    S.shadow(ctx, x, y, 14);
    ctx.fillStyle = '#8d99a6';
    roundRect(ctx, x - 11, y - 26, 22, 28, 10); ctx.fill();
    ctx.fillStyle = '#6c7a89'; ctx.font = 'bold 11px serif'; ctx.textAlign = 'center';
    ctx.fillText('RIP', x, y - 12);
    ctx.font = '11px serif'; ctx.fillText('🥩?', x, y - 30);
  };

  // Human customer
  S.customer = function (ctx, x, y, opt) {
    opt = opt || {};
    var bob = Math.sin(opt.phase || 0) * 2.2;
    if (opt.vip) {
      ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#f1c40f';
      ctx.beginPath(); ctx.arc(x, y - 12, 22, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    S.shadow(ctx, x, y, 12 * (opt.scale || 1));
    ctx.save();
    ctx.translate(x, y - 2 + bob);
    if (opt.scale && opt.scale !== 1) ctx.scale(opt.scale, opt.scale);
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-6, 6, 5, 11); ctx.fillRect(1, 6, 5, 11);
    ctx.fillStyle = opt.color || '#3498db';
    roundRect(ctx, -9, -12, 18, 21, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(10,14,20,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = opt.color || '#3498db';
    ctx.fillRect(-12, -8, 4, 12); ctx.fillRect(8, -8, 4, 12);
    ctx.fillStyle = '#f1c27d';
    roundRect(ctx, -7, -26, 14, 16, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,20,0.45)'; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.fillStyle = opt.hair || '#4a3728';
    roundRect(ctx, -7, -27, 14, 7, 3); ctx.fill();
    ctx.fillStyle = '#222';
    var ex = (opt.facing || 1) > 0 ? 1 : -1;
    ctx.fillRect(-4 + ex, -20, 2, 3); ctx.fillRect(3 + ex, -20, 2, 3);
    if (opt.type === 'biker') { // sunglasses + bandana
      ctx.fillStyle = '#111'; ctx.fillRect(-6 + ex, -20, 12, 3);
      ctx.fillStyle = '#7b241c'; ctx.fillRect(-7, -27, 14, 4);
    }
    if (opt.vip) { // little crown
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.moveTo(-6, -27); ctx.lineTo(-6, -32); ctx.lineTo(-3, -29); ctx.lineTo(0, -33);
      ctx.lineTo(3, -29); ctx.lineTo(6, -32); ctx.lineTo(6, -27); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };

  // Helper: draw an isometric box (table / appliance base)
  function isoBox(ctx, x, y, hw, hh, h, top, left, right) {
    // top face
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.moveTo(x, y - h - hh);
    ctx.lineTo(x + hw, y - h);
    ctx.lineTo(x, y - h + hh);
    ctx.lineTo(x - hw, y - h);
    ctx.closePath(); ctx.fill();
    // left face
    ctx.fillStyle = left;
    ctx.beginPath();
    ctx.moveTo(x - hw, y - h); ctx.lineTo(x, y - h + hh);
    ctx.lineTo(x, y + hh); ctx.lineTo(x - hw, y); ctx.closePath(); ctx.fill();
    // right face
    ctx.fillStyle = right;
    ctx.beginPath();
    ctx.moveTo(x + hw, y - h); ctx.lineTo(x, y - h + hh);
    ctx.lineTo(x, y + hh); ctx.lineTo(x + hw, y); ctx.closePath(); ctx.fill();
  }
  ZC.isoBox = isoBox;

  S.table = function (ctx, x, y, opt) {
    opt = opt || {};
    var hw = 24, hh = 12, h = 16, ty = y - h;
    S.shadow(ctx, x, y, 22);
    // legs
    ctx.strokeStyle = '#b9bec2'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - hw * 0.55, ty + hh * 0.4); ctx.lineTo(x - hw * 0.55, y + 6);
    ctx.moveTo(x + hw * 0.55, ty + hh * 0.4); ctx.lineTo(x + hw * 0.55, y + 6);
    ctx.stroke();
    // side thickness of the top
    ctx.fillStyle = '#c9301f';
    ctx.beginPath();
    ctx.moveTo(x - hw, ty); ctx.lineTo(x, ty + hh); ctx.lineTo(x + hw, ty);
    ctx.lineTo(x + hw, ty + 4); ctx.lineTo(x, ty + hh + 4); ctx.lineTo(x - hw, ty + 4);
    ctx.closePath(); ctx.fill();
    // checkered cloth top (red gingham)
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x, ty - hh); ctx.lineTo(x + hw, ty); ctx.lineTo(x, ty + hh); ctx.lineTo(x - hw, ty); ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#d23b2e'; ctx.fillRect(x - hw, ty - hh, hw * 2, hh * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2.4;
    var cd = [hw, hh], rd = [-hw, hh], t;
    for (t = -1; t <= 1.01; t += 0.5) {
      ctx.beginPath(); ctx.moveTo(x - cd[0] + t * rd[0], ty - cd[1] + t * rd[1]); ctx.lineTo(x + cd[0] + t * rd[0], ty + cd[1] + t * rd[1]); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + t * cd[0] - rd[0], ty + t * cd[1] - rd[1]); ctx.lineTo(x + t * cd[0] + rd[0], ty + t * cd[1] + rd[1]); ctx.stroke();
    }
    ctx.restore();
    // plate (+ food when served)
    ctx.fillStyle = '#f5f6f7';
    ctx.beginPath(); ctx.ellipse(x, ty, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#cdd2d6'; ctx.lineWidth = 1; ctx.stroke();
    if (opt.foodColor) {
      ctx.fillStyle = opt.foodColor;
      ctx.beginPath(); ctx.ellipse(x, ty - 1, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
    }
  };

  S.stove = function (ctx, x, y, opt) {
    opt = opt || {};
    var meta = (ZC.APPLIANCES && ZC.APPLIANCES[opt.type]) || { color: '#9aa4ad', dark: '#6c757d', light: '#828c95' };
    S.shadow(ctx, x, y, 20);
    isoBox(ctx, x, y, 22, 11, 22, meta.color, meta.dark, meta.light);
    // burners on top
    for (var i = -1; i <= 1; i += 2) {
      ctx.fillStyle = opt.cooking ? '#e67e22' : '#2f3a44';
      ctx.beginPath(); ctx.ellipse(x + i * 8, y - 22, 5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
      if (opt.cooking) { ctx.fillStyle = '#f39c12'; ctx.beginPath(); ctx.ellipse(x + i * 8, y - 22, 2.4, 1.3, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    if (opt.icon) { ctx.font = '13px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(opt.icon, x, y - 40); }
    if (opt.cooking) {
      var w = 30, p = ZC.util.clamp(opt.progress, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - w / 2, y - 50, w, 4);
      ctx.fillStyle = '#f1c40f'; ctx.fillRect(x - w / 2, y - 50, w * p, 4);
      // steam
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      var t = (opt.phase || 0);
      for (var s = 0; s < 3; s++) ctx.fillRect(x - 6 + s * 6, y - 30 - ((t * 10 + s * 7) % 14), 3, 5);
    }
  };

  S.decor = function (ctx, x, y, kind) {
    S.shadow(ctx, x, y, 12);
    if (kind === 'plant') {
      isoBox(ctx, x, y, 7, 3.5, 8, '#6d4c30', '#523a25', '#5e4129');
      ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.arc(x, y - 16, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(x - 4, y - 20, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(x + 3, y - 18, 2, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'lamp') {
      ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 26); ctx.stroke();
      ctx.fillStyle = '#f1c40f'; ctx.beginPath();
      ctx.moveTo(x - 11, y - 26); ctx.lineTo(x + 11, y - 26); ctx.lineTo(x, y - 42); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(241,196,15,0.18)'; ctx.beginPath(); ctx.arc(x, y - 22, 20, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'rug') {
      ctx.fillStyle = '#7b241c';
      ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 24, y); ctx.lineTo(x, y + 12); ctx.lineTo(x - 24, y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#a93226'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 16, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 16, y); ctx.closePath(); ctx.stroke();
    } else { // jukebox
      isoBox(ctx, x, y, 11, 5.5, 30, '#34495e', '#222f3a', '#2c3e50');
      ctx.fillStyle = '#e74c3c'; ctx.fillRect(x - 8, y - 26, 16, 6);
      ctx.fillStyle = '#f1c40f'; ctx.fillRect(x - 8, y - 18, 16, 8);
      ctx.fillStyle = '#1abc9c'; ctx.beginPath(); ctx.arc(x, y - 8, 4, 0, Math.PI * 2); ctx.fill();
      ctx.font = '11px serif'; ctx.textAlign = 'center'; ctx.fillText('♪', x - 14, y - 24);
    }
  };

  // A served plate waiting on the counter
  S.plate = function (ctx, x, y, color) {
    ctx.fillStyle = '#ecf0f1';
    ctx.beginPath(); ctx.ellipse(x, y, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color || '#bbb';
    ctx.beginPath(); ctx.ellipse(x, y - 1, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
  };

  S.bubble = function (ctx, x, y, patience, icon) {
    var bx = x + 16, by = y - 36;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(bx, by, 12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx - 8, by + 7); ctx.lineTo(bx - 15, by + 15); ctx.lineTo(bx - 2, by + 10); ctx.closePath(); ctx.fill();
    if (patience >= 0) {
      ctx.strokeStyle = patience > 0.4 ? '#2ecc71' : (patience > 0.18 ? '#f39c12' : '#e74c3c');
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(bx, by, 14, -Math.PI / 2, -Math.PI / 2 + patience * Math.PI * 2); ctx.stroke();
    }
    ctx.font = '13px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#222'; ctx.fillText(icon || '🍴', bx, by + 1);
  };

  // Selection ring under a directed zombie
  S.selectRing = function (ctx, x, y, phase) {
    var r = 16 + Math.sin(phase * 4) * 1.5;
    ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
  };

  S.floater = function (ctx, x, y, text, color, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = color; ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y); ctx.restore();
  };

})(window.ZC || (window.ZC = {}));
