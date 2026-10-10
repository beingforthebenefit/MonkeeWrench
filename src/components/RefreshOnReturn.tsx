'use client'

import {useRouter} from 'next/navigation'
import {useEffect} from 'react'

/** Away longer than pages are kept (next.config.mjs staleTimes) */
const AWAY_MS = 5 * 60 * 1000

/**
 * Pages already seen are shown again without asking the server, for five
 * minutes. Coming back to the app after longer than that (it sat in the
 * background, the laptop slept), fetch the page on screen again quietly,
 * so what someone else changed meanwhile shows up.
 */
export default function RefreshOnReturn() {
  const router = useRouter()
  useEffect(() => {
    let hiddenAt = 0
    const onChange = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > AWAY_MS) router.refresh()
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [router])
  return null
}
