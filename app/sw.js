// MRO Daily Intelligence — Service Worker
// Handles offline caching for audio + pages

const CACHE_VERSION = 'mro-v1';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const AUDIO_CACHE   = `${CACHE_VERSION}-audio`;

// Core app shell — always cached on install
const APP_SHELL = [
  '/mro-news/app/',
  '/mro-news/app/index.html',
  '/mro-news/app/manifest.json',
  '/mro-news/app/icons/icon-192.png',
  '/mro-news/app/icons/icon-512.png',
];

// ── Install: cache app shell ────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ──────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('mro-') && k !== STATIC_CACHE && k !== AUDIO_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for audio, network-first for pages ───────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Audio files — cache on first play, serve from cache thereafter
  if (url.pathname.endsWith('.m4a') || url.pathname.endsWith('.mp3')) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // HTML / static assets — network first, fall back to cache
  if (event.request.mode === 'navigate' ||
      url.pathname.startsWith('/mro-news/app/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            caches.open(STATIC_CACHE)
              .then(cache => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
});
