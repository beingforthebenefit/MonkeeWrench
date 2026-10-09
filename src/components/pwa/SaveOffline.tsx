'use client'

import {useEffect, useState} from 'react'
import {saveForOffline} from './pwa'

type State =
  | {at: 'saving'}
  | {at: 'done'; saved: number; total: number}
  | {at: 'unknown'}

/**
 * Opening a setlist saves its performance mode and its songs on this
 * device, so the gig works without signal. Says "Saved" only once the
 * device actually has them, and what's missing if some didn't save.
 */
export default function SaveOffline({
  urls,
  quiet = false,
}: {
  urls: string[]
  /** Save without saying so (performance mode has no room for it) */
  quiet?: boolean
}) {
  const [state, setState] = useState<State | null>(null)
  const key = urls.join('|')
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller)
      return
    let live = true
    setState({at: 'saving'})
    saveForOffline(key.split('|')).then((r) => {
      if (live) setState(r ? {at: 'done', ...r} : {at: 'unknown'})
    })
    return () => {
      live = false
    }
  }, [key])
  if (quiet || !state || state.at === 'unknown') return null

  const all = state.at === 'done' && state.saved === state.total
  const label =
    state.at === 'saving'
      ? 'Saving for offline…'
      : all
        ? '✓ Saved for offline'
        : state.saved === 0
          ? 'Not saved for offline'
          : `Saved ${state.saved} of ${state.total} for offline`
  return (
    <span
      role="status"
      className={`inline-flex min-h-11 items-center text-sm ${state.at === 'done' && !all ? 'text-warn-fg' : 'text-muted'}`}
      title={
        all
          ? 'Performance mode and every chart in this set open on this device without signal'
          : state.at === 'done'
            ? 'Some pages didn’t save. Open this setlist again with signal to retry.'
            : undefined
      }
    >
      {label}
    </span>
  )
}
