/**
 * The hosted service at bandstand.info: anyone can start a band, which is
 * free for a trial, then $12 a year through Polar (src/lib/billing.ts). A
 * self-hosted install never sets BANDSTAND_HOSTED, and none of this applies.
 *
 * A band's standing comes from Band.paidUntil alone:
 * - null: never billed (every self-hosted band; bands the owner comps)
 * - in the future: it can make changes (a trial, or paid through then)
 * - in the past: read-only. Nothing is deleted; renewing turns editing back on.
 */

export const HOSTED = process.env.BANDSTAND_HOSTED === '1'

export const TRIAL_DAYS = 30
/** Kept on after a renewal is due, while the card is retried */
export const GRACE_DAYS = 7
export const PRICE = '$12 a year'

const DAY = 24 * 60 * 60 * 1000

export type Standing =
  | {kind: 'free'}
  | {kind: 'trial'; until: Date; daysLeft: number}
  | {kind: 'paid'; until: Date; status: string | null}
  | {kind: 'lapsed'; since: Date}

type Billed = {
  paidUntil: Date | null
  polarSubscriptionId?: string | null
  subscriptionStatus?: string | null
}

export function standing(
  band: Billed,
  now = new Date(),
  hosted = HOSTED,
): Standing {
  if (!hosted || !band.paidUntil) return {kind: 'free'}
  const until = band.paidUntil
  if (until <= now) return {kind: 'lapsed', since: until}
  if (!band.polarSubscriptionId)
    return {
      kind: 'trial',
      until,
      daysLeft: Math.ceil((until.getTime() - now.getTime()) / DAY),
    }
  return {kind: 'paid', until, status: band.subscriptionStatus ?? null}
}

/** When a band started now stops being free. */
export function trialEnd(now = new Date()) {
  return new Date(now.getTime() + TRIAL_DAYS * DAY)
}

export function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * DAY)
}

export const READ_ONLY_MESSAGE =
  'This band’s Bandstand subscription has ended, so it’s read-only. An admin can renew it on the Admin page.'
