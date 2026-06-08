/* Service worker: cache the app shell so Zombie Cafe works offline / installs as a PWA. */
var CACHE = 'zombie-cafe-v1';
var ASSETS = [
  './', './index.html', './css/style.css',
  './js/data.js', './js/audio.js', './js/notify.js', './js/engine.js', './js/entities.js',
  './js/game.js', './js/raid.js', './js/scene.js', './js/ui.js', './js/main.js',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Cache-first for our shell, falling back to network.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        return caches.open(CACHE).then(function (c) { try { c.put(e.request, res.clone()); } catch (x) {} return res; });
      }).catch(function () { return caches.match('./index.html'); });
    })
  );
});
