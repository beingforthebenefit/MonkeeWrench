import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

let prisma: any
let method: string | null

vi.mock('@/lib/db', () => ({
  get prisma() {
    return prisma
  },
}))
vi.mock('next-auth', () => ({
  getServerSession: async () => ({user: {email: 'x@example.com'}}),
}))
vi.mock('next/headers', () => ({
  cookies: () => ({get: () => undefined}),
  headers: () => new Headers(method ? {'x-request-method': method} : undefined),
}))

const band = {
  id: 'b1',
  slug: 'b1',
  name: 'B',
  appName: 'Bandstand',
  timezone: 'UTC',
  chatUrl: null,
  tributeTo: null,
  voteThreshold: 2,
  scheduling: true,
  iconAt: null,
}

async function guard(hosted: boolean) {
  vi.resetModules()
  vi.stubEnv('BANDSTAND_HOSTED', hosted ? '1' : '')
  return import('@/lib/guard')
}

const yesterday = new Date(Date.now() - 86400000)

describe('a lapsed band on the hosted service is read-only', () => {
  beforeEach(() => {
    method = 'POST'
    prisma = {
      user: {findUnique: vi.fn().mockResolvedValue({id: 'u1', isOwner: false})},
      membership: {
        findMany: vi.fn().mockResolvedValue([{isAdmin: true, band}]),
      },
      band: {
        findUnique: vi
          .fn()
          .mockResolvedValue({paidUntil: yesterday, polarSubscriptionId: null}),
      },
    }
  })
  afterEach(() => vi.unstubAllEnvs())

  it('refuses a change with 402 and says why', async () => {
    const {requireSession} = await guard(true)
    const res = await requireSession().catch((e) => e)
    expect(res).toBeInstanceOf(Response)
    expect(res.status).toBe(402)
    expect((await res.json()).error).toMatch(/read-only/)
  })

  it('still reads', async () => {
    method = 'GET'
    const {requireSession} = await guard(true)
    await expect(requireSession()).resolves.toMatchObject({band: {id: 'b1'}})
  })

  it('still lets an admin renew', async () => {
    const {requireAdmin} = await guard(true)
    await expect(requireAdmin({allowLapsed: true})).resolves.toMatchObject({
      isAdmin: true,
    })
  })

  it('lets a band in its trial or paid up make changes', async () => {
    prisma.band.findUnique.mockResolvedValue({
      paidUntil: new Date(Date.now() + 86400000),
      polarSubscriptionId: null,
    })
    const {requireSession} = await guard(true)
    await expect(requireSession()).resolves.toBeTruthy()
  })

  it('never applies to a self-hosted install', async () => {
    const {requireSession} = await guard(false)
    await expect(requireSession()).resolves.toBeTruthy()
    expect(prisma.band.findUnique).not.toHaveBeenCalled()
  })
})
