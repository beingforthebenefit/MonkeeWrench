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
  EVENTS: {
    PROPOSAL_CREATED: 'proposal.created',
    PROPOSAL_UPDATED: 'proposal.updated',
  },
}))

describe('/api/proposals route', () => {
  beforeEach(() => {
    prisma = {
      auditLog: {count: vi.fn().mockResolvedValue(0), create: vi.fn()},
      proposal: {create: vi.fn(), findMany: vi.fn()},
    }
  })

  it('POST creates proposal and emits event', async () => {
    const {POST} = await import('@/app/api/proposals/route')
    prisma.proposal.create.mockResolvedValue({id: 'p1'})
    const req = new Request('http://test.local/api/proposals', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Song',
        artist: 'The Monkees',
        chartUrl: 'https://example.com',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({id: 'p1'})
  })

  it('POST enforces per-user rate limit', async () => {
    const {POST} = await import('@/app/api/proposals/route')
    prisma.auditLog.count.mockResolvedValue(10)
    const req = new Request('http://test.local/api/proposals', {
      method: 'POST',
      body: JSON.stringify({title: 'X', artist: 'Y'}),
    })
    const res = await POST(req)
    expect(res.status).toBe(429)
  })

  it('GET returns proposals list', async () => {
    const {GET} = await import('@/app/api/proposals/route')
    prisma.proposal.findMany.mockResolvedValue([{id: 'p1'}])
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual([{id: 'p1'}])
  })
})
