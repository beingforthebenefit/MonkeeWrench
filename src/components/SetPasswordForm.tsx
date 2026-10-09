'use client'

import {useState} from 'react'
import {signIn} from 'next-auth/react'
import {field, label, primary} from './auth-styles'

export default function SetPasswordForm({
  token,
  email,
  minLength,
}: {
  token: string
  email: string
  minLength: number
}) {
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== again) return setError('The two passwords differ.')
    setBusy(true)
    setError(null)
    const r = await fetch('/api/password/set', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({token, password}),
    })
    if (!r.ok) {
      setBusy(false)
      return setError(
        (await r.json().catch(() => ({}))).error ?? 'That didn’t work.',
      )
    }
    // Straight in with the password just chosen
    const res = await signIn('credentials', {email, password, redirect: false})
    window.location.assign(res?.ok && !res.error ? '/songs' : '/login')
  }

  return (
    <form onSubmit={submit}>
      {/* For password managers: which account this password is for */}
      <input
        type="email"
        autoComplete="username"
        value={email}
        readOnly
        hidden
      />
      <label className={label}>
        New password
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
        {busy ? 'Saving…' : 'Save and sign in'}
      </button>
    </form>
  )
}
