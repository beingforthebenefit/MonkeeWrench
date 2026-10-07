'use client'

import {useRouter, useSearchParams} from 'next/navigation'
import {signIn} from 'next-auth/react'
import {useState} from 'react'

// Only same-site paths, so the sign-in link can't bounce people elsewhere
function safeCallback(raw: string | null) {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/songs'
}

export default function LoginPage() {
  const params = useSearchParams()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await signIn('credentials', {email, password, redirect: false})
    if (res?.ok && !res.error) {
      router.replace(safeCallback(params.get('callbackUrl')))
      router.refresh()
      return
    }
    setBusy(false)
    setError(
      res?.error === 'throttled'
        ? 'Too many tries. Wait 15 minutes, or ask Gerald for a new password.'
        : 'That email and password don’t match. Passwords look like k7mq-x2vd-9rta-hp3e.',
    )
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm">
        <p className="text-[14px] font-extrabold uppercase tracking-[0.2em] text-muted">
          Monkee Wrench
        </p>
        <h1 className="mt-2 text-3xl font-extrabold">Sign in</h1>
        <p className="mt-1 text-muted">
          Charts, setlists and rehearsals for Monkee Business.
        </p>

        <label className="mt-6 flex flex-col gap-1 text-sm text-muted">
          Email
          <input
            type="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-12 rounded-lg border border-line-2 bg-panel px-3 text-base text-text"
          />
        </label>
        <label className="mt-4 flex flex-col gap-1 text-sm text-muted">
          Password
          <input
            type="password"
            autoComplete="current-password"
            autoCapitalize="off"
            autoCorrect="off"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-12 rounded-lg border border-line-2 bg-panel px-3 font-mono text-base text-text"
          />
        </label>
        {error && (
          <p role="alert" className="mt-4 text-sm text-bad">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-6 min-h-12 w-full rounded-xl bg-amber text-[17px] font-extrabold text-ink disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="mt-4 text-sm text-faint">
          No password yet, or lost it? Ask Gerald: he can send you a new one.
        </p>
      </form>
    </main>
  )
}
