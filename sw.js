// sw.js — komplett ersetzen
// Cache-Version hier hochzählen, wenn du neue Deploys machst:
const CACHE = "routinepwa-v2";

const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Alte Caches löschen
    const keys = await caches.keys();
    await Promise.all(
      keys.map((key) => (key !== CACHE ? caches.delete(key) : null))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Nur GET-Anfragen cachen
  if (req.method !== "GET") return;

  // Für Navigation (Seitenaufrufe) immer index.html als Fallback (Offline)
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return (await caches.match("./index.html")) || Response.error();
      }
    })());
    return;
  }

  // Statisch: Cache-first, dann Network, dann fallback
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);

      // Nur same-origin Antworten in den Cache
      if (url.origin === location.origin) {
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch {
      // Optionales Fallback für Assets
      if (req.destination === "document") {
        return (await caches.match("./index.html")) || Response.error();
      }
      return Response.error();
    }
  })());
});
```0
