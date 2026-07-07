/* A Better Me — service worker (app-shell offline cache) */
const CACHE = "abetterme-v2";
// versioned assets (styles.css?v / app.js?v) are runtime-cached network-first on first load
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.includes("/api/")) return; // never cache backend sync

  if (url.origin === location.origin) {
    // app shell: network-first so code updates land immediately, cache as offline fallback
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req))
    );
  } else {
    // cross-origin (fonts, etc.): cache-first
    e.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
  }
});
