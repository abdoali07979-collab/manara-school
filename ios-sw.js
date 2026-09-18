const CACHE='manara-ios-v670';
const FILES=[
  './ios-app.html?v=670',
  './ios-style.css?v=670',
  './ios-supabase.js?v=670',
  './ios-config.js?v=670',
  './ios-app.js?v=670',
  './ios-manifest.webmanifest?v=670',
  './logo.jpg?v=670',
  './apple-touch-icon.png?v=670',
  './icon-192.png?v=670',
  './icon-512.png?v=670'
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
