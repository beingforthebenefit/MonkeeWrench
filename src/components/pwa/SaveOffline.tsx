'use client'

import {useEffect, useState} from 'react'
import {saveForOffline} from './pwa'

/**
 * Opening a setlist saves its performance mode and its songs on this
 * device, so the gig works without signal. Says so once it's asked.
 */
export default function SaveOffline({urls}: {urls: string[]}) {
  const [saved, setSaved] = useState(false)
  const key = urls.join('|')
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller)
      return
    saveForOffline(key.split('|'))
    setSaved(true)
  }, [key])
  if (!saved) return null
  return (
    <span
      className="inline-flex min-h-11 items-center text-sm text-muted"
      title="Performance mode and these charts open on this device without signal"
    >
      ✓ Saved for offline
    </span>
  )
}
