/*
 * assets.js — Optional drop-in art system.
 *
 * Put PNG sprites in assets/art/ and the game uses them automatically; any
 * missing file falls back to the built-in procedural drawing. This lets you
 * supply professional artwork (your own, commissioned, or any pack you have
 * the rights to) without touching the code. See assets/art/README.md.
 */
(function (ZC) {
  'use strict';

  var BASE = 'assets/art/';

  // key -> { h: on-screen height in px (feet-anchored), dy: vertical nudge }
  var SPECS = {
    table:       { h: 46, dy: 0 },
    stove:       { h: 64, dy: 0 },
    grill:       { h: 64, dy: 0 },
    oven:        { h: 64, dy: 0 },
    zombie:      { h: 62, dy: 0 },
    customer:    { h: 60, dy: 0 },
    decor_plant: { h: 50, dy: 0 },
    decor_lamp:  { h: 64, dy: 0 },
    decor_rug:   { h: 26, dy: 0 },
    decor_juke:  { h: 66, dy: 0 }
  };

  var imgs = {};
  var art = ZC.art = { loadedCount: 0 };

  function load(key) {
    if (typeof Image === 'undefined') return;       // headless: skip
    var im = new Image();
    im.onload = function () {
      imgs[key] = im; art.loadedCount++;
      if (ZC.Game && ZC.Game.invalidateRoom) ZC.Game.invalidateRoom();
    };
    im.onerror = function () { /* no such file — keep procedural fallback */ };
    im.src = BASE + key + '.png';
  }

  art.init = function () { for (var k in SPECS) load(k); };
  art.has = function (k) { return !!imgs[k]; };

  // Draw sprite `key` feet-anchored at screen (x, y). Returns true if drawn.
  art.draw = function (ctx, key, x, y, scale) {
    var im = imgs[key]; if (!im) return false;
    var spec = SPECS[key] || { h: 56, dy: 0 };
    var h = spec.h * (scale || 1);
    var w = h * (im.width / im.height);
    ctx.drawImage(im, Math.round(x - w / 2), Math.round(y - h + (spec.dy || 0)), Math.round(w), Math.round(h));
    return true;
  };

})(window.ZC || (window.ZC = {}));
