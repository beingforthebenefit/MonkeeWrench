'use client'

import {useState} from 'react'
import {signIn, signOut} from 'next-auth/react'
import {field, label, primary} from './auth-styles'
import {GoogleG} from './LoginForm'

/**
 * Start a band on the hosted service. Signed in: it's yours at once.
 * Otherwise either Google (it signs them up, then back here for the band's
 * name) or an email follows, to choose a password.
 */
export default function StartBand({
  signedIn,
  google = false,
  newAccount,
}: {
  signedIn: boolean
  /** "Sign in with Google" is set up here */
  google?: boolean
  /** Signed in with no band yet (just signed up with Google): their email */
  newAccount?: string
}) {
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
      {newAccount && (
        <p className="mt-4 rounded-xl bg-panel p-4 text-sm text-muted">
          Signed in as <strong className="text-text">{newAccount}</strong>.
          Joining a band that’s already here? Ask its admin to add this address,
          or{' '}
          <button
            type="button"
            onClick={() => signOut({callbackUrl: '/login'})}
            className="text-sky underline"
          >
            sign in with another account
          </button>
          .
        </p>
      )}
      {!signedIn && google && (
        <>
          <button
            type="button"
            onClick={() => signIn('google', {callbackUrl: '/start'})}
            className="mt-6 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-line-2 bg-panel font-semibold"
          >
            <GoogleG /> Start with Google
          </button>
          <div className="mt-5 flex items-center gap-3 text-sm text-faint">
            <span className="h-px flex-1 bg-line" />
            or with your email
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}
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
