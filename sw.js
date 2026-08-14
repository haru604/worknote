const CACHE = "worknote-v31.4";
const BASE = "/worknote/";
const APP_SHELL = [
  BASE,
  BASE + "index.html",
  BASE + "styles.css?v=31.4.0",
  BASE + "app.js?v=31.4.0",
  BASE + "manifest.json",
  BASE + "icon-192.png",
  BASE + "icon-512.png",
  BASE + "maskable-192.png",
  BASE + "maskable-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(APP_SHELL.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("worknote-") && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(BASE + "index.html", fresh.clone());
        }
        return fresh;
      } catch (_) {
        return (await caches.match(BASE + "index.html")) || (await caches.match(BASE)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    const networkPromise = fetch(request).then(async response => {
      if (response && response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    }).catch(() => null);
    return cached || await networkPromise || new Response("", {status: 504});
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = event.notification.data?.url || BASE;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({type:"window", includeUncontrolled:true});
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(target);
  })());
});
