import {createHmac} from 'crypto'
import {beforeEach, describe, expect, it, vi} from 'vitest'

let prisma: any
vi.mock('@/lib/db', () => ({
  get prisma() {
    return prisma
  },
}))

import {
  applySubscription,
  paidUntilFor,
  readWebhook,
  type PolarSubscription,
} from '@/lib/billing'

const now = new Date('2026-10-09T12:00:00Z')
const sub = (over: Partial<PolarSubscription> = {}): PolarSubscription => ({
  id: 'sub_1',
  status: 'active',
  current_period_end: '2027-10-09T12:00:00Z',
  cancel_at_period_end: false,
  ends_at: null,
  ended_at: null,
  customer_id: 'cus_1',
  checkout_id: 'chk_1',
  metadata: {band_id: 'b1'},
  ...over,
})

describe('how long a subscription keeps a band editable', () => {
  it('active: to the end of the year paid for, plus a week while a renewal retries', () => {
    expect(paidUntilFor(sub(), now)).toEqual(new Date('2027-10-16T12:00:00Z'))
  })

  it('past due: the same, while Polar retries the card', () => {
    expect(paidUntilFor(sub({status: 'past_due'}), now)).toEqual(
      new Date('2027-10-16T12:00:00Z'),
    )
  })

  it('cancelled for the end of the period: to that end, no grace', () => {
    expect(
      paidUntilFor(
        sub({cancel_at_period_end: true, ends_at: '2027-10-09T12:00:00Z'}),
        now,
      ),
    ).toEqual(new Date('2027-10-09T12:00:00Z'))
  })

  it('ended: when it ended', () => {
    expect(
      paidUntilFor(
        sub({status: 'canceled', ended_at: '2026-10-01T00:00:00Z'}),
        now,
      ),
    ).toEqual(new Date('2026-10-01T00:00:00Z'))
    expect(paidUntilFor(sub({status: 'unpaid'}), now)).toEqual(now)
  })

  it('a checkout still being paid says nothing yet', () => {
    expect(paidUntilFor(sub({status: 'incomplete'}), now)).toBeUndefined()
  })
})

describe('recording a subscription', () => {
  beforeEach(() => {
    prisma = {
      band: {
        findUnique: vi.fn().mockResolvedValue({id: 'b1'}),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
      },
    }
  })

  it('finds the band from the checkout’s metadata and records it', async () => {
    expect(await applySubscription(sub(), now)).toBe('b1')
    expect(prisma.band.update).toHaveBeenCalledWith({
      where: {id: 'b1'},
      data: {
        polarSubscriptionId: 'sub_1',
        polarCustomerId: 'cus_1',
        subscriptionStatus: 'active',
        paidUntil: new Date('2027-10-16T12:00:00Z'),
      },
    })
  })

  it('without metadata, finds it by subscription or checkout', async () => {
    prisma.band.findFirst.mockResolvedValue({id: 'b2'})
    expect(await applySubscription(sub({metadata: {}}), now)).toBe('b2')
    expect(prisma.band.findFirst.mock.calls[0][0].where.OR).toEqual([
      {polarSubscriptionId: 'sub_1'},
      {polarCheckoutId: 'chk_1'},
    ])
  })

  it('ignores a subscription for no band here', async () => {
    prisma.band.findUnique.mockResolvedValue(null)
    expect(await applySubscription(sub(), now)).toBeNull()
    expect(prisma.band.update).not.toHaveBeenCalled()
  })

  it('leaves the date and status alone while a checkout is unpaid', async () => {
    await applySubscription(sub({status: 'incomplete'}), now)
    expect(prisma.band.update.mock.calls[0][0].data).toEqual({
      polarSubscriptionId: 'sub_1',
      polarCustomerId: 'cus_1',
    })
  })
})

describe('webhooks', () => {
  // A Standard Webhooks secret, as Polar issues them now
  const key = Buffer.from('a-test-signing-key-32-bytes-long')
  const secret = 'whsec_' + key.toString('base64')

  function signed(body: string, signWith = key) {
    const id = 'msg_1'
    const ts = String(Math.floor(Date.now() / 1000))
    const sig = createHmac('sha256', signWith)
      .update(`${id}.${ts}.${body}`)
      .digest('base64')
    return new Headers({
      'webhook-id': id,
      'webhook-timestamp': ts,
      'webhook-signature': `v1,${sig}`,
    })
  }

  const body = JSON.stringify({
    type: 'subscription.active',
    timestamp: new Date().toISOString(),
    data: {
      ...sub(),
      created_at: new Date().toISOString(),
      modified_at: null,
    },
  })

  beforeEach(() => {
    process.env.POLAR_WEBHOOK_SECRET = secret
  })

  it('accepts one signed with the secret', async () => {
    const event = await readWebhook(body, signed(body))
    expect(event.type).toBe('subscription.active')
    expect((event.data as {metadata: unknown}).metadata).toEqual({
      band_id: 'b1',
    })
  })

  it('refuses one signed with anything else', async () => {
    await expect(
      readWebhook(body, signed(body, Buffer.from('some-other-key'))),
    ).rejects.toThrow()
  })

  it('refuses one that was changed after signing', async () => {
    await expect(
      readWebhook(body.replace('b1', 'b2'), signed(body)),
    ).rejects.toThrow()
  })
})
