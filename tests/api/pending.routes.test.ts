import {describe, it, expect, vi, beforeEach} from 'vitest'

let prisma: any

vi.mock('@/lib/db', () => ({
  get prisma() {
    return prisma
  },
}))
let sessionVal: any = null
vi.mock('next-auth', () => ({
  getServerSession: () => Promise.resolve(sessionVal),
}))

describe('/api/proposals/pending GET', () => {
  beforeEach(() => {
    prisma = {
      proposal: {findMany: vi.fn()},
      settings: {findUnique: vi.fn().mockResolvedValue({voteThreshold: 3})},
    }
  })

  it('returns public list without session', async () => {
    sessionVal = null
    prisma.proposal.findMany.mockResolvedValue([
      {
        id: 'p1',
        title: 'Song',
        artist: 'Artist',
        _count: {votes: 2},
      },
    ])
    const {GET} = await import('@/app/api/proposals/pending/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json[0]).toMatchObject({
      id: 'p1',
      votes: 2,
      mine: false,
    })
  })

  it('maps response for authenticated user', async () => {
    sessionVal = {user: {email: 'a@example.com'}}
    prisma.proposal.findMany.mockResolvedValue([
      {
        id: 'p1',
        title: 'Song',
        artist: 'Artist',
        _count: {votes: 1},
        votes: [{id: 'v1'}],
      },
    ])
    const {GET} = await import('@/app/api/proposals/pending/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json[0]).toMatchObject({
      id: 'p1',
      votes: 1,
      mine: true,
      threshold: 3,
    })
  })
})
