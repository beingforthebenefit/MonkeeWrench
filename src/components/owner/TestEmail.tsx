'use client'

import {useState} from 'react'

/** Send the owner one of each of the app's emails, to see them. */
export default function TestEmail({email}: {email: string}) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | string>(
    'idle',
  )
  async function send() {
    setState('sending')
    const r = await fetch('/api/owner/test-email', {method: 'POST'})
    const body = await r.json().catch(() => ({}))
    setState(r.ok ? 'sent' : (body.error ?? 'Couldn’t send.'))
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-line-2 bg-panel p-4">
      <p className="min-w-0 flex-1 text-sm text-muted">
        The welcome, invite and password-reset emails, sent to{' '}
        <strong className="text-text">{email}</strong> only, marked [Test].
      </p>
      <button
        type="button"
        onClick={send}
        disabled={state === 'sending'}
        className="min-h-11 rounded-lg bg-accent px-4 font-bold text-on-accent disabled:opacity-50"
      >
        {state === 'sending' ? 'Sending…' : 'Send me test emails'}
      </button>
      {state === 'sent' && (
        <p role="status" className="basis-full text-sm text-good">
          ✓ Sent 3 emails. They can take a minute; check spam the first time.
        </p>
      )}
      {state !== 'idle' && state !== 'sending' && state !== 'sent' && (
        <p role="alert" className="basis-full text-sm text-bad">
          {state}
        </p>
      )}
    </div>
  )
}
