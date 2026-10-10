/*
 * Bandstand's service worker: the app keeps working without signal, and
 * notifications arrive.
 *
 * - The app's code and icons (/_next/static, /icons, /help): kept once,
 *   served from here. They never change under the same address.
 * - Pages and the data behind them: fetched fresh when there's signal (a
 *   slow network gets 4 seconds), the saved copy when there isn't. Every
 *   page you open is saved, so a setlist you've opened -- and its
 *   performance mode, which loads the whole set -- works at a gig with no
 *   signal.
 * - Photos and band icons: the saved copy at once, refreshed behind.
 * - Signing out or switching band clears the saved pages.
 *
 * Registered with ?dev=1 by the dev server: then the app's code is never
 * kept, as it changes on every save.
 */

const VERSION = 'v1'
const STATIC = `static-${VERSION}`
const PAGES = 'pages'
const MEDIA = 'media'
const DEV = new URL(self.location.href).searchParams.has('dev')
const NETWORK_WAIT_MS = 4000

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys())
        if (k.startsWith('static-') && k !== STATIC) await caches.delete(k)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  const msg = event.data || {}
  // Signed out, or a different band: nothing of the last one stays
  if (msg.type === 'clear')
    event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(MEDIA)]))
  // Save pages ahead of time (a setlist's performance mode)
  if (msg.type === 'save' && Array.isArray(msg.urls))
    event.waitUntil(
      (async () => {
        const cache = await caches.open(PAGES)
        const code = await caches.open(STATIC)
        let saved = 0
        for (const url of msg.urls) {
          try {
            const res = await fetch(url, {credentials: 'same-origin'})
            if (!keepable(res)) continue
            const html = await res.clone().text()
            await cache.put(url, res)
            saved++
            // And the code that page runs on, or it can't work offline
            if (DEV) continue
            for (const m of html.matchAll(
              /\/_next\/static\/[^"'\s)]+\.(?:js|css)/g,
            ))
              if (!(await code.match(m[0]))) {
                const r = await fetch(m[0])
                if (r.ok) await code.put(m[0], r)
              }
          } catch {}
        }
        // Tell the page how it went: it says "Saved" only when it was
        event.ports[0]?.postMessage({saved, total: msg.urls.length})
      })(),
    )
})

/** Only real pages: not errors, not a bounce to the sign-in page. */
function keepable(res) {
  return res && res.ok && !res.redirected && res.type === 'basic'
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  const path = url.pathname
  // Never saved: sign-in, calendar feeds, the "anything new?" check, PDFs,
  // the service worker itself
  if (
    path.startsWith('/api/auth') ||
    path.startsWith('/api/calendar') ||
    path === '/api/changes' ||
    path.endsWith('/pdf') ||
    path === '/sw.js' ||
    path.startsWith('/_next/webpack-hmr')
  )
    return

  if (
    path.startsWith('/_next/static/') ||
    path.startsWith('/icons/') ||
    path.startsWith('/help/')
  ) {
    if (DEV && path.startsWith('/_next/')) return
    event.respondWith(cacheFirst(req, STATIC))
    return
  }
  if (
    path.startsWith('/api/avatars/') ||
    /^\/api\/bands?\/[^/]+\/icon/.test(path) ||
    path.startsWith('/api/band/icon')
  ) {
    event.respondWith(staleWhileRevalidate(req, MEDIA))
    return
  }
  // Pages, the data the app fetches for them (RSC), and GET APIs
  if (
    req.mode === 'navigate' ||
    url.searchParams.has('_rsc') ||
    req.headers.get('RSC') === '1' ||
    path.startsWith('/api/') ||
    path === '/manifest.webmanifest'
  ) {
    event.respondWith(networkFirst(req, event))
  }
})

async function cacheFirst(req, name) {
  const cache = await caches.open(name)
  // The file's path is its identity (the dev server adds ?v=… to them)
  const hit = await cache.match(req, {ignoreSearch: true})
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) cache.put(req, res.clone())
  return res
}

async function staleWhileRevalidate(req, name) {
  const cache = await caches.open(name)
  const hit = await cache.match(req)
  const fresh = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone())
      return res
    })
    .catch(() => hit)
  return hit || fresh
}

async function networkFirst(req, event) {
  const cache = await caches.open(PAGES)
  const network = fetch(req).then((res) => {
    if (keepable(res)) event.waitUntil(cache.put(req, res.clone()))
    return res
  })
  // Failing after the saved copy was shown is fine
  network.catch(() => {})
  // A slow network: the saved copy after a few seconds (the fresh one is
  // still saved for next time when it arrives)
  const timeout = new Promise((resolve) =>
    setTimeout(
      async () => resolve(await cache.match(req, {ignoreVary: true})),
      NETWORK_WAIT_MS,
    ),
  )
  try {
    const first = await Promise.race([network, timeout])
    if (first) return first
    return await network
  } catch {
    const saved = await cache.match(req, {ignoreVary: true})
    if (saved) return saved
    if (req.mode === 'navigate') return offlinePage()
    return new Response(JSON.stringify({error: 'offline'}), {
      status: 503,
      headers: {'Content-Type': 'application/json'},
    })
  }
}

function offlinePage() {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline</title>
<style>body{font:17px/1.5 system-ui,sans-serif;background:#111;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center}a{color:#f5b942}</style>
<div><h1>No signal</h1><p>This page hasn’t been opened on this device yet, so there’s no saved copy.</p>
<p>Pages you’ve opened before still work — <a href="/songs">the songs</a>, and any setlist you’ve opened, performance mode included.</p></div>`,
    {status: 503, headers: {'Content-Type': 'text/html; charset=utf-8'}},
  )
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  let msg = {}
  try {
    msg = event.data ? event.data.json() : {}
  } catch {
    msg = {body: event.data ? event.data.text() : ''}
  }
  event.waitUntil(
    self.registration.showNotification(msg.title || 'Bandstand', {
      body: msg.body || '',
      icon: msg.icon || '/icons/default-192.png',
      badge: '/icons/default-192.png',
      tag: msg.tag,
      renotify: Boolean(msg.tag),
      data: {url: msg.url || '/songs'},
    }),
  )
})

// Tapping one opens what it's about, in the app if it's already open
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(
    event.notification.data?.url || '/songs',
    self.location.origin,
  ).href
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const w of wins) {
        if ('focus' in w) {
          await w.focus()
          if ('navigate' in w) return w.navigate(url)
          return
        }
      }
      return self.clients.openWindow(url)
    })(),
  )
})

// The browser replaced this device's subscription: tell the server
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const keyRes = await fetch('/api/push/key')
      const {key} = await keyRes.json()
      if (!key) return
      const sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: fromBase64Url(key),
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(sub.toJSON()),
      })
    })(),
  )
})

function fromBase64Url(s) {
  const b64 = (s + '='.repeat((4 - (s.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}
