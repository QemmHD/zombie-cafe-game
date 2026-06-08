/*
 * engine.js — Low level helpers: math, input, and procedural sprite drawing.
 */
(function (ZC) {
  'use strict';

  ZC.util = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    dist: function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); },
    rand: function (a, b) { return a + Math.random() * (b - a); },
    pick: function (arr) { return arr[(Math.random() * arr.length) | 0]; },
    id: (function () { var n = 1; return function () { return n++; }; })()
  };

  // Move an entity {x,y} toward a target by speed*dt. Returns true on arrival.
  ZC.moveToward = function (e, tx, ty, speed, dt) {
    var dx = tx - e.x, dy = ty - e.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    var step = speed * dt;
    if (d <= step || d === 0) { e.x = tx; e.y = ty; return true; }
    e.x += (dx / d) * step;
    e.y += (dy / d) * step;
    e.facing = dx < 0 ? -1 : 1;
    return false;
  };

  /* ----------------------------- Sprite drawing ---------------------------- */
  var S = ZC.sprites = {};

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

  // A shadow blob under characters
  S.shadow = function (ctx, x, y, w) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y + 14, w, w * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Zombie staff sprite. bob = walk animation phase, carrying = show a plate.
  S.zombie = function (ctx, x, y, opt) {
    opt = opt || {};
    var bob = Math.sin((opt.phase || 0)) * 2;
    var face = opt.facing || 1;
    S.shadow(ctx, x, y, 13);
    ctx.save();
    ctx.translate(x, y + bob);
    // legs
    ctx.fillStyle = '#3a5a2a';
    ctx.fillRect(-7, 6, 5, 10);
    ctx.fillRect(2, 6, 5, 10);
    // body (tattered shirt)
    ctx.fillStyle = opt.resting ? '#5b6e4a' : '#6aa84f';
    roundRect(ctx, -10, -10, 20, 20, 5); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(-10, 2, 20, 3);
    // arms
    ctx.fillStyle = '#5e9445';
    ctx.fillRect(-13, -6, 4, 12);
    ctx.fillRect(9, -6, 4, 12);
    // head
    ctx.fillStyle = '#7cbf5e';
    roundRect(ctx, -8, -24, 16, 16, 5); ctx.fill();
    // eyes
    ctx.fillStyle = opt.resting ? '#222' : '#fff';
    ctx.fillRect(-5 + (face > 0 ? 2 : 0), -19, 3, 3);
    ctx.fillRect(2 + (face > 0 ? 2 : 0), -19, 3, 3);
    if (!opt.resting) {
      ctx.fillStyle = '#a00';
      ctx.fillRect(-4 + (face > 0 ? 2 : 0), -18, 1, 1);
      ctx.fillRect(3 + (face > 0 ? 2 : 0), -18, 1, 1);
    }
    // mouth stitches
    ctx.strokeStyle = '#2c3e1f'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(4, -12); ctx.stroke();
    // carried plate
    if (opt.carrying) {
      ctx.fillStyle = '#ecf0f1';
      ctx.beginPath(); ctx.ellipse(face * 12, -2, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
      if (opt.carryColor) {
        ctx.fillStyle = opt.carryColor;
        ctx.beginPath(); ctx.ellipse(face * 12, -3, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
    // energy bar
    if (opt.showEnergy) {
      var w = 22, e = ZC.util.clamp(opt.energy / 100, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - w / 2, y - 34, w, 4);
      ctx.fillStyle = e > 0.3 ? '#2ecc71' : '#e74c3c';
      ctx.fillRect(x - w / 2, y - 34, w * e, 4);
    }
  };

  // Human customer sprite.
  S.customer = function (ctx, x, y, opt) {
    opt = opt || {};
    var bob = Math.sin((opt.phase || 0)) * 2;
    S.shadow(ctx, x, y, 12);
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-6, 6, 5, 10);
    ctx.fillRect(1, 6, 5, 10);
    ctx.fillStyle = opt.color || '#3498db';
    roundRect(ctx, -9, -10, 18, 20, 5); ctx.fill();
    ctx.fillStyle = opt.color || '#3498db';
    ctx.fillRect(-12, -6, 4, 11);
    ctx.fillRect(8, -6, 4, 11);
    // head (skin)
    ctx.fillStyle = '#f1c27d';
    roundRect(ctx, -7, -23, 14, 15, 5); ctx.fill();
    // hair
    ctx.fillStyle = opt.hair || '#4a3728';
    roundRect(ctx, -7, -24, 14, 6, 3); ctx.fill();
    // eyes
    ctx.fillStyle = '#222';
    ctx.fillRect(-4, -17, 2, 2);
    ctx.fillRect(2, -17, 2, 2);
    ctx.restore();
  };

  S.table = function (ctx, x, y, occupied) {
    S.shadow(ctx, x, y + 4, 18);
    // legs
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(x - 14, y + 2, 4, 10);
    ctx.fillRect(x + 10, y + 2, 4, 10);
    // top
    ctx.fillStyle = occupied ? '#8a5a2b' : '#9c6b3a';
    ctx.beginPath(); ctx.ellipse(x, y, 20, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath(); ctx.ellipse(x - 5, y - 3, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  };

  S.stove = function (ctx, x, y, opt) {
    opt = opt || {};
    S.shadow(ctx, x, y + 6, 18);
    ctx.fillStyle = '#7f8c8d';
    roundRect(ctx, x - 18, y - 16, 36, 30, 4); ctx.fill();
    ctx.fillStyle = '#95a5a6';
    roundRect(ctx, x - 18, y - 16, 36, 8, 4); ctx.fill();
    // burners
    for (var i = 0; i < 2; i++) {
      ctx.fillStyle = opt.cooking ? '#e67e22' : '#34495e';
      ctx.beginPath(); ctx.arc(x - 8 + i * 16, y, 6, 0, Math.PI * 2); ctx.fill();
      if (opt.cooking) {
        ctx.fillStyle = '#f39c12';
        ctx.beginPath(); ctx.arc(x - 8 + i * 16, y, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    // progress bar
    if (opt.cooking) {
      var w = 32, p = ZC.util.clamp(opt.progress, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - w / 2, y - 24, w, 4);
      ctx.fillStyle = '#f1c40f'; ctx.fillRect(x - w / 2, y - 24, w * p, 4);
    }
    // recipe icon label
    if (opt.icon) {
      ctx.font = '12px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(opt.icon, x, y - 30);
    }
  };

  S.decor = function (ctx, x, y, kind) {
    S.shadow(ctx, x, y + 6, 12);
    if (kind === 'plant') {
      ctx.fillStyle = '#5d4037'; ctx.fillRect(x - 7, y, 14, 12);
      ctx.fillStyle = '#27ae60';
      ctx.beginPath(); ctx.arc(x, y - 4, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c0392b';
      ctx.beginPath(); ctx.arc(x - 4, y - 6, 2, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'lamp') {
      ctx.fillStyle = '#34495e'; ctx.fillRect(x - 2, y - 4, 4, 16);
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath(); ctx.moveTo(x - 10, y - 4); ctx.lineTo(x + 10, y - 4); ctx.lineTo(x, y - 20); ctx.closePath(); ctx.fill();
    } else { // rug
      ctx.fillStyle = '#7b241c';
      roundRect(ctx, x - 18, y - 10, 36, 22, 4); ctx.fill();
      ctx.strokeStyle = '#a93226'; ctx.lineWidth = 2;
      roundRect(ctx, x - 14, y - 6, 28, 14, 3); ctx.stroke();
    }
  };

  // Thought / order bubble above a customer with a patience ring.
  S.bubble = function (ctx, x, y, patience, icon) {
    var bx = x + 14, by = y - 28;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(bx, by, 11, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx - 8, by + 6); ctx.lineTo(bx - 14, by + 14); ctx.lineTo(bx - 2, by + 9); ctx.closePath(); ctx.fill();
    // patience ring
    ctx.strokeStyle = patience > 0.4 ? '#2ecc71' : (patience > 0.18 ? '#f39c12' : '#e74c3c');
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(bx, by, 13, -Math.PI / 2, -Math.PI / 2 + patience * Math.PI * 2); ctx.stroke();
    ctx.font = '12px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#222';
    ctx.fillText(icon || '🍴', bx, by + 1);
  };

  // Floating "+coins" text
  S.floater = function (ctx, x, y, text, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
    ctx.restore();
  };

})(window.ZC || (window.ZC = {}));
