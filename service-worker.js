// Önbellek (cache) ismi ve sürüm
const CACHE_NAME = 'gradyan-kolaj-v1';

// Önbelleğe alınacak dosyalar
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.json',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
  'https://code.getmdl.io/1.3.0/material.indigo-purple.min.css',
  'https://code.getmdl.io/1.3.0/material.min.js',
  'https://unpkg.com/konva@9.2.3/konva.min.js',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png'
];

// Service Worker yüklendiğinde
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Önbellek açıldı');
        return cache.addAll(urlsToCache);
      })
  );
});

// Ağ istekleri yakalandığında
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Eğer önbellekte varsa, önbellekten döndür
        if (response) {
          return response;
        }
        
        // Değilse, ağdan getir ve önbelleğe ekle
        return fetch(event.request).then(
          response => {
            // Geçersiz yanıt veya opaque yanıt ise önbelleğe ekleme
            if(!response || response.status !== 200 || response.type === 'opaque') {
              return response;
            }

            // Yanıtın bir kopyasını oluştur (stream olduğu için)
            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

// Yeni service worker aktifleştiğinde eski önbellekleri temizle
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
}); 