import {beforeEach, describe, expect, it, vi} from 'vitest'

const h = vi.hoisted(() => ({
  owner: true as boolean,
  sendMail: vi.fn(async (_m: unknown) => {}),
}))
vi.mock('@/lib/guard', () => ({
  requireOwner: async () => {
    if (!h.owner) throw new Response('Forbidden', {status: 403})
    return {user: {email: 'owner@example.com', displayName: 'Gerald'}}
  },
}))
vi.mock('@/lib/band', () => ({
  requestOrigin: () => 'https://app.test',
  PRODUCT: 'Bandstand',
}))
vi.mock('@/lib/mail', () => ({
  mailConfigured: () => true,
  sendMail: h.sendMail,
}))
vi.mock('@/lib/db', () => ({prisma: {}}))

import {POST} from '@/app/api/owner/test-email/route'

describe('POST /api/owner/test-email', () => {
  beforeEach(() => {
    h.owner = true
    h.sendMail.mockClear()
  })

  it('sends one of each email, to the owner only, marked [Test]', async () => {
    const res = await POST()
    expect(await res.json()).toEqual({sent: 3, to: 'owner@example.com'})
    const mails = h.sendMail.mock.calls.map((c) => c[0] as any)
    expect(mails.map((m) => m.to)).toEqual(Array(3).fill('owner@example.com'))
    expect(mails.every((m) => m.subject.startsWith('[Test] '))).toBe(true)
    expect(mails.every((m) => m.html.includes('BANDSTAND'))).toBe(true)
  })

  it('is for the owner alone', async () => {
    h.owner = false
    expect((await POST()).status).toBe(403)
    expect(h.sendMail).not.toHaveBeenCalled()
  })
})
