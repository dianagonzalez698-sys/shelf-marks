/* Shelf Marks service worker — offline support for the app shell.
   Network-first on purpose: when you're online you always get the current
   version, and the cache is only a fallback when you're not. */

const VERSION = 'lit-picks-v19';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/ui.js',
  './js/state.js',
  './js/store.js',
  './js/rules.js',
  './js/config.js',
  './js/periods.js',
  './js/backup.js',
  './js/openlibrary.js',
  './js/view-home.js',
  './js/view-books.js',
  './js/view-book.js',
  './js/view-challenges.js',
  './js/view-bookmarks.js',
  './js/view-settings.js',
  './js/view-customize.js',
  './js/view-assets.js',
  './js/view-layout.js',
  './js/studio-nav.js',
  './js/theme.js',
  './js/assets.js',
  './js/media.js',
  './js/sections.js',
  './js/layout.js',
  './js/frames.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Open Library search and cover images go straight to the network.
  if (url.origin !== self.location.origin) return;

  // `fetch(request)` would go through the browser's HTTP cache, and GitHub
  // Pages sends a max-age — which is why a fresh deploy could still show the
  // old CSS until a manual hard-reload. `cache: 'reload'` skips that cache and
  // always revalidates against the network, so an ordinary reload is enough.
  // Offline, this rejects and we fall through to the cached copy below.
  event.respondWith(
    fetch(request.url, { cache: 'reload', credentials: 'same-origin' })
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })
        .then((hit) => hit || caches.match('./index.html'))),
  );
});
