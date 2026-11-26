// Vocalize service worker — minimal offline cache for the PWA shell.
const CACHE = 'vocalize-v1'
const APP_ROOT = self.registration.scope
const APP_SHELL = ['', 'index.html', 'manifest.webmanifest', 'favicon.svg'].map((path) =>
  new URL(path, APP_ROOT).href
)

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, clone))
        return res
      })
      .catch(() =>
        caches.match(e.request, { ignoreSearch: true }).then((m) => m || caches.match(new URL('index.html', APP_ROOT).href))
      )
  )
})
