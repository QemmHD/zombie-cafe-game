/*
 * notify.js — Optional iOS local notifications via Capacitor. No-ops on the
 * web (or if the plugin is missing), so it's completely safe everywhere.
 */
(function (ZC) {
  'use strict';

  function plugin() {
    return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) || null;
  }

  var requested = false;
  function ensurePermission() {
    var p = plugin(); if (!p || requested) return;
    requested = true;
    try { p.requestPermissions(); } catch (e) {}
  }

  // Remind the player a few hours after they leave.
  function schedule() {
    var p = plugin(); if (!p) return;
    try {
      p.schedule({
        notifications: [{
          id: 1001,
          title: 'Zombie Cafe',
          body: 'Your zombies miss you — the cafe has coins waiting! 🧟☕',
          schedule: { at: new Date(Date.now() + 3 * 60 * 60 * 1000) }
        }]
      });
    } catch (e) {}
  }

  function cancel() {
    var p = plugin(); if (!p) return;
    try { p.cancel({ notifications: [{ id: 1001 }] }); } catch (e) {}
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) schedule(); else cancel();
  });
  window.addEventListener('load', ensurePermission);

  ZC.notify = { schedule: schedule, cancel: cancel };

})(window.ZC || (window.ZC = {}));
