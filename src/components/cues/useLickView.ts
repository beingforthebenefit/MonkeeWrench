'use client'

import {useEffect, useState} from 'react'

/**
 * How licks (notation blocks) are shown on this device: as notation, or as
 * tab. Guitar and bass parts start as tab, everything else (horn lines,
 * melodies) as notation. Each kind has one setting for every lick of that
 * kind on the page -- flipping one flips them all -- remembered per device.
 */
export type LickView = 'notation' | 'tab'
/** "part": written for guitar or bass; "line": anything else */
export type LickKind = 'part' | 'line'

const KEYS: Record<LickKind, string> = {
  part: 'ms:lick-view:part',
  line: 'ms:lick-view',
}
const DEFAULT: Record<LickKind, LickView> = {part: 'tab', line: 'notation'}
const EVENT = 'ms:lick-view'

function read(kind: LickKind): LickView {
  try {
    const v = window.localStorage.getItem(KEYS[kind])
    return v === 'tab' || v === 'notation' ? v : DEFAULT[kind]
  } catch {
    return DEFAULT[kind]
  }
}

export function useLickView(kind: LickKind) {
  const [view, setView] = useState<LickView>(DEFAULT[kind])
  useEffect(() => {
    setView(read(kind))
    const sync = () => setView(read(kind))
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [kind])
  const set = (v: LickView) => {
    try {
      window.localStorage.setItem(KEYS[kind], v)
    } catch {
      // private mode: still switches this page
    }
    setView(v)
    window.dispatchEvent(new Event(EVENT))
  }
  return [view, set] as const
}
