/*
 * scene.js — Lightweight scene manager so the game can swap between the
 * cafe, the city map and the raid mini-scene. Each scene implements:
 *   enter(), exit(), update(dt), render(ctx), handleClick(sx,sy,tile), handleHover(tile,sx,sy)
 */
(function (ZC) {
  'use strict';

  ZC.scenes = {
    current: null,
    canvas: null,
    ctx: null,
    switchTo: function (scene, opts) {
      if (this.current && this.current.exit) this.current.exit();
      this.current = scene;
      if (scene && scene.enter) scene.enter(opts || {});
    }
  };

  // The main cafe scene simply delegates to the Game controller.
  ZC.CafeScene = {
    enter: function () { if (ZC.ui) ZC.ui.setCafeChrome(true); },
    exit: function () { if (ZC.ui) ZC.ui.setCafeChrome(false); },
    update: function (dt) { var G = ZC.Game; G._t = (G._t || 0) + dt; G.update(dt); },
    render: function (ctx) { ZC.Game.render(); },
    handleClick: function (sx, sy, tile) { ZC.Game.handleClick(sx, sy, tile); },
    handleHover: function (tile) { ZC.Game.hoverTile = tile; }
  };

})(window.ZC || (window.ZC = {}));
