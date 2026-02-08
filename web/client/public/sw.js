const CACHE_NAME = 'nyx-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', (event) => {
    // Network First for API and HTML
    if (event.request.url.includes('/api/') || event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                // If offline and navigating, return cached index if possible, or offline page
                return caches.match('/index.html');
            })
        );
        return;
    }

    // Cache First for other assets (JS, CSS, Images)
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});
