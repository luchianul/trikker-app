// Service worker: aplicația pornește și fără internet. Fișierele se păstrează în memorie; ce e nou se ia când ai internet.
const CACHE = 'pontaj-v1';
const FILES = ['./', 'index.html', 'px-api.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'lib/bootstrap.min.css', 'lib/bootstrap.bundle.min.js', 'lib/bootstrap-icons.css', 'lib/fonts/bootstrap-icons.woff2',
  'lib/inter.css', 'lib/fonts/inter-latin-wght-normal.woff2', 'lib/fonts/inter-latin-ext-wght-normal.woff2',
  'lib/sweetalert2.all.min.js', 'lib/confetti.browser.min.js', 'lib/animate.min.css'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;          // cererile către Google (POST) nu trec pe aici
  const isShell = r.mode === 'navigate' || /\/(index\.html|px-api\.js|sw\.js)?$/.test(u.pathname) || u.pathname.endsWith('px-api.js');
  if (isShell) {                                                            // pagina și adaptorul: întâi rețeaua (4 s), altfel memoria
    e.respondWith(new Promise(res => {
      let done = false;
      const fallback = () => caches.match(r.mode === 'navigate' ? 'index.html' : r, { ignoreSearch: true }).then(m => m || caches.match('index.html')).then(m => { if (!done) { done = true; res(m || Response.error()); } });
      const t = setTimeout(fallback, 4000);
      fetch(r).then(resp => { clearTimeout(t); if (done) return; done = true; if (resp.ok) { const c = resp.clone(); caches.open(CACHE).then(ch => ch.put(r.mode === 'navigate' ? 'index.html' : r, c)); } res(resp); }).catch(() => { clearTimeout(t); fallback(); });
    }));
    return;
  }
  e.respondWith(caches.match(r).then(m => m || fetch(r).then(resp => { if (resp.ok) { const c = resp.clone(); caches.open(CACHE).then(ch => ch.put(r, c)); } return resp; })));
});
