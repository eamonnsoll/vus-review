// ── VUS SOL Review — Service Worker ─────────────────────────────────────────
// Cache-first strategy: serve from cache instantly, update in background.
// Version bump forces a cache refresh when you update the app.

const CACHE_NAME = 'vus-review-v6';

// All files this app needs to work offline
const ASSETS = [
  './VUS_Interactive_Review.html',
  './manifest.json',
];

// ── Install: cache all assets ────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing cache:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting()) // activate immediately
  );
});

// ── Activate: delete old caches ──────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating, clearing old caches');
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim()) // take control immediately
  );
});

// ── Fetch: cache-first with network fallback ─────────────────────────────────
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached version immediately if available
        if (cachedResponse) {
          // Fetch updated version in background for next visit
          fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(event.request, networkResponse));
              }
            })
            .catch(() => {}); // silently fail if offline
          return cachedResponse;
        }

        // Not in cache — try network
        return fetch(event.request)
          .then(networkResponse => {
            // Cache successful responses
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => {
            // Offline and not cached — return the main HTML as fallback
            if (event.request.destination === 'document') {
              return caches.match('./VUS_Interactive_Review.html');
            }
          });
      })
  );
});

// ── Background sync message from page ───────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
