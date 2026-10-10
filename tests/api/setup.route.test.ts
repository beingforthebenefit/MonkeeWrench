import {beforeEach, describe, expect, it, vi} from 'vitest'

let users: number
const startBand = vi.fn(async () => ({id: 'b1'}))
const tx = {
  $executeRaw: vi.fn(async () => 1),
  user: {
    count: vi.fn(async () => users),
    create: vi.fn(async ({data}: any) => ({id: 'u1', ...data})),
  },
}
vi.mock('@/lib/db', () => ({prisma: {$transaction: async (f: any) => f(tx)}}))
vi.mock('@/lib/new-band', () => ({startBand}))

const body = {
  bandName: 'The Hollow Reeds',
  name: 'Ana Ruiz',
  email: 'Ana@Example.com',
  password: 'long enough pw',
}
const post = (b: unknown) =>
  new Request('http://t/api/setup', {method: 'POST', body: JSON.stringify(b)})

describe('POST /api/setup', () => {
  beforeEach(() => {
    users = 0
    startBand.mockClear()
    tx.user.create.mockClear()
  })
  it('makes the first account the owner, with its password, and its band (free)', async () => {
    const {POST} = await import('@/app/api/setup/route')
    const res = await POST(post(body))
    expect(res.status).toBe(201)
    const data = tx.user.create.mock.calls[0][0].data
    expect(data).toMatchObject({
      email: 'ana@example.com',
      name: 'Ana Ruiz',
      displayName: 'Ana',
      isOwner: true,
    })
    expect(data.passwordHash).toMatch(/^scrypt\$/)
    expect(tx.$executeRaw).toHaveBeenCalled()
    expect(startBand).toHaveBeenCalledWith('The Hollow Reeds', 'u1', {
      trial: false,
    })
  })
  it('is gone once anyone has an account', async () => {
    users = 1
    const {POST} = await import('@/app/api/setup/route')
    expect((await POST(post(body))).status).toBe(409)
    expect(tx.user.create).not.toHaveBeenCalled()
    expect(startBand).not.toHaveBeenCalled()
  })
  it('wants a real password', async () => {
    const {POST} = await import('@/app/api/setup/route')
    expect((await POST(post({...body, password: 'short'}))).status).toBe(400)
  })
})
