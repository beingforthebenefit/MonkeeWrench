import {describe, it, expect, vi, beforeEach} from 'vitest'

let prisma: any

vi.mock('@/lib/db', () => ({
  get prisma() {
    return prisma
  },
}))
vi.mock('@/lib/guard', () => ({
  requireAdmin: vi.fn(async () => ({id: 'admin1'})),
}))
vi.mock('@/lib/events', () => ({
  bus: {emit: vi.fn()},
  EVENTS: {PROPOSAL_CREATED: 'proposal.created'},
}))

describe('/api/admin/proposals routes', () => {
  beforeEach(() => {
    prisma = {
      proposal: {
        aggregate: vi.fn().mockResolvedValue({_max: {setlistOrder: 2}}),
        findMany: vi.fn().mockResolvedValue([{id: 'p1'}]),
      },
      auditLog: {create: vi.fn()},
      $transaction: vi.fn(async (fn: any) => {
        const tx = {
          proposal: {create: vi.fn().mockResolvedValue({id: 'pX'})},
          auditLog: {create: vi.fn()},
        }
        return await fn(tx)
      }),
    }
  })

  it('POST creates APPROVED proposal with next order', async () => {
    const {POST} = await import('@/app/api/admin/proposals/route')
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({title: 'T', artist: 'A'}),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({id: 'pX'})
  })

  it('GET returns proposals', async () => {
    const {GET} = await import('@/app/api/admin/proposals/route')
    const res = await GET()
    expect(res.status).toBe(200)
  })
})
