// High & Low - Offline Service Worker
// Cache Name with versioning.md
const CACHE_NAME = 'high-and-low-v10';

// Static relative assets required for complete offline operation
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './style.css',
    './manifest.json',
    './sw.js',
    './favicon.ico',
    './favicon.png',
    './apple-touch-icon.png',
    './pwa-192x192.png',
    './pwa-512x512.png',
    './pwa-maskable-512x512.png',
    './icons/favicon.ico',
    './icons/favicon.png',
    './icons/apple-touch-icon.png',
    './icons/pwa-192x192.png',
    './icons/pwa-512x512.png',
    './icons/pwa-maskable-512x512.png',
    './js/main.js',
    './js/service-worker.js',
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
    './js/ui/question-view.js',
    './js/localization.js',
    './locales/manifest.json',
    './locales/en.json'
];

// Every language listed in locales/manifest.json is precached, so adding a translation needs no change here
async function listLocaleAssets() {
    try {
        const manifestUrl = new URL('./locales/manifest.json', self.registration.scope).toString();
        const response = await fetch(manifestUrl);
        if (!response.ok) return [];
        const manifest = await response.json();
        return (manifest.locales || []).map(({ code }) => `./locales/${code}.json`);
    } catch (error) {
        console.warn('Could not read locale manifest for precaching:', error);
        return [];
    }
}

// Install: precache application shell assets resolved against service worker scope
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            const localeAssets = await listLocaleAssets();
            const urlsToCache = [...new Set([...PRECACHE_ASSETS, ...localeAssets])]
                .map((asset) => new URL(asset, self.registration.scope).toString());
            await Promise.all(
                urlsToCache.map(async (url) => {
                    try {
                        const response = await fetch(url);
                        if (response.ok) {
                            await cache.put(url, response);
                        }
                    } catch (error) {
                        console.warn('Optional asset failed to precache:', url, error);
                    }
                })
            );
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

// Fetch: Network-First strategy with Cache fallback for seamless offline operation and instant updates
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(async (networkResponse) => {
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
            })
            .catch(async () => {
                const cachedResponse = await caches.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }
                if (event.request.headers.get('accept')?.includes('text/html')) {
                    const scopedIndexUrl = new URL('./index.html', self.registration.scope).toString();
                    return (await caches.match(scopedIndexUrl)) || (await caches.match('./index.html'));
                }
            })
    );
});