/*
 * main.js — App bootstrap: owns the canvas, routes input through the active
 * scene, and runs the requestAnimationFrame loop.
 */
(function (ZC) {
  'use strict';

  function boot() {
    var canvas = document.getElementById('game');
    var ctx = canvas.getContext('2d');

    ZC.iso.setup();
    canvas.width = Math.round(ZC.iso.width);
    canvas.height = Math.round(ZC.iso.height);

    ZC.scenes.canvas = canvas;
    ZC.scenes.ctx = ctx;

    ZC.Game.init(canvas);
    ZC.ui.init();

    bindInput(canvas);
    ZC.scenes.switchTo(ZC.CafeScene);

    var last = performance.now();
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000); // clamp big gaps (tab switch)
      last = now;
      var scene = ZC.scenes.current;
      if (scene) { scene.update(dt); scene.render(ctx); }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    setInterval(function () { if (ZC.ui) ZC.ui.updateHUD(); }, 500);
  }

  function bindInput(canvas) {
    function toCanvas(ev) {
      var rect = canvas.getBoundingClientRect();
      var sx = canvas.width / rect.width, sy = canvas.height / rect.height;
      var px = ev.clientX !== undefined ? ev.clientX : (ev.touches && ev.touches[0] && ev.touches[0].clientX);
      var py = ev.clientY !== undefined ? ev.clientY : (ev.touches && ev.touches[0] && ev.touches[0].clientY);
      return { x: (px - rect.left) * sx, y: (py - rect.top) * sy };
    }
    function tileAt(p) { var u = ZC.iso.unproject(p.x, p.y); return { col: Math.floor(u.wx), row: Math.floor(u.wy) }; }

    canvas.addEventListener('mousemove', function (ev) {
      var s = ZC.scenes.current; if (s && s.handleHover) { var p = toCanvas(ev); s.handleHover(tileAt(p), p.x, p.y); }
    });
    canvas.addEventListener('click', function (ev) {
      var s = ZC.scenes.current; if (s && s.handleClick) { var p = toCanvas(ev); s.handleClick(p.x, p.y, tileAt(p)); }
    });
    canvas.addEventListener('touchstart', function (ev) {
      ev.preventDefault();
      var s = ZC.scenes.current; if (!s) return;
      var p = toCanvas(ev); var t = tileAt(p);
      if (s.handleHover) s.handleHover(t, p.x, p.y);
      if (s.handleClick) s.handleClick(p.x, p.y, t);
    }, { passive: false });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window.ZC || (window.ZC = {}));
