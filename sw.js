/* Service worker Exambrowser.
 *
 * Kebijakan: berkas aplikasi diambil dari jaringan lebih dulu agar pembaruan
 * cepat sampai; ikon di-cache karena statis dan jarang berubah. Bila jaringan
 * putus, versi cache tetap dipakai agar ujian tidak berhenti di tengah jalan.
 */
const VERSION = 'exambrowser-v1';
const SHELL = 'shell-v1';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL).then(cache =>
      cache.addAll([
        'Exambrowser.html',
        'manifest.webmanifest',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/maskable-192.png',
        'icons/maskable-512.png',
        'icons/apple-touch-icon.png',
        'icons/favicon-32.png',
        'icons/favicon-16.png',
      ]).catch(() => {
        // Sebagian berkas boleh gagal — instalasi tidak boleh dibatalkan.
      })
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== SHELL && k.startsWith('exambrowser'))
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Hanya urus asal yang sama; lewati permintaan ke pihak lain.
  if (url.origin !== self.location.origin) return;

  const isShell =
    req.destination === 'document' ||
    url.pathname.endsWith('Exambrowser.html') ||
    url.pathname.endsWith('manifest.webmanifest');

  if (isShell) {
    // Network-first: jaringan dulu, cache sebagai cadangan.
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req, { ignoreSearch: true }).then(hit =>
            hit || caches.match('Exambrowser.html')
          )
        )
    );
    return;
  }

  // Aset statis: cache-first, lalu jaringan.
  event.respondWith(
    caches.match(req).then(
      hit =>
        hit ||
        fetch(req).then(res => {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
    )
  );
});
