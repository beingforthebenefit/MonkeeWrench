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
})
