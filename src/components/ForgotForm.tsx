'use client'

import {useState} from 'react'
import {field, label, primary} from './auth-styles'

export default function ForgotForm() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const r = await fetch('/api/password/forgot', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email}),
    })
    setBusy(false)
    if (r.ok) setSent(true)
    else setError((await r.json().catch(() => ({}))).error ?? 'Try again.')
  }

  if (sent)
    return (
      <p role="status" className="mt-6 rounded-xl bg-panel p-4 text-muted">
        If <strong className="text-text">{email}</strong> has an account, we’ve
        emailed it a link to choose a new password. It works for an hour.
      </p>
    )
  return (
    <form onSubmit={submit}>
      <label className={label}>
        Email
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
      {error && (
        <p role="alert" className="mt-4 text-sm text-bad">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={primary}>
        {busy ? 'Sending…' : 'Email me a link'}
      </button>
    </form>
  )
}
