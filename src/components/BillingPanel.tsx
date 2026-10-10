'use client'

import {useState} from 'react'
import type {BandBilling} from '@/lib/billing'

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

/** What the band's subscription says, and what an admin can do about it. */
export default function BillingPanel({
  billing,
  price,
  thanks = false,
}: {
  billing: BandBilling
  price: string
  /** Back from Polar's checkout: the webhook may not have arrived yet */
  thanks?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go(path: string) {
    setBusy(true)
    setError(null)
    const r = await fetch(path, {method: 'POST'})
    const body = await r.json().catch(() => ({}))
    if (r.ok && body.url) return window.location.assign(body.url)
    setBusy(false)
    setError(body.error ?? 'Couldn’t reach the payment service. Try again.')
  }

  const {kind, until, daysLeft, status} = billing
  const line =
    kind === 'trial'
      ? `Free trial: ${daysLeft} day${daysLeft === 1 ? '' : 's'} left (until ${day(until!)}). Then ${price} for the whole band; the year starts the day you subscribe.`
      : kind === 'lapsed'
        ? `The subscription ended on ${day(until!)}, so the band is read-only. Everything is still here; renewing turns editing back on.`
        : kind === 'paid'
          ? status === 'past_due'
            ? `The last payment didn’t go through. Update the card before ${day(until!)} to keep editing.`
            : status === 'canceled' || status === 'canceling'
              ? `Cancelled: paid until ${day(until!)}, then read-only. Subscribe again any time.`
              : `Subscribed: ${price}. Paid until ${day(until!)}.`
          : 'Free.'

  return (
    <div className="mt-3 rounded-xl border border-line-2 bg-panel p-4">
      {thanks && kind !== 'paid' && (
        <p role="status" className="mb-2 font-semibold text-good">
          Thanks! It can take a minute to show here.
        </p>
      )}
      <p className={kind === 'lapsed' ? 'text-warn-fg' : 'text-muted'}>
        {line}
      </p>
      {billing.ready && kind !== 'free' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {(kind === 'trial' ||
            kind === 'lapsed' ||
            !billing.hasCustomer ||
            status === 'canceled' ||
            status === 'canceling') && (
            <button
              type="button"
              disabled={busy}
              onClick={() => go('/api/billing/checkout')}
              className="min-h-11 rounded-lg bg-accent px-4 font-bold text-on-accent disabled:opacity-50"
            >
              {kind === 'lapsed' ? 'Renew' : 'Subscribe'} — {price}
            </button>
          )}
          {billing.hasCustomer && (
            <button
              type="button"
              disabled={busy}
              onClick={() => go('/api/billing/portal')}
              className="min-h-11 rounded-lg border border-line-2 px-4 font-semibold disabled:opacity-50"
            >
              Card, receipts and cancelling
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  )
}
