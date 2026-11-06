// VerTech: pornește și fără internet. Pagina se ia întâi de pe net (4 s), altfel din memorie.
const CACHE = 'vertech-v1';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  const shell = r.mode === 'navigate' || /\/(index\.html|sw\.js)?$/.test(u.pathname);
  if (shell) {
    e.respondWith(new Promise(res => {
      let done = false;
      const fb = () => caches.match('index.html').then(m => { if (!done) { done = true; res(m || Response.error()); } });
      const t = setTimeout(fb, 4000);
      fetch(r).then(resp => { clearTimeout(t); if (done) return; done = true; if (resp.ok && r.mode === 'navigate') { const c = resp.clone(); caches.open(CACHE).then(ch => ch.put('index.html', c)); } res(resp); }).catch(() => { clearTimeout(t); fb(); });
    }));
    return;
  }
  e.respondWith(caches.match(r).then(m => m || fetch(r)));
});
