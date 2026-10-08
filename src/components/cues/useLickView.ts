'use client'

import {useEffect, useState} from 'react'

/**
 * How licks (notation blocks) are shown on this device: as notation, or as
 * notation with tab under it. One setting for every lick on the page --
 * flipping it on one block flips them all -- remembered per device.
 */
export type LickView = 'notation' | 'tab'

const KEY = 'ms:lick-view'
const EVENT = 'ms:lick-view'

function read(): LickView {
  try {
    return window.localStorage.getItem(KEY) === 'tab' ? 'tab' : 'notation'
  } catch {
    return 'notation'
  }
}

export function useLickView() {
  const [view, setView] = useState<LickView>('notation')
  useEffect(() => {
    setView(read())
    const sync = () => setView(read())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  const set = (v: LickView) => {
    try {
      window.localStorage.setItem(KEY, v)
    } catch {
      // private mode: still switches this page
    }
    setView(v)
    window.dispatchEvent(new Event(EVENT))
  }
  return [view, set] as const
}
