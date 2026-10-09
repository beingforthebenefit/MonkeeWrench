'use client'

import {useEffect, useState} from 'react'
import {registerServiceWorker, watchInstallOffer} from './pwa'

/** Once per page load: the service worker and the browser's install offer. */
export default function PwaSetup() {
  useEffect(() => {
    watchInstallOffer()
    registerServiceWorker()
  }, [])
  return null
}

/** True while the device has no network (pages come from the saved copy). */
export function useOffline() {
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return offline
}

/** A small "Offline" pill, shown only without signal. */
export function OfflineBadge({className = ''}: {className?: string}) {
  const offline = useOffline()
  if (!offline) return null
  return (
    <span
      role="status"
      title="No signal: you're seeing the copy saved on this device"
      className={`rounded-full bg-warn-bg px-2.5 py-1 text-xs font-bold text-warn-fg ${className}`}
    >
      Offline
    </span>
  )
}
