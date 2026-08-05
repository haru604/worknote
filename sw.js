const CACHE = 'worknote-v5.0.0';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=5.0.0',
  './app.js?v=5.0.0',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const path of APP_SHELL) {
      try {
        const url = new URL(path, self.registration.scope);
        const response = await fetch(url, { cache: 'reload' });
        if (response.ok) await cache.put(url.href, response.clone());
      } catch (error) {
        console.warn('[WORKNOTE] cache skipped:', path, error);
      }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('worknote-') && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const scopeUrl = new URL(self.registration.scope);
  if (url.origin !== scopeUrl.origin || !url.pathname.startsWith(scopeUrl.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(new URL('./index.html', self.registration.scope).href, response.clone());
        }
        return response;
      } catch (error) {
        return (await caches.match(new URL('./index.html', self.registration.scope).href)) ||
               (await caches.match(new URL('./', self.registration.scope).href)) ||
               new Response('WORKNOTEをオフラインで起動できません。', {status: 503, headers: {'Content-Type':'text/plain; charset=utf-8'}});
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request, {ignoreSearch: false});
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      return new Response('', {status: 504});
    }
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
