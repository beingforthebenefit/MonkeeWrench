'use client'

import {useState} from 'react'
import {field, label, primary} from './auth-styles'

/**
 * Start a band on the hosted service. Signed in: it's yours at once.
 * Otherwise an email follows, to choose a password.
 */
export default function StartBand({signedIn}: {signedIn: boolean}) {
  const [bandName, setBandName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const r = await fetch('/api/signup', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(
        signedIn ? {bandName} : {bandName, name, email, website},
      ),
    })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) {
      setBusy(false)
      return setError(body.error ?? 'That didn’t work. Try again.')
    }
    if (signedIn && body.bandId) {
      // Show the new band on this device, with its own menu
      await fetch('/api/bands/current', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({bandId: body.bandId}),
      })
      window.location.assign('/members')
      return
    }
    setSent(true)
  }

  if (sent)
    return (
      <div role="status" className="mt-6 rounded-xl bg-panel p-4">
        <p className="font-bold">Check your email</p>
        <p className="mt-1 text-muted">
          We sent a link to <strong className="text-text">{email}</strong> to
          choose your password. It works for 7 days. Nothing there? Check spam,
          or try again in a few minutes.
        </p>
      </div>
    )

  return (
    <form onSubmit={submit}>
      <label className={label}>
        Band name
        <input
          required
          maxLength={80}
          value={bandName}
          onChange={(e) => setBandName(e.target.value)}
          className={field}
        />
      </label>
      {!signedIn && (
        <>
          <label className={label}>
            Your name
            <input
              required
              autoComplete="name"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={field}
            />
          </label>
          <label className={label}>
            Your email
            <input
              required
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
            />
          </label>
          {/* Only bots see and fill this in */}
          <label aria-hidden="true" className="absolute -left-[9999px]">
            Website
            <input
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-bad">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={primary}>
        {busy ? 'Starting…' : 'Start the band'}
      </button>
    </form>
  )
}
