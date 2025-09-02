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

describe('/api/settings route', () => {
  beforeEach(() => {
    prisma = {
      settings: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
      },
    }
  })

  it('GET returns defaults when missing', async () => {
    const {GET} = await import('@/app/api/settings/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({voteThreshold: 2, adminAllowlist: []})
  })

  it('PATCH validates threshold', async () => {
    const {PATCH} = await import('@/app/api/settings/route')
    const bad = new Request('http://x/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({voteThreshold: 0}),
    })
    const res = await PATCH(bad)
    expect(res.status).toBe(400)
  })
})
