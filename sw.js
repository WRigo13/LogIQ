// LogIQ Service Worker
// Versão: atualizar este número sempre que mudar o app
const CACHE_NAME = 'logiq-v1';

// Arquivos para cache offline
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700;800&family=Inter:wght@400;500&display=swap',
];

// ── INSTALL: cachear todos os assets ──────────────────
self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando assets');
        // Cachear um a um para não falhar tudo se um asset não existir
        return Promise.allSettled(
          ASSETS.map(url => cache.add(url).catch(e => console.warn('[SW] Falhou:', url, e)))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpar caches antigos ───────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Ativando...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deletando cache antigo:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Cache-first para assets locais, network-first para externas ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignorar requests que não são GET
  if (event.request.method !== 'GET') return;

  // Ignorar extensões do browser e chrome-extension
  if (url.protocol === 'chrome-extension:') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Retorna do cache e atualiza em segundo plano
        const fetchPromise = fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              const cloned = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
            }
            return response;
          })
          .catch(() => {});
        return cached;
      }

      // Não está no cache: busca na rede
      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          // Cachear para uso futuro
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => {
          // Offline e não está em cache: retornar página principal
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
