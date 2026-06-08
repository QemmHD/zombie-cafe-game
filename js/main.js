/*
 * main.js — Bootstraps the game and runs the requestAnimationFrame loop.
 */
(function (ZC) {
  'use strict';

  function boot() {
    var canvas = document.getElementById('game');
    ZC.Game.init(canvas);
    ZC.ui.init();

    var last = performance.now();
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000); // clamp big gaps (tab switch)
      last = now;
      ZC.Game._t = (ZC.Game._t || 0) + dt; // animation clock (steam, etc.)
      ZC.Game.update(dt);
      ZC.Game.render();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // Periodic HUD refresh (coins tick up smoothly via events, this is a safety net)
    setInterval(function () { ZC.ui.updateHUD(); }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window.ZC || (window.ZC = {}));
