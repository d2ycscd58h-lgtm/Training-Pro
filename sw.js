// Offline-Unterstützung: immer erst das Netz fragen (damit Updates sofort ankommen),
// ohne Netz die zuletzt gespeicherte Version nutzen.
const CACHE = 'trainingpro-v4';
const FILES = ['./app.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
    .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./app.html'))));
});
