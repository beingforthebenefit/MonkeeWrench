import {describe, it, expect, vi, beforeEach} from 'vitest'

let prisma: any
let getServerSession: any

vi.mock('@/lib/db', () => ({
  get prisma() {
    return prisma
  },
}))

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSession?.(...args),
}))

describe('lib/guard', () => {
  beforeEach(() => {
    prisma = {user: {findUnique: vi.fn()}}
    getServerSession = vi.fn()
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
    getServerSession.mockResolvedValue({user: {email: 'x@example.com'}})
    prisma.user.findUnique.mockResolvedValue(null)
    await expect(requireSession()).rejects.toMatchObject({status: 401})
  })

  it('requireAdmin rejects non-admin', async () => {
    const {requireAdmin} = await import('@/lib/guard')
    getServerSession.mockResolvedValue({user: {email: 'x@example.com'}})
    prisma.user.findUnique = vi
      .fn()
      .mockResolvedValue({id: 'u1', isAdmin: false})
    await expect(requireAdmin()).rejects.toMatchObject({status: 403})
  })

  it('requireAdmin returns admin', async () => {
    const {requireAdmin} = await import('@/lib/guard')
    getServerSession.mockResolvedValue({user: {email: 'a@example.com'}})
    const admin = {id: 'a1', isAdmin: true}
    prisma.user.findUnique.mockResolvedValue(admin)
    const res = await requireAdmin()
    expect(res).toEqual(admin)
  })
})
