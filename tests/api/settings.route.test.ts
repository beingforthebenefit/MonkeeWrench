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

  it('GET returns existing settings', async () => {
    prisma.settings.findUnique.mockResolvedValue({
      id: 1,
      voteThreshold: 5,
      adminAllowlist: ['a@x'],
    })
    const {GET} = await import('@/app/api/settings/route')
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      voteThreshold: 5,
      adminAllowlist: ['a@x'],
    })
  })

  it('PATCH updates settings', async () => {
    const {PATCH} = await import('@/app/api/settings/route')
    const req = new Request('http://x/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({voteThreshold: 3, adminAllowlist: ['a@x', 'b@y']}),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(204)
    expect(prisma.settings.update).toHaveBeenCalledWith({
      where: {id: 1},
      data: {voteThreshold: 3, adminAllowlist: ['a@x', 'b@y']},
    })
  })
})
