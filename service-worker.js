const CACHE_NAME = 'contact-manager-cache-v1';
const urlsToCache = [
  '/',
  '/login',
  '/signup',
  '/contacts',
  '/addcontact',
  '/about',
  '/edit',
  '/logout',
  '/styles.css',   // List of all your CSS files
  '/scripts.js',    // List of all your JS files
  '/images/icon-192x192.png',   // Your icon files
  '/images/icon-512x512.png'
];

// Install Service Worker and cache necessary files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch the files from cache or network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
