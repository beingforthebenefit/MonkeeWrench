'use client'

import {useRouter} from 'next/navigation'
import {useState} from 'react'

export default function NewSetlistButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function create() {
    setBusy(true)
    const r = await fetch('/api/setlists', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name: 'New setlist'}),
    })
    if (r.ok) router.push(`/setlists/${(await r.json()).id}`)
    else setBusy(false)
  }
  return (
    <button
      type="button"
      onClick={create}
      disabled={busy}
      className="min-h-11 rounded-lg border border-line-2 px-4 font-semibold disabled:opacity-50"
    >
      New setlist
    </button>
  )
}
