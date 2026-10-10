import {describe, expect, it} from 'vitest'
import {
  NET_PER_PAYMENT_USD,
  ownerStats,
  type StatsBand,
} from '@/lib/owner-stats'

const now = new Date('2026-12-01T12:00:00Z')
const days = (n: number) => new Date(now.getTime() + n * 86400000)
let n = 0
const band = (over: Partial<StatsBand>): StatsBand => ({
  id: `b${n++}`,
  createdAt: days(-100),
  paidUntil: null,
  polarSubscriptionId: null,
  subscriptionStatus: null,
  trialStartedAt: null,
  lastActivity: null,
  ...over,
})

describe('the owner’s numbers', () => {
  const bands = [
    band({}), // free (comped, self-made)
    band({trialStartedAt: days(-5), paidUntil: days(25)}), // in trial
    band({trialStartedAt: days(-40), paidUntil: days(-10)}), // trial ran out
    band({
      trialStartedAt: days(-60),
      paidUntil: days(300),
      polarSubscriptionId: 's1',
      subscriptionStatus: 'active',
      lastActivity: days(-2),
    }), // converted, paying
    band({
      trialStartedAt: days(-200),
      paidUntil: days(20),
      polarSubscriptionId: 's2',
      subscriptionStatus: 'canceling',
    }), // cancelled, still paid; renews? no
    band({
      paidUntil: days(-3),
      polarSubscriptionId: 's3',
      subscriptionStatus: 'canceled',
    }), // ended
    band({
      paidUntil: days(10),
      polarSubscriptionId: 's4',
      subscriptionStatus: 'active',
      lastActivity: days(-40),
    }), // paying, renews within 30 days
  ]
  const s = ownerStats(bands, now)

  it('sorts bands by standing', () => {
    expect(s.by).toEqual({
      trial: 1,
      paying: 2,
      cancelled: 1,
      lapsed: 2,
      free: 1,
    })
  })

  it('counts a trial as decided once subscribed or 30 days old', () => {
    // started: 4; decided: ran out + converted + cancelled; converted: 2
    expect(s.trials).toMatchObject({started: 4, decided: 3, converted: 2})
    expect(s.trials.rate).toBeCloseTo(2 / 3)
  })

  it('churn: subscriptions whose paid time has run out', () => {
    expect(s.churn).toMatchObject({subscribed: 4, ended: 1})
  })

  it('money: paying bands, before and after Polar, against the costs', () => {
    expect(s.money.yearlyGross).toBe(24)
    expect(s.money.yearlyNet).toBeCloseTo(2 * NET_PER_PAYMENT_USD)
    expect(s.money.toBreakEven).toBe(13)
  })

  it('renewals due soon leave out cancelled ones', () => {
    expect(s.renewalsNext30).toBe(1)
  })

  it('activity and sign-ups', () => {
    expect(s.active30).toBe(1)
    expect(s.weeks).toHaveLength(12)
    expect(s.weeks.at(-1)?.count).toBe(1) // started 5 days ago
  })
})
