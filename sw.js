// Service worker: network-first with cache fallback, so new deploys show up
// immediately when online and everything still works offline.
const CACHE = 'pocket-apps-v1';
const SHELL = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.webmanifest',
  './projects.json',
  './icons/icon-180.png',
  './icons/icon-512.png',
];
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const network = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    const cached = await cache.match(req, { ignoreSearch: true });

    if (!cached) return network.catch(() => Response.error());

    // Prefer fresh content, but don't make the user wait on a slow connection.
    const timeout = new Promise(resolve => setTimeout(() => resolve(cached), NETWORK_TIMEOUT_MS));
    return Promise.race([network.catch(() => cached), timeout]);
  })());
});

// The launcher sends the full file list of all projects so they work offline.
self.addEventListener('message', event => {
  const msg = event.data;
  if (!msg || msg.type !== 'precache') return;
  const port = event.ports[0];

  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const marker = await cache.match('./__precached-version');
    if (marker && (await marker.text()) === msg.version) {
      port && port.postMessage({ ok: true });
      return;
    }
    let ok = true;
    await Promise.all(msg.urls.map(async url => {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (res.ok) await cache.put(url, res);
        else ok = false;
      } catch { ok = false; }
    }));
    if (ok) await cache.put('./__precached-version', new Response(msg.version));
    port && port.postMessage({ ok });
  })());
});
