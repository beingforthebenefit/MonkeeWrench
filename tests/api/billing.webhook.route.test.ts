import {beforeEach, describe, expect, it, vi} from 'vitest'

const hoisted = vi.hoisted(() => ({
  applySubscription: vi.fn(async (_sub: unknown) => 'b1'),
  readWebhook: async (body: string): Promise<unknown> => JSON.parse(body),
}))
const {applySubscription} = hoisted
const created = vi.hoisted(() => vi.fn(async (_a: unknown) => ({})))
vi.mock('@/lib/db', () => ({prisma: {billingEvent: {create: created}}}))
vi.mock('@/lib/billing', () => ({
  applySubscription: hoisted.applySubscription,
  readWebhook: (body: string) => hoisted.readWebhook(body),
}))

import {POST} from '@/app/api/billing/webhook/route'

const post = (body: unknown) =>
  new Request('http://t/api/billing/webhook', {
    method: 'POST',
    body: JSON.stringify(body),
  })

describe('POST /api/billing/webhook', () => {
  beforeEach(() => {
    process.env.POLAR_WEBHOOK_SECRET = 'whsec_x'
    applySubscription.mockClear()
    hoisted.readWebhook = async (body) => JSON.parse(body)
  })

  it('records a subscription change', async () => {
    const data = {id: 'sub_1', status: 'active'}
    const res = await POST(post({type: 'subscription.updated', data}))
    expect(res.status).toBe(202)
    expect(applySubscription).toHaveBeenCalledWith(data)
    // …and keeps it in the owner's history
    expect(created).toHaveBeenCalledWith({
      data: {
        bandId: 'b1',
        type: 'subscription.updated',
        status: 'active',
        subscriptionId: 'sub_1',
      },
    })
  })

  it('accepts and ignores other events', async () => {
    const res = await POST(post({type: 'order.paid', data: {}}))
    expect(res.status).toBe(202)
    expect(applySubscription).not.toHaveBeenCalled()
  })

  it('refuses an unsigned or forged request', async () => {
    hoisted.readWebhook = async () => {
      throw new Error('bad signature')
    }
    const res = await POST(post({type: 'subscription.active', data: {}}))
    expect(res.status).toBe(403)
    expect(applySubscription).not.toHaveBeenCalled()
  })
})
