// Service worker TEMPLATE. tools/build.py stamps 5856176d79 and ["./", "index.html", "manifest.json", "js/art.js", "js/sfx.js", "js/game.js", "assets/logo-600.webp", "assets/music/australis-frontier-remix.m4a", "assets/icons/apple-touch-icon.png", "assets/icons/favicon-32.png", "assets/icons/favicon-64.png", "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/icon-maskable-512.png"] into
// dist/web/sw.js; the dev copy of the game never registers this file.
const CACHE = 'reef-runner-5856176d79';
const SHELL = ["./", "index.html", "manifest.json", "js/art.js", "js/sfx.js", "js/game.js", "assets/logo-600.webp", "assets/music/australis-frontier-remix.m4a", "assets/icons/apple-touch-icon.png", "assets/icons/favicon-32.png", "assets/icons/favicon-64.png", "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/icon-maskable-512.png"];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

// Drop caches from older builds.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('reef-runner-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Cache first: once installed the game never needs the network.
// ignoreSearch so ?god and cache-busting queries still hit the cache offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
