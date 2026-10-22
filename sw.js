// Offline support: cache the app shell and all voice clips on install.
const VERSION = 'altitude-v5';
const SHELL = [
  './', 'index.html', 'css/style.css', 'js/app.js', 'js/program.js', 'js/script.js', 'js/audio.js', 'js/art.js', 'fonts/inter-latin.woff2',
  'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/logo.svg',
  'audio/voice/manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    const clips = await (await fetch('audio/voice/manifest.json')).json();
    await cache.addAll(Object.keys(clips).map((k) => `audio/voice/${k}.mp3`));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Network first for the app shell (so updates arrive), cache first for voice clips.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/audio/voice/') && url.pathname.endsWith('.mp3')) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
