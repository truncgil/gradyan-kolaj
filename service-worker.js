// Service Worker Versiyonu
const CACHE_VERSION = 'v1';
const CACHE_NAME = `grimwiz-${CACHE_VERSION}`;

// Önbelleğe alınacak dosyalar
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/translations.js',
  '/manifest.json',
  '/favicon.ico',
  '/icons/android-chrome-192x192.png',
  '/icons/android-chrome-512x512.png',
  '/icons/logo2.svg',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
  'https://code.getmdl.io/1.3.0/material.indigo-blue.min.css',
  'https://code.getmdl.io/1.3.0/material.min.js',
  'https://unpkg.com/konva@9.2.3/konva.min.js'
];

// Service Worker kurulurken çalışacak kodlar
self.addEventListener('install', event => {
  // Yükleme işlemi tamamlanana kadar bekleyin
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Önbellek oluşturuldu');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Önbellek oluşturma hatası:', error);
      })
  );
});

// Service Worker aktifleştiğinde çalışacak kodlar
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Eski önbellekleri temizle
          if (cacheName !== CACHE_NAME) {
            console.log('Eski önbellek siliniyor:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch olayını yakala ve önbellekten yanıt ver
self.addEventListener('fetch', event => {
  // Sadece GET isteklerini yakala
  if (event.request.method !== 'GET') return;

  // CDN veya API isteklerini filtrele
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin && 
      !url.hostname.includes('fonts.googleapis.com') && 
      !url.hostname.includes('fonts.gstatic.com') && 
      !url.hostname.includes('code.getmdl.io') &&
      !url.hostname.includes('unpkg.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Önbellekte varsa, önbellekten döndür
        if (response) {
          return response;
        }

        // Önbellekte yoksa, ağdan iste
        return fetch(event.request)
          .then(response => {
            // Geçerli bir yanıt değilse veya temel URL değilse önbelleğe ekleme
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Yanıtı önbelleğe ekle (klonlayarak, çünkü stream'ler bir kere okunabilir)
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(error => {
            // Ağ hatası varsa, önbellekte varsa bile offline sayfasını göster
            console.error('Ağ hatası:', error);
            
            // Resim isteği hatası varsa, varsayılan bir görüntü gösterilebilir
            if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
              return caches.match('/icons/offline-image.png');
            }
            
            // Diğer durumlarda offline sayfası veya hata sayfası gösterilebilir
            return caches.match('/offline.html');
          });
      })
  );
});

// Periyodik olarak içerik güncelleme
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-cache') {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then(cache => {
          return cache.addAll(urlsToCache);
        })
    );
  }
});

// Push bildirim işleme
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'Yeni bir bildirim var!',
      icon: '/icons/android-chrome-192x192.png',
      badge: '/icons/badge.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(
        data.title || 'Grimwiz',
        options
      )
    );
  }
});

// Bildirime tıklanma olayı
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
}); 