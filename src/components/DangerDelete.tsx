'use client'

import {useState} from 'react'
import {signOut} from 'next-auth/react'
import {clearSaved} from '@/components/pwa/pwa'

/**
 * The end of a page: delete this band, or your account. Folded shut; once
 * open, the button only works after typing the thing's name.
 */
export default function DangerDelete({
  what,
  confirmText,
  confirmLabel,
  endpoint,
  explain,
  signOutAfter = false,
}: {
  /** "this band", "your account" */
  what: string
  /** What must be typed to confirm (the band's name, your email) */
  confirmText: string
  confirmLabel: string
  endpoint: string
  explain: string
  /** Deleting your account: sign out, then to the sign-in page */
  signOutAfter?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    setBusy(true)
    setError(null)
    const r = await fetch(endpoint, {
      method: 'DELETE',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({confirm: typed}),
    })
    if (!r.ok) {
      setBusy(false)
      return setError(
        (await r.json().catch(() => ({}))).error ?? 'That didn’t work.',
      )
    }
    // Nothing of what's gone stays saved on this device
    await clearSaved()
    if (signOutAfter) await signOut({callbackUrl: '/login'})
    else window.location.assign('/')
  }

  const matches =
    typed.trim().toLowerCase() === confirmText.trim().toLowerCase()
  return (
    <section className="mt-12 border-t border-line pt-5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-11 text-sm text-bad underline"
        >
          Delete {what}…
        </button>
      ) : (
        <div className="rounded-xl border border-bad/50 p-4">
          <h2 className="font-bold">Delete {what}</h2>
          <p className="mt-1 text-sm text-muted">{explain}</p>
          <label className="mt-3 flex flex-col gap-1 text-sm text-muted">
            {confirmLabel}
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmText}
              autoComplete="off"
              className="min-h-11 rounded-lg border border-line-2 bg-ink px-3 text-base text-text"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!matches || busy}
              onClick={go}
              className="min-h-11 rounded-lg bg-bad px-4 font-bold text-ink disabled:opacity-40"
            >
              {busy ? 'Deleting…' : `Delete ${what} for good`}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setTyped('')
                setError(null)
              }}
              className="min-h-11 px-3 text-muted"
            >
              Keep it
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-bad">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
