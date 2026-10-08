'use client'

import {useState} from 'react'

type Key = 'shareAvailability' | 'blockOtherBands'

const ROWS: {key: Key; title: string; on: string; off: string}[] = [
  {
    key: 'shareAvailability',
    title: 'One set of days off for all my bands',
    on: 'Days you mark as out count in every band you’re in.',
    off: 'Each band has its own days off; marking a day in one band doesn’t touch the others. Switching back merges them, keeping the strongest mark for each day.',
  },
  {
    key: 'blockOtherBands',
    title: 'Rehearsals and gigs block my other bands',
    on: 'A rehearsal or gig with one band marks you busy for the others (they see “busy with another band”, not which).',
    off: 'Your other bands don’t see when you’re booked with each other.',
  },
]

/** Settings that span every band someone is in. */
export default function BandSettingsToggles({
  initial,
}: {
  initial: Record<Key, boolean>
}) {
  const [v, setV] = useState(initial)
  const [error, setError] = useState(false)
  async function toggle(key: Key) {
    const next = {...v, [key]: !v[key]}
    setV(next)
    const r = await fetch('/api/account/settings', {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({[key]: next[key]}),
    })
    setError(!r.ok)
    if (!r.ok) setV(v)
  }
  return (
    <section aria-labelledby="bands-h" className="mt-8">
      <h2
        id="bands-h"
        className="text-xs font-bold uppercase tracking-widest text-muted"
      >
        Across your bands
      </h2>
      <ul className="mt-2">
        {ROWS.map((r) => (
          <li key={r.key} className="border-t border-line py-3">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={v[r.key]}
                onChange={() => toggle(r.key)}
                className="mt-1 h-5 w-5 shrink-0"
              />
              <span>
                <span className="block font-semibold">{r.title}</span>
                <span className="block text-sm text-muted">
                  {v[r.key] ? r.on : r.off}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-bad">
          Couldn’t save that — try again.
        </p>
      )}
    </section>
  )
}
