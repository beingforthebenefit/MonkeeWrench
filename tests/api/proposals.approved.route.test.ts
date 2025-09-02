import {describe, it, expect, vi, beforeEach} from 'vitest'

let prisma: any

vi.mock('@/lib/db', () => ({
  get prisma() {
    return prisma
  },
}))

describe('/api/proposals/approved GET', () => {
  beforeEach(() => {
    prisma = {
      proposal: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'a1',
            title: 'Song A',
            artist: 'Artist',
            chartUrl: null,
            lyricsUrl: null,
            youtubeUrl: null,
            setlistOrder: 1,
            updatedAt: new Date().toISOString(),
          },
        ]),
      },
    }
  })

  it('returns approved proposals mapped shape', async () => {
    const {GET} = await import('@/app/api/proposals/approved/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
    expect(json[0]).toMatchObject({
      id: 'a1',
      title: 'Song A',
      artist: 'Artist',
    })
  })
})
