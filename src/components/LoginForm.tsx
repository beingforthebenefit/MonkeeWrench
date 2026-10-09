'use client'

import Link from 'next/link'
import {useRouter, useSearchParams} from 'next/navigation'
import {getProviders, signIn} from 'next-auth/react'
import {useEffect, useState} from 'react'

// Only same-site paths, so the sign-in link can't bounce people elsewhere
function safeCallback(raw: string | null) {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/songs'
}

/** Branded for the band this web address belongs to, if any. */
export default function LoginForm({
  appName,
  bandName,
  iconUrl,
  forgot = false,
  signup = false,
}: {
  appName: string
  bandName: string | null
  iconUrl: string
  /** Email is set up: offer a reset link */
  forgot?: boolean
  /** The hosted service: anyone can start a band */
  signup?: boolean
}) {
  const params = useSearchParams()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(
    params.get('error') === 'NotMember'
      ? 'That Google account isn’t on the band list. Sign in with your email and password, or ask your band’s admin to add that address.'
      : null,
  )
  const [google, setGoogle] = useState(false)
  useEffect(() => {
    getProviders()
      .then((p) => setGoogle(Boolean(p?.google)))
      .catch(() => setGoogle(false))
  }, [])

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
        ? 'Too many tries. Wait 15 minutes, or ask your band’s admin for a new password.'
        : forgot
          ? 'That email and password don’t match.'
          : 'That email and password don’t match. Passwords look like k7mq-x2vd-9rta-hp3e.',
    )
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={iconUrl}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 rounded-xl"
          />
          <p className="text-[14px] font-extrabold uppercase tracking-[0.2em] text-muted">
            {appName}
          </p>
        </div>
        <h1 className="mt-4 text-3xl font-extrabold">Sign in</h1>
        <p className="mt-1 text-muted">
          Charts, setlists and rehearsals
          {bandName ? ` for ${bandName}` : ' for your band'}.
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
          className="mt-6 min-h-12 w-full rounded-xl bg-accent text-[17px] font-extrabold text-on-accent disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {google && (
          <>
            <div className="my-5 flex items-center gap-3 text-sm text-faint">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>
            <button
              type="button"
              onClick={() =>
                signIn('google', {
                  callbackUrl: safeCallback(params.get('callbackUrl')),
                })
              }
              className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-line-2 bg-panel font-semibold"
            >
              <GoogleG /> Sign in with Google
            </button>
          </>
        )}
        <p className="mt-4 text-sm text-faint">
          {forgot ? (
            <Link href="/forgot" className="text-sky">
              Forgot your password?
            </Link>
          ) : (
            'No password yet, or lost it? Your band’s admin can send you a new one.'
          )}
        </p>
        {signup && (
          <p className="mt-2 text-sm text-faint">
            New here?{' '}
            <Link href="/start" className="text-sky">
              Start your band
            </Link>{' '}
            — free for 30 days.
          </p>
        )}
      </form>
    </main>
  )
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.6 33 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C33.8 6 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c10.4 0 19-8.4 19-19 0-1.3-.1-2.2-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.8 16.5 19.1 14 24 14c3.1 0 5.9 1.2 8 3.1l5.7-5.7C33.8 6 29.2 4 24 4 16.5 4 9.9 8.1 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.3-5.2l-6.1-5c-2 1.4-4.6 2.2-7.2 2.2-5.3 0-9.7-3.6-11.3-8.5l-6.6 5.1C9.6 39.6 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.4 5.8-6.3 7.4l6.1 5C38.6 38.8 41 32.8 41 25c0-1.3-.1-2.9-.4-4.5z"
      />
    </svg>
  )
}
