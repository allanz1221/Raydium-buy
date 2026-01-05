
const CACHE_NAME = 'raydium-pulse-v1';
const assets = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assets);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('push', function(event) {
  const options = {
    body: event.data.text(),
    icon: 'https://assets.coingecko.com/coins/images/15163/small/raydium.png',
    badge: 'https://assets.coingecko.com/coins/images/15163/small/raydium.png'
  };
  event.waitUntil(
    self.registration.showNotification('Raydium Pulse Alert', options)
  );
});
