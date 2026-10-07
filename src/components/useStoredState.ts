'use client'

import {useEffect, useState} from 'react'

/**
 * useState that remembers its value on this device. Storage can be missing or
 * throw (private mode, blocked site data), so every access is guarded and the
 * default is used instead.
 */
export function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) setValue(JSON.parse(raw) as T)
    } catch {
      // ignore
    }
  }, [key])
  const set = (v: T) => {
    setValue(v)
    try {
      window.localStorage.setItem(key, JSON.stringify(v))
    } catch {
      // ignore
    }
  }
  return [value, set] as const
}
