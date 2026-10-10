import {beforeEach, describe, expect, it, vi} from 'vitest'

const h = vi.hoisted(() => ({prisma: {} as any, user: {} as any}))
vi.mock('@/lib/db', () => ({
  get prisma() {
    return h.prisma
  },
}))
vi.mock('@/lib/guard', () => ({
  requireAdmin: async () => ({
    user: h.user,
    band: {id: 'b1', name: 'The Reeds'},
  }),
  requireSession: async () => ({}),
  requireUser: async () => ({user: h.user}),
}))
vi.mock('@/lib/songs', () => ({logActivity: vi.fn()}))

import {DELETE as deleteBand} from '@/app/api/band/route'
import {DELETE as deleteAccount} from '@/app/api/account/route'

const del = (confirm: string) =>
  new Request('http://t/x', {method: 'DELETE', body: JSON.stringify({confirm})})

const membership = (
  id: string,
  name: string,
  isAdmin: boolean,
  people: [string, boolean][],
) => ({
  isAdmin,
  band: {
    id,
    name,
    memberships: people.map(([userId, admin]) => ({userId, isAdmin: admin})),
  },
})

describe('deleting a band', () => {
  beforeEach(() => {
    h.user = {id: 'u1'}
    h.prisma = {
      band: {
        findUnique: vi.fn(async () => ({
          polarSubscriptionId: null,
          subscriptionStatus: null,
        })),
        delete: vi.fn(async () => ({})),
      },
    }
  })

  it('needs the band’s exact name', async () => {
    expect((await deleteBand(del('the reeds'))).status).toBe(400)
    expect(h.prisma.band.delete).not.toHaveBeenCalled()
    expect((await deleteBand(del('The Reeds'))).status).toBe(204)
    expect(h.prisma.band.delete).toHaveBeenCalledWith({where: {id: 'b1'}})
  })

  it('not while a subscription is still running', async () => {
    h.prisma.band.findUnique.mockResolvedValue({
      polarSubscriptionId: 's1',
      subscriptionStatus: 'active',
    })
    const res = await deleteBand(del('The Reeds'))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/Cancel the subscription/)
    expect(h.prisma.band.delete).not.toHaveBeenCalled()
  })

  it('fine once it’s cancelled', async () => {
    h.prisma.band.findUnique.mockResolvedValue({
      polarSubscriptionId: 's1',
      subscriptionStatus: 'canceling',
    })
    expect((await deleteBand(del('The Reeds'))).status).toBe(204)
  })
})

describe('deleting your account', () => {
  beforeEach(() => {
    h.user = {id: 'u1', email: 'ana@example.com', isOwner: false}
    h.prisma = {
      membership: {findMany: vi.fn(async () => [])},
      band: {deleteMany: vi.fn((a: unknown) => ({deleteMany: a}))},
      user: {delete: vi.fn((a: unknown) => ({delete: a}))},
      $transaction: vi.fn(async (ops: unknown[]) => ops),
    }
  })

  it('needs your email typed', async () => {
    expect((await deleteAccount(del('nope'))).status).toBe(400)
    expect(h.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('not while you’re the last admin of a band with others in it', async () => {
    h.prisma.membership.findMany.mockResolvedValue([
      membership('b1', 'The Reeds', true, [
        ['u1', true],
        ['u2', false],
      ]),
    ])
    const res = await deleteAccount(del('Ana@Example.com'))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/only admin of The Reeds/)
  })

  it('takes the bands you’re alone in with you, and nothing else', async () => {
    h.prisma.membership.findMany.mockResolvedValue([
      membership('solo', 'Just Me', true, [['u1', true]]),
      membership('b2', 'Shared', true, [
        ['u1', true],
        ['u2', true],
      ]),
      membership('b3', 'Theirs', false, [
        ['u1', false],
        ['u3', true],
      ]),
    ])
    expect((await deleteAccount(del('ana@example.com'))).status).toBe(204)
    expect(h.prisma.band.deleteMany).toHaveBeenCalledWith({
      where: {id: {in: ['solo']}},
    })
    expect(h.prisma.user.delete).toHaveBeenCalledWith({where: {id: 'u1'}})
  })

  it('never the owner', async () => {
    h.user.isOwner = true
    expect((await deleteAccount(del('ana@example.com'))).status).toBe(400)
  })
})
