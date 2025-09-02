import {describe, it, expect, vi, beforeEach} from 'vitest'

let prisma: any
let lastTx: any

vi.mock('@/lib/db', () => ({
  get prisma() {
    return prisma
  },
}))
vi.mock('@/lib/guard', () => ({
  requireAdmin: vi.fn(async () => ({id: 'admin1'})),
}))

describe('/api/proposals/[id] routes', () => {
  beforeEach(() => {
    prisma = {
      proposal: {update: vi.fn(), delete: vi.fn(), findUnique: vi.fn()},
      auditLog: {create: vi.fn()},
      $transaction: vi.fn(async (fn: any) => {
        // Provide a tx with auditLog and proposal
        const tx = {
          auditLog: {create: vi.fn()},
          proposal: {delete: vi.fn(), update: vi.fn()},
        }
        lastTx = tx
        await fn(tx)
      }),
    }
  })

  it('PATCH validates body', async () => {
    const {PATCH} = await import('@/app/api/proposals/[id]/route')
    const req = new Request('http://x', {
      method: 'PATCH',
      body: JSON.stringify({status: 'NOPE'}),
    })
    const res = await PATCH(req, {params: {id: 'p1'}})
    expect(res.status).toBe(400)
  })

  it('PATCH updates proposal', async () => {
    const {PATCH} = await import('@/app/api/proposals/[id]/route')
    const req = new Request('http://x', {
      method: 'PATCH',
      body: JSON.stringify({title: 'New'}),
    })
    const res = await PATCH(req, {params: {id: 'p1'}})
    expect(res.status).toBe(204)
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(lastTx.proposal.update).toHaveBeenCalledWith({
      where: {id: 'p1'},
      data: {title: 'New'},
    })
  })

  it('DELETE audits and deletes', async () => {
    const {DELETE} = await import('@/app/api/proposals/[id]/route')
    const res = await DELETE(new Request('http://x'), {params: {id: 'p1'}})
    expect(res.status).toBe(204)
    expect(prisma.$transaction).toHaveBeenCalled()
  })

  it('GET returns a single proposal', async () => {
    const {GET} = await import('@/app/api/proposals/[id]/route')
    prisma.proposal.findUnique.mockResolvedValueOnce({
      id: 'p1',
      title: 'T',
      artist: 'A',
      chartUrl: null,
      lyricsUrl: 'https://l',
      youtubeUrl: null,
      status: 'PENDING',
    })
    const res = await GET(new Request('http://x'), {params: {id: 'p1'}})
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({id: 'p1', title: 'T', artist: 'A'})
  })
})
