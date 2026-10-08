import {describe, it, expect, vi, beforeEach} from 'vitest'

let prisma: any
let me: {id: string; isAdmin: boolean}

vi.mock('@/lib/db', () => ({
  get prisma() {
    return prisma
  },
}))
vi.mock('@/lib/guard', () => ({
  requireSession: vi.fn(async () => ({user: me})),
}))

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
const ctx = (id: string) => ({params: {id}})
const put = (body: BodyInit) =>
  new Request('http://x/api/avatars/u1', {method: 'PUT', body})

describe('/api/avatars/[id]', () => {
  beforeEach(() => {
    me = {id: 'u1', isAdmin: false}
    const tx = {
      avatar: {
        upsert: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({count: 1}),
      },
      user: {update: vi.fn().mockResolvedValue({})},
      activity: {create: vi.fn().mockResolvedValue({})},
    }
    prisma = {
      tx,
      avatar: {findUnique: vi.fn().mockResolvedValue(null)},
      user: {
        findUnique: vi.fn(async ({where}: any) => ({
          id: where.id,
          displayName: 'Ken',
          name: 'Ken K',
        })),
      },
      $transaction: vi.fn(async (fn: any) => fn(tx)),
    }
  })

  it('serves the photo with its type and a long cache', async () => {
    prisma.avatar.findUnique.mockResolvedValue({
      mime: 'image/jpeg',
      data: Buffer.from(JPEG),
    })
    const {GET} = await import('@/app/api/avatars/[id]/route')
    const res = await GET(new Request('http://x'), ctx('u2'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/jpeg')
    expect(res.headers.get('Cache-Control')).toContain('immutable')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG)
  })

  it('404s when someone has no photo', async () => {
    const {GET} = await import('@/app/api/avatars/[id]/route')
    expect((await GET(new Request('http://x'), ctx('u2'))).status).toBe(404)
  })

  it('saves your own photo, stamps the user and logs it', async () => {
    const {PUT} = await import('@/app/api/avatars/[id]/route')
    const res = await PUT(put(JPEG), ctx('u1'))
    expect(res.status).toBe(200)
    expect(prisma.tx.avatar.upsert.mock.calls[0][0].create.mime).toBe(
      'image/jpeg',
    )
    expect(prisma.tx.user.update.mock.calls[0][0].data.avatarAt).toBeInstanceOf(
      Date,
    )
    expect(prisma.tx.activity.create.mock.calls[0][0].data.summary).toBe(
      'updated their photo',
    )
  })

  it("refuses someone else's photo unless you are an admin", async () => {
    const {PUT} = await import('@/app/api/avatars/[id]/route')
    expect((await PUT(put(JPEG), ctx('u2'))).status).toBe(403)
    me = {id: 'u1', isAdmin: true}
    expect((await PUT(put(JPEG), ctx('u2'))).status).toBe(200)
    expect(prisma.tx.activity.create.mock.calls[0][0].data.summary).toBe(
      'updated the photo for Ken',
    )
  })

  it('refuses anything that is not a JPEG, PNG or WebP, and oversized files', async () => {
    const {PUT} = await import('@/app/api/avatars/[id]/route')
    expect((await PUT(put('<svg onload=alert(1)>'), ctx('u1'))).status).toBe(
      415,
    )
    const big = new Uint8Array(300_001)
    big.set(JPEG)
    expect((await PUT(put(big), ctx('u1'))).status).toBe(413)
    expect((await PUT(put(new Uint8Array()), ctx('u1'))).status).toBe(413)
    expect(prisma.tx.avatar.upsert).not.toHaveBeenCalled()
  })

  it('removes a photo and clears the stamp', async () => {
    const {DELETE} = await import('@/app/api/avatars/[id]/route')
    const res = await DELETE(new Request('http://x'), ctx('u1'))
    expect(res.status).toBe(204)
    expect(prisma.tx.user.update.mock.calls[0][0].data).toEqual({
      avatarAt: null,
    })
    me = {id: 'u1', isAdmin: false}
    expect((await DELETE(new Request('http://x'), ctx('u2'))).status).toBe(403)
  })
})
