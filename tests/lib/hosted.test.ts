import {describe, expect, it} from 'vitest'
import {standing, trialEnd, TRIAL_DAYS} from '@/lib/hosted'

const now = new Date('2026-10-09T12:00:00Z')
const days = (n: number) => new Date(now.getTime() + n * 86400000)

describe('a band’s standing on the hosted service', () => {
  it('is free on a self-hosted install, whatever the band says', () => {
    expect(standing({paidUntil: days(-5)}, now, false)).toEqual({kind: 'free'})
  })

  it('is free with no paid-until date (comped)', () => {
    expect(standing({paidUntil: null}, now, true)).toEqual({kind: 'free'})
  })

  it('is a trial until someone subscribes, counting whole days left', () => {
    expect(standing({paidUntil: days(2.5)}, now, true)).toMatchObject({
      kind: 'trial',
      daysLeft: 3,
    })
  })

  it('is paid with a subscription', () => {
    expect(
      standing(
        {
          paidUntil: days(300),
          polarSubscriptionId: 's1',
          subscriptionStatus: 'active',
        },
        now,
        true,
      ),
    ).toMatchObject({kind: 'paid', status: 'active'})
  })

  it('is lapsed once the date has passed, with or without a subscription', () => {
    expect(standing({paidUntil: days(-1)}, now, true).kind).toBe('lapsed')
    expect(
      standing({paidUntil: now, polarSubscriptionId: 's1'}, now, true).kind,
    ).toBe('lapsed')
  })

  it('starts a trial of TRIAL_DAYS', () => {
    expect(trialEnd(now)).toEqual(days(TRIAL_DAYS))
  })
})
