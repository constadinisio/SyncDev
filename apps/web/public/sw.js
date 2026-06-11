const CACHE_NAME = "syncdev-v1";
const STATIC_ASSETS = ["/", "/offline"];

// Install: cache critical assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip WebSocket and API requests
  if (url.pathname.startsWith("/api/") || url.protocol === "ws:" || url.protocol === "wss:") return;

  // For navigation requests, try network first
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/") || new Response("Offline")),
    );
    return;
  }

  // For static assets (JS, CSS, fonts, images), use stale-while-revalidate
  if (
    url.pathname.match(/\.(js|css|woff2?|ttf|png|svg|ico)$/) ||
    url.pathname.startsWith("/_next/")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
        return cached || networkFetch;
      }),
    );
    return;
  }
});
