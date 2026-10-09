'use client'

/**
 * The app as an app: the service worker (offline pages, notifications),
 * whether it's been added to the home screen, the browser's own "Install"
 * offer, and turning notifications on and off for this device.
 */

/** Running from the home screen (or as an installed desktop app). */
export function isInstalled() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & {standalone?: boolean}).standalone === true
  )
}

export type Platform = 'ios' | 'android' | 'desktop'

export function platform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent
  // iPadOS says it's a Mac; it's the one with a touchscreen
  if (
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  )
    return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

/** "iPhone", "iPad", "Android", "Mac"…: so Account can name each device. */
export function deviceName() {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1))
    return 'iPad'
  if (/Android/.test(ua))
    return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet'
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Linux/.test(ua)) return 'Linux'
  return 'This device'
}

/** This browser can show notifications at all (iPhone: only as an app). */
export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  const dev = process.env.NODE_ENV !== 'production'
  // The dev server only when asked: localStorage ms:sw-dev = "1" (pages
  // only; its code changes on every save) or "full" (as in production, to
  // try offline performance mode)
  let devMode: string | null = null
  try {
    devMode = localStorage.getItem('ms:sw-dev')
  } catch {}
  if (dev && !devMode) return
  const url = dev && devMode !== 'full' ? '/sw.js?dev=1' : '/sw.js'
  navigator.serviceWorker.register(url).catch(() => {})
}

/** Forget every saved page and photo (signing out, switching band). */
export async function clearSaved() {
  try {
    await Promise.all([caches.delete('pages'), caches.delete('media')])
  } catch {}
}

/** Save pages ahead of time, so they open without signal. */
export function saveForOffline(urls: string[]) {
  navigator.serviceWorker?.ready
    .then((reg) => reg.active?.postMessage({type: 'save', urls}))
    .catch(() => {})
}

// ---------------------------------------------------------------------------
// The browser's "Install" offer (Chrome, Edge, Android). iPhone and iPad
// have none: Share → Add to Home Screen.
// ---------------------------------------------------------------------------

type InstallEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{outcome: string}>
}
let offer: InstallEvent | null = null
const listeners = new Set<() => void>()

export function watchInstallOffer() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    offer = e as InstallEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    offer = null
    listeners.forEach((l) => l())
  })
}

export function canOfferInstall() {
  return offer !== null
}

export function onInstallOffer(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export async function install() {
  if (!offer) return false
  await offer.prompt()
  const {outcome} = await offer.userChoice
  offer = null
  listeners.forEach((l) => l())
  return outcome === 'accepted'
}

// ---------------------------------------------------------------------------
// Notifications on this device
// ---------------------------------------------------------------------------

function fromBase64Url(s: string) {
  const b64 = (s + '='.repeat((4 - (s.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

/** This device's subscription, if notifications are on here. */
export async function currentSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** Ask (the browser shows its own question), then tell the server. */
export async function turnOn(): Promise<'on' | 'denied' | 'unavailable'> {
  if (!pushSupported()) return 'unavailable'
  const {key} = await (await fetch('/api/push/key')).json()
  if (!key) return 'unavailable'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: fromBase64Url(key),
    }))
  const r = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({...sub.toJSON(), device: deviceName()}),
  })
  return r.ok ? 'on' : 'unavailable'
}

export async function turnOff() {
  const sub = await currentSubscription()
  if (!sub) return
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({endpoint: sub.endpoint}),
  }).catch(() => {})
  await sub.unsubscribe().catch(() => {})
}
