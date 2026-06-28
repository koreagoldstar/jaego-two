/* PWA install + basic offline fallback (network-first) */
const CACHE = 'jaego-pwa-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(['/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png']).catch(() => {})
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request)
      if (cached) return cached
      if (event.request.mode === 'navigate') {
        return new Response(
          '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>오프라인</title></head><body style="font-family:sans-serif;text-align:center;padding:2rem"><h1>인터넷 연결이 필요합니다</h1><p>Wi‑Fi 또는 데이터 연결 후 다시 시도해 주세요.</p></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
      }
      return Response.error()
    })
  )
})
