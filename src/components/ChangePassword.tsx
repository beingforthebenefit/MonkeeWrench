'use client'

import {signIn, useSession} from 'next-auth/react'
import {useRouter} from 'next/navigation'
import {useState} from 'react'

const MIN = 10

export default function ChangePassword() {
  const router = useRouter()
  const {data: session} = useSession()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [msg, setMsg] = useState<{ok: boolean; text: string} | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== again)
      return setMsg({ok: false, text: 'The new passwords don’t match.'})
    if (next.length < MIN)
      return setMsg({ok: false, text: `Use at least ${MIN} characters.`})
    setBusy(true)
    const r = await fetch('/api/account/password', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({current, next}),
    })
    if (!r.ok) {
      setBusy(false)
      return setMsg({
        ok: false,
        text:
          (await r.json().catch(() => ({}))).error ?? 'Could not change it.',
      })
    }
    // Changing the password ends every session, this one included: sign back in
    await signIn('credentials', {
      email: session?.user?.email,
      password: next,
      redirect: false,
    })
    setBusy(false)
    setCurrent('')
    setNext('')
    setAgain('')
    setMsg({
      ok: true,
      text: 'Changed. Your other devices will need the new password.',
    })
    router.refresh()
  }

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    auto: string,
  ) => (
    <label className="flex flex-col gap-1 text-sm text-muted">
      {label}
      <input
        type="password"
        autoComplete={auto}
        required
        value={value}
        onChange={(e) => set(e.target.value)}
        className="min-h-12 rounded-lg border border-line-2 bg-panel px-3 font-mono text-base text-text"
      />
    </label>
  )

  return (
    <main className="mx-auto max-w-sm px-4 pt-5">
      <h1 className="text-3xl font-extrabold">Change password</h1>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
        {field('Current password', current, setCurrent, 'current-password')}
        {field(
          `New password (at least ${MIN} characters)`,
          next,
          setNext,
          'new-password',
        )}
        {field('New password again', again, setAgain, 'new-password')}
        {msg && (
          <p
            role="alert"
            className={`text-sm ${msg.ok ? 'text-good' : 'text-bad'}`}
          >
            {msg.text}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="min-h-12 rounded-xl bg-amber font-extrabold text-ink disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </main>
  )
}
