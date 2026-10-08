import {describe, it, expect, vi, beforeEach} from 'vitest'

let prisma: any

vi.mock('@/lib/db', () => ({
  get prisma() {
    return prisma
  },
}))
vi.mock('@/lib/guard', async () => {
  const {ctx} = await import('../band')
  return {requireSession: vi.fn(async () => ctx({id: 'u1'}))}
})
vi.mock('@/lib/events', () => ({
  bus: {emit: vi.fn()},
  EVENTS: {PROPOSAL_UPDATED: 'proposal.updated'},
}))

describe('/api/proposals/[id]/vote routes', () => {
  beforeEach(() => {
    prisma = {
      proposal: {findFirst: vi.fn().mockResolvedValue({id: 'p1'})},
      $transaction: vi.fn(async (fn: any) => {
        const tx: any = {
          vote: {
            create: vi.fn().mockResolvedValue({}),
            delete: vi.fn().mockResolvedValue({}),
            count: vi.fn().mockResolvedValue(1),
          },
          auditLog: {create: vi.fn()},
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
      proposal: {findFirst: vi.fn().mockResolvedValue({id: 'p1'})},
      $transaction: vi.fn(async (_fn: any) => {
        throw new Error('unique violation')
      }),
    }
    const {POST} = await import('@/app/api/proposals/[id]/vote/route')
    const res = await POST(new Request('http://x'), {params: {id: 'p1'}})
    expect(res.status).toBe(409)
  })

  it('POST that reaches the threshold approves and adds the song to learn', async () => {
    let tx: any
    prisma = {
      proposal: {findFirst: vi.fn().mockResolvedValue({id: 'p1'})},
      $transaction: vi.fn(async (fn: any) => {
        tx = {
          vote: {create: vi.fn(), count: vi.fn().mockResolvedValue(2)},
          auditLog: {create: vi.fn()},
          proposal: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'p1',
              status: 'PENDING',
              title: 'Monkey Man',
              artist: 'Stones',
              youtubeUrl: null,
              lyricsUrl: null,
            }),
            update: vi.fn(),
          },
          song: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({id: 's9'}),
          },
          chartVersion: {create: vi.fn()},
          activity: {create: vi.fn()},
        }
        await fn(tx)
      }),
    }
    const {POST} = await import('@/app/api/proposals/[id]/vote/route')
    const res = await POST(new Request('http://x'), {params: {id: 'p1'}})
    expect(res.status).toBe(204)
    expect(tx.proposal.update).toHaveBeenCalledWith({
      where: {id: 'p1'},
      data: {status: 'APPROVED'},
    })
    expect(tx.song.create.mock.calls[0][0].data).toMatchObject({
      title: 'Monkey Man',
      status: 'LEARNING',
      notes: 'Originally by Stones',
    })
    expect(tx.chartVersion.create).toHaveBeenCalled()
  })

  it("can't vote on another band's proposal", async () => {
    prisma.proposal.findFirst.mockResolvedValue(null)
    const {POST} = await import('@/app/api/proposals/[id]/vote/route')
    const res = await POST(new Request('http://x'), {params: {id: 'p9'}})
    expect(res.status).toBe(404)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('DELETE removes a vote', async () => {
    const {DELETE} = await import('@/app/api/proposals/[id]/vote/route')
    const res = await DELETE(new Request('http://x'), {params: {id: 'p1'}})
    expect(res.status).toBe(204)
  })
})
