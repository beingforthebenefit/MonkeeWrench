import {describe, it, expect, vi, beforeEach} from 'vitest'

let prisma: any
let getServerSession: any
let cookie: string | undefined

vi.mock('@/lib/db', () => ({
  get prisma() {
    return prisma
  },
}))

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSession?.(...args),
}))

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) =>
      name === 'ms_band' && cookie ? {value: cookie} : undefined,
  }),
  headers: () => new Headers(),
}))

const band = (id: string) => ({
  id,
  slug: id,
  name: id,
  appName: 'Bandstand',
  timezone: 'America/Los_Angeles',
  chatUrl: null,
  tributeTo: null,
  voteThreshold: 2,
  scheduling: true,
  iconAt: null,
})

function memberOf(...rows: {id: string; isAdmin?: boolean}[]) {
  prisma.membership.findMany.mockResolvedValue(
    rows.map((r) => ({isAdmin: Boolean(r.isAdmin), band: band(r.id)})),
  )
}

describe('lib/guard', () => {
  beforeEach(() => {
    cookie = undefined
    prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({id: 'u1', isOwner: false}),
      },
      membership: {findMany: vi.fn().mockResolvedValue([])},
    }
    getServerSession = vi
      .fn()
      .mockResolvedValue({user: {email: 'x@example.com'}})
    process.env.GOOGLE_CLIENT_ID = 'test-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret'
  })

  it('requireSession rejects when no session', async () => {
    const {requireSession} = await import('@/lib/guard')
    getServerSession.mockResolvedValue(null)
    await expect(requireSession()).rejects.toMatchObject({status: 401})
  })

  it('requireSession rejects when user not found', async () => {
    const {requireSession} = await import('@/lib/guard')
    prisma.user.findUnique.mockResolvedValue(null)
    await expect(requireSession()).rejects.toMatchObject({status: 401})
  })

  it('someone in one band is always in it', async () => {
    const {requireSession} = await import('@/lib/guard')
    memberOf({id: 'b1'})
    cookie = 'some-other-band'
    const ctx = await requireSession()
    expect(ctx.band.id).toBe('b1')
    expect(ctx.isAdmin).toBe(false)
  })

  it('someone in several bands must pick one first (409)', async () => {
    const {requireSession} = await import('@/lib/guard')
    memberOf({id: 'b1'}, {id: 'b2'})
    await expect(requireSession()).rejects.toMatchObject({status: 409})
  })

  it('the picked band is the one on screen', async () => {
    const {requireSession} = await import('@/lib/guard')
    memberOf({id: 'b1'}, {id: 'b2'})
    cookie = 'b2'
    expect((await requireSession()).band.id).toBe('b2')
  })

  it("a cookie naming a band you're not in counts for nothing", async () => {
    const {requireSession} = await import('@/lib/guard')
    memberOf({id: 'b1'}, {id: 'b2'})
    cookie = 'b3'
    await expect(requireSession()).rejects.toMatchObject({status: 409})
  })

  it('someone in no band gets 409, not data', async () => {
    const {requireSession} = await import('@/lib/guard')
    memberOf()
    await expect(requireSession()).rejects.toMatchObject({status: 409})
  })

  it('requireAdmin rejects an admin of a different band', async () => {
    const {requireAdmin} = await import('@/lib/guard')
    memberOf({id: 'b1', isAdmin: true}, {id: 'b2'})
    cookie = 'b2'
    await expect(requireAdmin()).rejects.toMatchObject({status: 403})
  })

  it('requireAdmin passes an admin of this band', async () => {
    const {requireAdmin} = await import('@/lib/guard')
    memberOf({id: 'b1', isAdmin: true}, {id: 'b2'})
    cookie = 'b1'
    const ctx = await requireAdmin()
    expect(ctx.user.id).toBe('u1')
    expect(ctx.band.id).toBe('b1')
  })

  it('the install owner is an admin of any band they are in', async () => {
    const {requireAdmin, requireOwner} = await import('@/lib/guard')
    prisma.user.findUnique.mockResolvedValue({id: 'u1', isOwner: true})
    memberOf({id: 'b1'})
    expect((await requireAdmin()).isAdmin).toBe(true)
    expect((await requireOwner()).user.id).toBe('u1')
  })

  it('requireOwner rejects everyone else', async () => {
    const {requireOwner} = await import('@/lib/guard')
    await expect(requireOwner()).rejects.toMatchObject({status: 403})
  })
})
