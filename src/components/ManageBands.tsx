'use client'

import {useRouter} from 'next/navigation'
import {useState} from 'react'

type Row = {
  id: string
  name: string
  appName: string
  domains: string[]
  members: number
  songs: number
  mine: boolean
}

export default function ManageBands({bands}: {bands: Row[]}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const r = await fetch('/api/bands', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name}),
    })
    if (!r.ok)
      return setError(
        (await r.json().catch(() => ({}))).error ?? 'Couldn’t start it.',
      )
    const {id} = await r.json()
    // Straight into the new band, to add its members and settings
    await fetch('/api/bands/current', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({bandId: id}),
    })
    window.location.assign('/admin')
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-12 pt-5">
      <h1 className="text-3xl font-extrabold">All bands</h1>
      <p className="mt-1 text-muted">
        Everyone only sees the bands they’re in. You run this site, so you see
        them all here — but not their songs unless you’re in the band.
      </p>

      <ul className="mt-5">
        {bands.map((b) => (
          <BandRow key={b.id} band={b} onSaved={() => router.refresh()} />
        ))}
      </ul>

      <form
        onSubmit={create}
        className="mt-8 flex flex-col gap-2 rounded-xl border border-line-2 bg-panel p-4"
      >
        <label className="flex flex-col gap-1 text-sm text-muted">
          Start a new band
          <input
            required
            value={name}
            placeholder="Band name"
            onChange={(e) => setName(e.target.value)}
            className="min-h-11 rounded-lg border border-line-2 bg-ink px-3 text-base text-text"
          />
        </label>
        <p className="text-xs text-faint">
          You’ll be its first admin; add its members from Band members.
        </p>
        <button
          type="submit"
          className="min-h-11 self-start rounded-lg bg-accent px-5 font-bold text-on-accent"
        >
          Start it
        </button>
        {error && <p className="text-sm text-bad">{error}</p>}
      </form>
    </main>
  )
}

function BandRow({band, onSaved}: {band: Row; onSaved: () => void}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(band.domains.join('\n'))
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const domains = text
      .split(/[\s,]+/)
      .map((d) => d.trim())
      .filter(Boolean)
    const r = await fetch(`/api/bands/${band.id}`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({domains}),
    })
    if (!r.ok)
      return setError(
        (await r.json().catch(() => ({}))).error ?? 'Couldn’t save.',
      )
    setEditing(false)
    onSaved()
  }

  return (
    <li className="border-t border-line py-4">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <strong className="text-lg">{band.name}</strong>
        {band.appName !== band.name && (
          <span className="text-sm text-muted">as “{band.appName}”</span>
        )}
        <span className="text-sm text-faint">
          {band.members} members · {band.songs} songs
          {band.mine ? '' : ' · you’re not in it'}
        </span>
      </div>
      {!editing ? (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          {band.domains.length ? (
            band.domains.map((d) => (
              <code key={d} className="rounded bg-line px-1.5 py-0.5">
                {d}
              </code>
            ))
          ) : (
            <span className="text-faint">No web address of its own</span>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-9 px-2 text-sky underline"
          >
            Edit addresses
          </button>
        </div>
      ) : (
        <form onSubmit={save} className="mt-2 flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Web addresses, one per line
            <textarea
              value={text}
              rows={3}
              onChange={(e) => setText(e.target.value)}
              placeholder="members.example.com"
              className="rounded-lg border border-line-2 bg-ink px-3 py-2 font-mono text-base text-text"
            />
          </label>
          <p className="text-xs text-faint">
            Each address also needs DNS pointing here, a route in the proxy and,
            for Google sign-in, https://&lt;address&gt;/api/auth/callback/google
            added to the Google OAuth client.
          </p>
          <div className="flex gap-2">
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-accent px-4 font-bold text-on-accent"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="min-h-11 px-3 text-muted"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
        </form>
      )}
    </li>
  )
}
