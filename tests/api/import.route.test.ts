import {beforeEach, describe, expect, it, vi} from 'vitest'

let admin: any
const importBand = vi.fn(async () => ({songsAdded: 1}))
vi.mock('@/lib/guard', () => ({
  requireAdmin: async () => {
    if (!admin) throw new Response('Forbidden', {status: 403})
    return admin
  },
}))
vi.mock('@/lib/band-import', () => ({importBand}))

const post = (body: string) =>
  new Request('http://t/api/import', {method: 'POST', body})

describe('POST /api/import', () => {
  beforeEach(() => {
    admin = {user: {id: 'u1'}, band: {id: 'b1'}}
    importBand.mockClear()
  })
  it('is for admins', async () => {
    admin = null
    const {POST} = await import('@/app/api/import/route')
    expect((await POST(post('{}'))).status).toBe(403)
  })
  it('imports into the current band, as the admin', async () => {
    const {POST} = await import('@/app/api/import/route')
    const res = await POST(
      post(JSON.stringify({songs: [{title: 'Sway', chart: {chordpro: 'x'}}]})),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({songsAdded: 1})
    expect(importBand).toHaveBeenCalledWith(
      {songs: [{title: 'Sway', chart: {chordpro: 'x'}}]},
      {bandId: 'b1', userId: 'u1'},
    )
  })
  it('refuses what isn’t an import, and says where', async () => {
    const {POST} = await import('@/app/api/import/route')
    expect((await POST(post('not json'))).status).toBe(400)
    const res = await POST(post(JSON.stringify({songs: [{title: ''}]})))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/songs\.0\.title/)
    expect(importBand).not.toHaveBeenCalled()
  })
  it('refuses a batch that’s too big', async () => {
    const {POST} = await import('@/app/api/import/route')
    expect((await POST(post('x'.repeat(8 * 1024 * 1024 + 1)))).status).toBe(413)
  })
})
