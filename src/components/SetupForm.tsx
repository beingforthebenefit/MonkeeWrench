'use client'

import {useState} from 'react'
import {signIn} from 'next-auth/react'
import {field, label, primary} from './auth-styles'

/** A fresh install's first band and account; signed straight in after. */
export default function SetupForm({minLength}: {minLength: number}) {
  const [bandName, setBandName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== again) return setError('The two passwords differ.')
    setBusy(true)
    setError(null)
    const r = await fetch('/api/setup', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({bandName, name, email, password}),
    })
    if (!r.ok) {
      setBusy(false)
      return setError(
        (await r.json().catch(() => ({}))).error ?? 'That didn’t work.',
      )
    }
    const res = await signIn('credentials', {email, password, redirect: false})
    window.location.assign(res?.ok && !res.error ? '/songs' : '/login')
  }

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
          autoComplete="username"
          inputMode="email"
          autoCapitalize="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={field}
        />
      </label>
      <label className={label}>
        Password
        <input
          required
          type="password"
          autoComplete="new-password"
          minLength={minLength}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${field} font-mono`}
        />
      </label>
      <label className={label}>
        Once more
        <input
          required
          type="password"
          autoComplete="new-password"
          minLength={minLength}
          value={again}
          onChange={(e) => setAgain(e.target.value)}
          className={`${field} font-mono`}
        />
      </label>
      <p className="mt-2 text-sm text-faint">
        At least {minLength} characters.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-bad">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={primary}>
        {busy ? 'Setting up…' : 'Set up and sign in'}
      </button>
    </form>
  )
}
