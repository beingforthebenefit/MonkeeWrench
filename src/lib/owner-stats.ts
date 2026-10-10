import {standing, TRIAL_DAYS} from './hosted'

/**
 * The owner's numbers for the hosted service, from the bands' billing
 * fields alone (Polar has the actual money: these are what the app can
 * know). Pure, so every definition is tested; the page gathers the rows.
 */

/** What the service costs to run, a month (server, backups, domain) */
export const MONTHLY_COSTS_USD = 11
export const PRICE_USD = 12
/** What a $12 yearly payment leaves after Polar: 5% + 50¢ */
export const NET_PER_PAYMENT_USD = PRICE_USD * 0.95 - 0.5

export type StatsBand = {
  id: string
  createdAt: Date
  paidUntil: Date | null
  polarSubscriptionId: string | null
  subscriptionStatus: string | null
  trialStartedAt: Date | null
  lastActivity: Date | null
}

const DAY = 24 * 60 * 60 * 1000

export function ownerStats(bands: StatsBand[], now = new Date()) {
  const by = {trial: 0, paying: 0, cancelled: 0, lapsed: 0, free: 0}
  for (const b of bands) {
    const s = standing(b, now, true)
    if (s.kind === 'free') by.free++
    else if (s.kind === 'trial') by.trial++
    else if (s.kind === 'lapsed') by.lapsed++
    else if (s.status === 'canceling' || s.status === 'canceled') by.cancelled++
    else by.paying++
  }

  // Trials: bands that started on one. Decided: subscribed, or the trial
  // ran out (30 days on). Converted: ever subscribed.
  const trials = bands.filter((b) => b.trialStartedAt)
  const decided = trials.filter(
    (b) =>
      b.polarSubscriptionId ||
      now.getTime() - b.trialStartedAt!.getTime() > TRIAL_DAYS * DAY,
  )
  const converted = trials.filter((b) => b.polarSubscriptionId)

  // Subscriptions that ended for good (not a card being retried)
  const subscribed = bands.filter((b) => b.polarSubscriptionId)
  const ended = subscribed.filter(
    (b) => b.paidUntil && b.paidUntil <= now,
  ).length

  const yearlyGross = by.paying * PRICE_USD
  const yearlyNet = by.paying * NET_PER_PAYMENT_USD
  const yearlyCosts = MONTHLY_COSTS_USD * 12
  const toBreakEven = Math.ceil(yearlyCosts / NET_PER_PAYMENT_USD)

  // Sign-ups per week, the last 12 weeks, oldest first
  const weeks = Array.from({length: 12}, (_, i) => {
    const end = new Date(now.getTime() - (11 - i) * 7 * DAY)
    const start = new Date(end.getTime() - 7 * DAY)
    return {
      start,
      count: trials.filter(
        (b) => b.trialStartedAt! > start && b.trialStartedAt! <= end,
      ).length,
    }
  })

  return {
    bands: bands.length,
    by,
    active30: bands.filter(
      (b) =>
        b.lastActivity && now.getTime() - b.lastActivity.getTime() < 30 * DAY,
    ).length,
    trials: {
      started: trials.length,
      decided: decided.length,
      converted: converted.length,
      rate: decided.length ? converted.length / decided.length : null,
    },
    churn: {
      subscribed: subscribed.length,
      ended,
      rate: subscribed.length ? ended / subscribed.length : null,
    },
    money: {
      yearlyGross,
      yearlyNet,
      yearlyCosts,
      toBreakEven,
    },
    renewalsNext30: subscribed.filter(
      (b) =>
        b.paidUntil &&
        b.paidUntil > now &&
        b.paidUntil.getTime() - now.getTime() < 30 * DAY &&
        b.subscriptionStatus !== 'canceling',
    ).length,
    weeks,
  }
}

export type OwnerStats = ReturnType<typeof ownerStats>
