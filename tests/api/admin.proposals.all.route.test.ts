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

describe('/api/proposals/all GET (admin)', () => {
  beforeEach(() => {
    prisma = {proposal: {findMany: vi.fn().mockResolvedValue([{id: '1'}])}}
  })

  it('returns admin list', async () => {
    const {GET} = await import('@/app/api/proposals/all/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual([{id: '1'}])
  })
})
