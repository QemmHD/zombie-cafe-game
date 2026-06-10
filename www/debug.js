/* =====================================================================
 * Dev-only debug loader. Activated by URL hash:
 *   #demo=busy        -> load a deterministic demo scene into the live game
 *   #debug            -> show a floating menu of demo scenes + panel openers
 * Lets you eyeball every state in a real browser (incl. DOM panels the
 * node-canvas harness can't render). No-op unless the hash opts in.
 * ===================================================================== */
(function () {
  'use strict';
  function hash() { return (location.hash || '').replace(/^#/, ''); }
  function param(k) { var m = hash().match(new RegExp('(?:^|&)' + k + '=([^&]+)')); return m ? m[1] : null; }

  window.__DEBUG__ = {
    // re-create the world fresh and apply a named demo scene
    load: function (name) {
      try {
        var w = window.createWorld();
        if (window.applyDemo) window.applyDemo(w, name);
        window.__setWorld && window.__setWorld(w);
      } catch (e) { console.error('demo load failed', e); }
    },
  };

  function menu() {
    var panel = document.createElement('div');
    panel.id = 'debugmenu';
    panel.style.cssText = 'position:fixed;left:6px;bottom:80px;z-index:200;display:flex;flex-direction:column;gap:4px;max-height:60vh;overflow:auto;background:rgba(10,16,11,.95);border:1px solid #7cff5a;border-radius:10px;padding:8px;font:600 11px system-ui;color:#e6f3e7';
    var states = window.DEMO_LIST || [];
    var mk = function (label, fn) { var b = document.createElement('button'); b.textContent = label; b.style.cssText = 'background:#16201a;border:1px solid #294a32;color:#cfe;border-radius:6px;padding:5px 7px;text-align:left'; b.onclick = fn; return b; };
    panel.appendChild(mk('— scenes —', function () {}));
    states.forEach(function (s) { panel.appendChild(mk('▶ ' + s, function () { window.__DEBUG__.load(s); })); });
    panel.appendChild(mk('▦ toggle grid overlay', function () { window.__GRID__ = !window.__GRID__; }));
    panel.appendChild(mk('— panels —', function () {}));
    [['Store', 'open-shop'], ['Cookbook', 'open-recipes'], ['Staff', 'open-roster'], ['Fridge', 'open-fridge'], ['Raid', 'open-map'], ['Help', 'open-help']].forEach(function (p) {
      panel.appendChild(mk('▦ ' + p[0], function () { document.dispatchEvent(new MouseEvent('click')); var el = document.querySelector('[data-act="' + p[1] + '"]'); if (el) el.click(); }));
    });
    document.body.appendChild(panel);
  }

  function start() {
    var d = param('demo'); if (d) setTimeout(function () { window.__DEBUG__.load(d); }, 200);
    if (hash().indexOf('debug') >= 0) setTimeout(menu, 200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
