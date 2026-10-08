'use client'

import {useEffect} from 'react'
import {THEME_KEY, applyTheme, parseThemePref} from '@/lib/theme'

function storedPref() {
  try {
    return parseThemePref(window.localStorage.getItem(THEME_KEY))
  } catch {
    return parseThemePref(null)
  }
}

/** Follows the device's light/dark setting live while the choice is "system". */
export default function ThemeWatcher() {
  useEffect(() => {
    applyTheme(storedPref())
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme(storedPref())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return null
}
