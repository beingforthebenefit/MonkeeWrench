import {describe, it, expect, vi, beforeEach} from 'vitest'

let prisma: any

vi.mock('@/lib/db', () => ({
  get prisma() {
    return prisma
  },
}))

describe('/api/proposals/pending/count GET', () => {
  beforeEach(() => {
    prisma = {proposal: {count: vi.fn().mockResolvedValue(5)}}
  })

  it('returns pending count', async () => {
    const {GET} = await import('@/app/api/proposals/pending/count/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({count: 5})
  })
})
