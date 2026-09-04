// High & Low - Offline Service Worker
// Cache Name with versioning
const CACHE_NAME = 'high-and-low-v3';

// Static relative assets required for complete offline operation
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './style.css',
    './manifest.json',
    './favicon.ico',
    './favicon.png',
    './apple-touch-icon.png',
    './pwa-192x192.png',
    './pwa-512x512.png',
    './pwa-maskable-512x512.png',
    './js/main.js',
    './js/state.js',
    './js/utils.js',
    './js/questions.js',
    './js/checkin.js',
    './js/data-io.js',
    './js/storage/db.js',
    './js/storage/session.js',
    './js/ui/navigation.js',
    './js/ui/hold-actions.js',
    './js/ui/history-graph.js',
    './js/ui/dialogs.js',
    './js/ui/settings-menu.js',
    './js/ui/keyboard-navigation.js',
    './js/ui/question-authoring.js'
];

// Install: precache all critical application shell assets resolved against service worker scope
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            const urlsToCache = PRECACHE_ASSETS.map((asset) => new URL(asset, self.registration.scope).toString());
            return cache.addAll(urlsToCache);
        }).then(() => {
            return self.skipWaiting();
        })
    );
});

// Activate: delete outdated caches and claim clients immediately
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            const deletionPromises = cacheNames
                .filter((cacheName) => cacheName !== CACHE_NAME)
                .map((cacheName) => caches.delete(cacheName));
            return Promise.all(deletionPromises);
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// Fetch: Cache-First strategy with Network fallback for local assets
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then(async (networkResponse) => {
                // If valid response, clone and cache for offline access
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    try {
                        const cache = await caches.open(CACHE_NAME);
                        await cache.put(event.request, responseClone);
                    } catch (cacheError) {
                        console.warn('Failed to cache network response:', cacheError);
                    }
                }
                return networkResponse;
            }).catch(() => {
                // If network fails (offline) and HTML is requested, return cached index.html for current scope
                if (event.request.headers.get('accept')?.includes('text/html')) {
                    const scopedIndexUrl = new URL('./index.html', self.registration.scope).toString();
                    return caches.match(scopedIndexUrl).then((matchedIndex) => {
                        return matchedIndex || caches.match('./index.html') || caches.match('/index.html');
                    });
                }
            });
        })
    );
});
