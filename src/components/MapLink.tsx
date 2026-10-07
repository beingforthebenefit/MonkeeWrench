'use client'

import {useEffect, useState} from 'react'

/** Apple Maps on iPhone/iPad, Google Maps elsewhere (on Android it opens the app). */
export function mapsUrl(place: string, ua: string, isTouchMac = false) {
  const q = encodeURIComponent(place)
  const apple = /iPhone|iPad|iPod/.test(ua) || isTouchMac
  return apple
    ? `https://maps.apple.com/?q=${q}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`
}

export default function MapLink({
  place,
  className,
}: {
  place: string
  className?: string
}) {
  // Rendered first with Google Maps (the server can't see the device),
  // then switched once the browser says what it is
  const [href, setHref] = useState(() => mapsUrl(place, ''))
  useEffect(() => {
    // iPadOS reports itself as a Mac; touch support gives it away
    const touchMac =
      navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
    setHref(mapsUrl(place, navigator.userAgent, touchMac))
  }, [place])
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {place}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (opens in maps)</span>
    </a>
  )
}
