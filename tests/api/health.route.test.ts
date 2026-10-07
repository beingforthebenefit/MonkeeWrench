import {describe, it, expect, vi} from 'vitest'

let count: () => Promise<number>
vi.mock('@/lib/db', () => ({prisma: {song: {count: () => count()}}}))

describe('GET /api/health', () => {
  it('is ok with a count when the database answers', async () => {
    count = async () => 33
    const {GET} = await import('@/app/api/health/route')
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ok: true, songs: 33})
  })

  it('is 503 when the database does not', async () => {
    count = () => Promise.reject(new Error('down'))
    const {GET} = await import('@/app/api/health/route')
    expect((await GET()).status).toBe(503)
  })
})
