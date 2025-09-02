import {describe, it, expect, vi, beforeEach} from 'vitest'

let prisma: any

vi.mock('@/lib/db', () => ({
  get prisma() {
    return prisma
  },
}))
vi.mock('@/lib/guard', () => ({
  requireSession: vi.fn(async () => ({user: {id: 'u1'}})),
}))
vi.mock('@/lib/events', () => ({
  bus: {emit: vi.fn()},
  EVENTS: {PROPOSAL_UPDATED: 'proposal.updated'},
}))

describe('/api/proposals/[id]/vote routes', () => {
  beforeEach(() => {
    prisma = {
      $transaction: vi.fn(async (fn: any) => {
        const tx: any = {
          vote: {
            create: vi.fn().mockResolvedValue({}),
            delete: vi.fn().mockResolvedValue({}),
            count: vi.fn().mockResolvedValue(1),
          },
          auditLog: {create: vi.fn()},
          settings: {findUnique: vi.fn().mockResolvedValue({voteThreshold: 2})},
          proposal: {
            findUnique: vi
              .fn()
              .mockResolvedValue({id: 'p1', status: 'PENDING'}),
            update: vi.fn(),
          },
        }
        await fn(tx)
      }),
    }
  })

  it('POST casts a vote', async () => {
    const {POST} = await import('@/app/api/proposals/[id]/vote/route')
    const res = await POST(new Request('http://x'), {params: {id: 'p1'}})
    expect(res.status).toBe(204)
    expect(prisma.$transaction).toHaveBeenCalled()
  })

  it('POST returns 409 on duplicate', async () => {
    prisma = {
      $transaction: vi.fn(async (_fn: any) => {
        throw new Error('unique violation')
      }),
    }
    const {POST} = await import('@/app/api/proposals/[id]/vote/route')
    const res = await POST(new Request('http://x'), {params: {id: 'p1'}})
    expect(res.status).toBe(409)
  })

  it('DELETE removes a vote', async () => {
    const {DELETE} = await import('@/app/api/proposals/[id]/vote/route')
    const res = await DELETE(new Request('http://x'), {params: {id: 'p1'}})
    expect(res.status).toBe(204)
  })
})
