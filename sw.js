const CACHE = "routinepwa-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  e.respondWith(
    caches.match(req).then(res => res || fetch(req).then(net => {
      // optional runtime cache for same-origin GET
      if (req.method === "GET" && new URL(req.url).origin === location.origin) {
        const copy = net.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return net;
    }).catch(() => caches.match("./index.html")))
  );
});