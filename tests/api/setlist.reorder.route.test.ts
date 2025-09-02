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

describe('/api/setlist/reorder PATCH', () => {
  beforeEach(() => {
    prisma = {
      user: {findUnique: vi.fn()},
      proposal: {findMany: vi.fn(), update: vi.fn()},
      $transaction: vi.fn(async (fn: any) => {
        const tx = {proposal: {update: vi.fn()}}
        await fn(tx)
      }),
    }
  })

  it('rejects unauthorized', async () => {
    sessionVal = null
    const {PATCH} = await import('@/app/api/setlist/reorder/route')
    const res = await PATCH(new Request('http://x', {method: 'PATCH'}))
    expect(res.status).toBe(401)
  })

  it('rejects id not approved', async () => {
    sessionVal = {user: {email: 'a@example.com'}}
    prisma.user.findUnique.mockResolvedValue({id: 'u1', isAdmin: true})
    prisma.proposal.findMany.mockResolvedValue([]) // no approved
    const {PATCH} = await import('@/app/api/setlist/reorder/route')
    const res = await PATCH(
      new Request('http://x', {
        method: 'PATCH',
        body: JSON.stringify({ids: ['x']}),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('accepts valid reorder and calls transaction', async () => {
    sessionVal = {user: {email: 'a@example.com'}}
    prisma.user.findUnique.mockResolvedValue({id: 'u1', isAdmin: true})
    prisma.proposal.findMany.mockResolvedValue([{id: 'a'}, {id: 'b'}])
    const {PATCH} = await import('@/app/api/setlist/reorder/route')
    // mock fetch to stream emit endpoint
    const orig = global.fetch
    global.fetch = vi.fn(
      async () => new Response(null, {status: 200}),
    ) as unknown as typeof fetch
    const res = await PATCH(
      new Request('http://x', {
        method: 'PATCH',
        body: JSON.stringify({ids: ['a', 'b']}),
      }),
    )
    expect(res.status).toBe(200)
    expect(prisma.$transaction).toHaveBeenCalled()
    global.fetch = orig
  })
})
