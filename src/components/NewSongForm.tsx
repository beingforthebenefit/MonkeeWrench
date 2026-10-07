'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useState} from 'react'

export default function NewSongForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [writer, setWriter] = useState('')
  const [leadSinger, setLeadSinger] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const r = await fetch('/api/songs', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({title, writer, leadSinger}),
    })
    if (!r.ok) {
      setError('Could not add the song.')
      setBusy(false)
      return
    }
    const {id} = await r.json()
    router.push(`/songs/${id}/edit`)
  }

  return (
    <main className="mx-auto max-w-xl px-4 pt-5">
      <Link
        href="/songs"
        className="text-sm text-muted no-underline hover:text-text"
      >
        ‹ All songs
      </Link>
      <h1 className="mt-1 text-3xl font-extrabold">Add a song</h1>
      <form onSubmit={create} className="mt-5 flex flex-col gap-4">
        {(
          [
            ['Title', title, setTitle, true],
            ['Written by', writer, setWriter, false],
            ['Lead singer', leadSinger, setLeadSinger, false],
          ] as const
        ).map(([label, value, set, required]) => (
          <label key={label} className="flex flex-col gap-1 text-sm text-muted">
            {label}
            <input
              value={value}
              required={required}
              onChange={(e) => set(e.target.value)}
              className="min-h-11 rounded-lg border border-line-2 bg-panel px-3 text-base text-text"
            />
          </label>
        ))}
        <p className="text-sm text-muted">
          You can paste the chart on the next screen.
        </p>
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="min-h-12 rounded-lg bg-amber font-bold text-ink disabled:opacity-40"
        >
          {busy ? 'Adding…' : 'Add and write the chart'}
        </button>
        {error && (
          <p role="alert" className="text-bad">
            {error}
          </p>
        )}
      </form>
    </main>
  )
}
