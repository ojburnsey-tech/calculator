const CACHE = 'graph-calc-v3';
const FILES = [
  './', './index.html', './app.css', './manifest.webmanifest',
  './icon-180.png', './icon-192.png', './icon-512.png',
  './vendor/math.js', './vendor/mathlive-static.css', './vendor/mathlive.min.mjs',
  './js/main.js', './js/parse.js', './js/engine.js', './js/exact.js',
  './js/stats.js', './js/data.js', './js/plot.js',
  './js/apps/calculate.js', './js/apps/equation.js', './js/apps/distribution.js',
  './js/apps/statistics.js', './js/apps/graph.js', './js/apps/matrix.js',
  './js/apps/basen.js', './js/apps/physics.js', './js/apps/recursion.js',
  './js/apps/conics.js', './js/apps/graph3d.js', './js/apps/financial.js',
  './js/apps/spreadsheet.js', './js/apps/geometry.js', './js/apps/stattests.js'
];

const freshRequest = path => new Request(new URL(path, self.registration.scope), { cache: 'reload' });

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // An updated worker must cache the new HTML, scripts, and styles together.
    await cache.addAll(FILES.map(freshRequest));
    const fonts = await fetch(freshRequest('./vendor/fonts/list.json'))
      .then(response => response.json()).catch(() => []);
    await Promise.allSettled(fonts.map(font => cache.add(freshRequest('./vendor/fonts/' + font))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('graph-calc-') && name !== CACHE)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone()).catch(() => {});
      return response;
    } catch {
      if (request.mode === 'navigate') return await cache.match('./index.html') || Response.error();
      return Response.error();
    }
  })());
});
