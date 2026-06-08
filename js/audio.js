/*
 * audio.js — Tiny original WebAudio SFX (synthesized, no asset files).
 */
(function (ZC) {
  'use strict';
  var ctx = null, enabled = true;

  try { enabled = localStorage.getItem('zcMuted') !== '1'; } catch (e) {}

  function ac() {
    if (!ctx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Play a short tone. type: waveform, f0->f1 freq glide, dur seconds, vol.
  function tone(type, f0, f1, dur, vol) {
    if (!enabled) return;
    var a = ac(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, a.currentTime);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), a.currentTime + dur);
    g.gain.setValueAtTime(0.0001, a.currentTime);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, a.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + dur + 0.02);
  }

  ZC.sfx = {
    coin:   function () { tone('square', 880, 1320, 0.10, 0.10); setTimeout(function () { tone('square', 1320, 1760, 0.08, 0.08); }, 60); },
    serve:  function () { tone('triangle', 520, 660, 0.10, 0.10); },
    infect: function () { tone('sawtooth', 200, 70, 0.35, 0.12); },
    build:  function () { tone('square', 300, 520, 0.09, 0.10); },
    feed:   function () { tone('sine', 440, 700, 0.12, 0.10); },
    level:  function () { tone('square', 660, 990, 0.12, 0.12); setTimeout(function () { tone('square', 990, 1320, 0.14, 0.12); }, 110); },
    error:  function () { tone('sawtooth', 160, 110, 0.16, 0.10); },
    isEnabled: function () { return enabled; },
    toggle: function () {
      enabled = !enabled;
      try { localStorage.setItem('zcMuted', enabled ? '0' : '1'); } catch (e) {}
      if (enabled) this.feed();
      return enabled;
    }
  };

})(window.ZC || (window.ZC = {}));
