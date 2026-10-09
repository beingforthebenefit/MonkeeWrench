import Link from 'next/link'
import type {BandBilling} from '@/lib/billing'

/**
 * Above every band page on the hosted service, only when it matters: the
 * trial is nearly over, a payment failed, or the band is read-only.
 */
export default function BillingStrip({
  billing,
  isAdmin,
}: {
  billing: BandBilling
  isAdmin: boolean
}) {
  const {kind, daysLeft, status} = billing
  const text =
    kind === 'lapsed'
      ? 'This band is read-only: its subscription has ended. Everything is still here.'
      : kind === 'trial' && daysLeft !== null && daysLeft <= 7
        ? `The free trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`
        : kind === 'paid' && status === 'past_due'
          ? 'The band’s last payment didn’t go through.'
          : null
  if (!text) return null
  return (
    <p className="mx-auto mt-3 max-w-[1400px] px-4 md:px-7">
      <span
        role="status"
        className={`block rounded-lg border px-4 py-2 text-sm ${kind === 'lapsed' ? 'border-warn-fg/50 bg-warn-bg text-warn-fg' : 'border-line-2 bg-panel text-muted'}`}
      >
        {text}{' '}
        {isAdmin ? (
          <Link href="/admin#billing" className="font-semibold text-amber">
            {kind === 'lapsed' ? 'Renew' : 'Billing'} ›
          </Link>
        ) : (
          'Your band’s admin can sort it out on the Admin page.'
        )}
      </span>
    </p>
  )
}
