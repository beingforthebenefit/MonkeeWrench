'use client'

import {useState} from 'react'

export default function VoteThreshold({
  initial,
  max,
}: {
  initial: number
  max: number
}) {
  const [value, setValue] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [error, setError] = useState(false)
  async function save(n: number) {
    setValue(n)
    const r = await fetch('/api/band', {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({voteThreshold: n}),
    })
    if (r.ok) setSaved(n)
    else {
      setValue(saved)
      setError(true)
    }
  }
  return (
    <div className="mt-3 rounded-xl border border-line-2 bg-panel p-4">
      <p>Votes needed for a proposal to join the book</p>
      <div
        role="radiogroup"
        aria-label="Votes needed"
        className="mt-3 flex flex-wrap gap-2"
      >
        {Array.from({length: Math.max(max, initial)}, (_, i) => i + 1).map(
          (n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              onClick={() => save(n)}
              className={`h-11 w-11 rounded-lg font-mono font-bold ${value === n ? 'bg-accent text-on-accent' : 'border border-line-2'}`}
            >
              {n}
            </button>
          ),
        )}
      </div>
      <p className="mt-2 text-sm text-muted">
        {error
          ? 'Couldn’t save — try again.'
          : `Saved: ${saved}. Applies to the next vote cast.`}
      </p>
    </div>
  )
}
