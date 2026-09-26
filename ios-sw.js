const CACHE='manara-ios-v6120';
const FILES=[
  './ios-app.html?v=6120',
  './ios-style.css?v=6120',
  './ios-supabase.js?v=6120',
  './ios-config.js?v=6120',
  './ios-app.js?v=6120',
  './ios-manifest.webmanifest?v=6120',
  './logo.jpg?v=6120',
  './apple-touch-icon.png?v=6120',
  './icon-192.png?v=6120',
  './icon-512.png?v=6120'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isAppAsset =
    url.pathname.endsWith('/ios-app.html') ||
    url.pathname.endsWith('/ios-app.js') ||
    url.pathname.endsWith('/ios-style.css') ||
    url.pathname.endsWith('/ios-config.js') ||
    url.pathname.endsWith('/ios-supabase.js');

  if (isAppAsset || event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
