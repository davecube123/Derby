// Derby Keep offline support: network first, cache as fallback.
// Its scope is /keep/, so it is separate from Derby's service worker.
const VERSION = '0.1.0'; // keep in sync with keep/js/version.js
const CACHE = `derby-keep-${VERSION}`;
const ASSETS = [
  './', './index.html', './css/keep.css', './manifest.webmanifest',
  './js/app.js', './js/db.js', './js/i18n.js', './js/install.js', './js/version.js', './js/constants.js',
  './js/conditioning.js', './js/chart.js', './js/derby-import.js',
  '../css/styles.css', '../js/genetics.js',
  '../icons/logo.png', '../icons/favicon-32.png', '../icons/icon-192.png', '../icons/icon-512.png',
  '../icons/icon-maskable-512.png', '../icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('derby-keep-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))),
  );
});
