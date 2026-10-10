'use client'

import {usePathname, useRouter} from 'next/navigation'
import {useEffect, useRef} from 'react'

/** While a page is on screen, ask this often */
const EVERY_MS = 30_000

/**
 * Pages already seen open instantly from memory (next.config.mjs
 * staleTimes), which on its own would show a bandmate's change only minutes
 * later. So: on every tab switch, on coming back to the app, and every 30
 * seconds while it's on screen, ask the server where the band is up to
 * (/api/changes, a few bytes). If something changed since these pages were
 * drawn, fetch the page on screen again in the background; that also drops
 * every other remembered page, so none of them can be older than this.
 */
export default function KeepFresh({stamp}: {stamp: string}) {
  const router = useRouter()
  const pathname = usePathname()
  const seen = useRef(stamp)
  const asking = useRef(false)

  // A fresh render of the layout (a full load, a refresh) carries the stamp
  // its pages were drawn with
  useEffect(() => {
    seen.current = stamp
  }, [stamp])

  const check = useRef(async () => {})
  check.current = async () => {
    if (asking.current || document.visibilityState === 'hidden') return
    if (!navigator.onLine) return
    asking.current = true
    try {
      const r = await fetch('/api/changes', {cache: 'no-store'})
      if (!r.ok) return
      const {stamp: now} = (await r.json()) as {stamp: string}
      if (now !== seen.current) {
        seen.current = now
        router.refresh()
      }
    } catch {
      // No signal: the saved pages stand
    } finally {
      asking.current = false
    }
  }

  useEffect(() => {
    check.current()
  }, [pathname])

  useEffect(() => {
    const ask = () => check.current()
    document.addEventListener('visibilitychange', ask)
    window.addEventListener('online', ask)
    const timer = setInterval(ask, EVERY_MS)
    return () => {
      document.removeEventListener('visibilitychange', ask)
      window.removeEventListener('online', ask)
      clearInterval(timer)
    }
  }, [])

  return null
}
