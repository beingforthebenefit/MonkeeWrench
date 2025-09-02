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

describe('/api/admin/users routes', () => {
  beforeEach(() => {
    prisma = {
      user: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn(),
      },
    }
  })

  it('GET returns empty user list', async () => {
    const {GET} = await import('@/app/api/admin/users/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual([])
  })

  it('POST validates email', async () => {
    const {POST} = await import('@/app/api/admin/users/route')
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({email: 'not-an-email'}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('POST creates or updates user', async () => {
    const {POST} = await import('@/app/api/admin/users/route')
    prisma.user.upsert.mockResolvedValue({
      id: 'u1',
      email: 'ok@example.com',
      name: 'Ok',
      isAdmin: true,
    })
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({
        email: 'ok@example.com',
        name: 'Ok',
        isAdmin: true,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({
      email: 'ok@example.com',
      isAdmin: true,
    })
  })

  it('GET maps counts into response', async () => {
    const {GET} = await import('@/app/api/admin/users/route')
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        name: 'A',
        email: 'a@x',
        image: null,
        isAdmin: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        proposals: [{id: 'p'}],
        votes: [{id: 'v1'}, {id: 'v2'}],
      },
    ])
    const res = await GET()
    expect(res.status).toBe(200)
    const [row] = await res.json()
    expect(row).toMatchObject({
      proposalsCount: 1,
      votesCount: 2,
      canDelete: true,
    })
  })
})
