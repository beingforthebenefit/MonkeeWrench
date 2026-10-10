import {beforeEach, describe, expect, it, vi} from 'vitest'

const h = vi.hoisted(() => ({
  sendPasswordLink: vi.fn(async (_o: unknown) => {}),
  user: {} as any,
}))
vi.mock('@/lib/guard', () => ({
  requireOwner: async () => ({user: {displayName: 'Gerald'}}),
}))
vi.mock('@/lib/band', () => ({requestOrigin: () => 'https://app.test'}))
vi.mock('@/lib/mail', () => ({mailConfigured: () => true}))
vi.mock('@/lib/email-tokens', () => ({sendPasswordLink: h.sendPasswordLink}))
vi.mock('@/lib/db', () => ({
  prisma: {user: {findUnique: async () => h.user}},
}))

import {POST} from '@/app/api/owner/users/[id]/reset/route'

const post = (body: unknown) =>
  new Request('http://t/x', {method: 'POST', body: JSON.stringify(body)})

describe('POST /api/owner/users/:id/reset', () => {
  beforeEach(() => {
    h.sendPasswordLink.mockClear()
    h.user = {
      id: 'ed',
      email: 'ed@example.com',
      passwordHash: 'x',
      memberships: [{band: {name: 'Monkee Business'}}],
    }
  })

  it('invites one person to their band, from the owner, even with a password', async () => {
    const res = await POST(post({kind: 'invite'}), {params: {id: 'ed'}})
    expect(await res.json()).toEqual({sent: 'ed@example.com', kind: 'invite'})
    expect(h.sendPasswordLink).toHaveBeenCalledTimes(1)
    expect(h.sendPasswordLink).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'ed',
        email: 'ed@example.com',
        kind: 'INVITE',
        bandName: 'Monkee Business',
        by: 'Gerald',
      }),
    )
  })

  it('sends a reset when asked, and by default', async () => {
    await POST(post({}), {params: {id: 'ed'}})
    expect(h.sendPasswordLink.mock.calls[0][0]).toMatchObject({kind: 'RESET'})
  })
})
