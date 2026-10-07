'use client'

import {useRouter} from 'next/navigation'
import {useState} from 'react'

export default function RestoreButton({
  songId,
  number,
}: {
  songId: string
  number: number
}) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'confirm' | 'busy' | 'error'>(
    'idle',
  )

  async function restore() {
    setState('busy')
    const r = await fetch(`/api/songs/${songId}/versions/${number}/restore`, {
      method: 'POST',
    })
    if (!r.ok) return setState('error')
    const {number: n} = await r.json()
    router.push(`?v=${n}`)
    router.refresh()
    setState('idle')
  }

  if (state === 'confirm' || state === 'busy')
    return (
      <span className="flex items-center gap-2">
        <span className="text-sm text-muted">
          Save version {number} as the current chart?
        </span>
        <button
          type="button"
          onClick={restore}
          disabled={state === 'busy'}
          className="min-h-11 rounded-lg bg-amber px-4 font-bold text-ink"
        >
          Restore
        </button>
        <button
          type="button"
          onClick={() => setState('idle')}
          className="min-h-11 px-2 text-muted"
        >
          Cancel
        </button>
      </span>
    )
  return (
    <button
      type="button"
      onClick={() => setState('confirm')}
      className="min-h-11 rounded-lg border border-amber px-4 font-semibold text-amber"
    >
      {state === 'error'
        ? 'Restore failed — try again'
        : `Restore version ${number}`}
    </button>
  )
}
