import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

let prisma: any
let session: any
const sendMail = vi.fn(async () => {})
const sendPasswordLink = vi.fn(async () => {})

vi.mock('@/lib/db', () => ({
  get prisma() {
    return prisma
  },
}))
vi.mock('next-auth', () => ({getServerSession: async () => session}))
vi.mock('@/lib/auth', () => ({authOptions: {}}))
vi.mock('@/lib/band', () => ({requestOrigin: () => 'https://app.test'}))
vi.mock('@/lib/songs', () => ({logActivity: vi.fn(async () => {})}))
vi.mock('@/lib/mail', () => ({mailConfigured: () => true, sendMail}))
vi.mock('@/lib/email-tokens', () => ({sendPasswordLink}))

async function load(hosted = true) {
  vi.resetModules()
  vi.stubEnv('BANDSTAND_HOSTED', hosted ? '1' : '')
  const {resetRateLimitsForTests} = await import('@/lib/rate-limit')
  resetRateLimitsForTests()
  return (await import('@/app/api/signup/route')).POST
}

const post = (body: unknown, ip = '1.2.3.4') =>
  new Request('http://t/api/signup', {
    method: 'POST',
    headers: {'x-forwarded-for': ip},
    body: JSON.stringify(body),
  })

const start = {
  bandName: 'The Hollow Reeds',
  name: 'Ana Ruiz',
  email: 'Ana@Example.com',
}

describe('POST /api/signup', () => {
  beforeEach(() => {
    session = null
    sendMail.mockClear()
    sendPasswordLink.mockClear()
    const tx = {
      band: {
        create: vi.fn(async ({data}: any) => ({id: 'b9', ...data})),
      },
      membership: {create: vi.fn(async () => ({}))},
      song: {create: vi.fn(async () => ({}))},
    }
    prisma = {
      tx,
      band: {findUnique: vi.fn(async () => null)},
      user: {
        findFirst: vi.fn(async () => null),
        findUnique: vi.fn(async () => ({id: 'u7', email: 'me@x.com'})),
        create: vi.fn(async ({data}: any) => ({id: 'u9', ...data})),
      },
      $transaction: async (f: any) => f(tx),
    }
  })
  afterEach(() => vi.unstubAllEnvs())

  it('is only on the hosted service', async () => {
    const POST = await load(false)
    expect((await POST(post(start))).status).toBe(404)
  })

  it('starts a band on a trial, its starter the admin (never the owner), and emails them', async () => {
    const POST = await load()
    const res = await POST(post(start))
    expect(res.status).toBe(200)
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {email: 'ana@example.com', name: 'Ana Ruiz', displayName: 'Ana'},
    })
    const band = prisma.tx.band.create.mock.calls[0][0].data
    expect(band.name).toBe('The Hollow Reeds')
    expect(band.paidUntil.getTime()).toBeGreaterThan(Date.now() + 29 * 86400000)
    expect(band.trialStartedAt).toBeInstanceOf(Date)
    expect(prisma.tx.membership.create).toHaveBeenCalledWith({
      data: {userId: 'u9', bandId: 'b9', isAdmin: true},
    })
    expect(JSON.stringify(prisma.user.create.mock.calls)).not.toMatch(/isOwner/)
    // Two sample songs, so the book isn't empty
    const songs = prisma.tx.song.create.mock.calls.map((c: any) => c[0].data)
    expect(songs.map((s: any) => s.title)).toEqual([
      'When the Saints Go Marching In',
      'Down by the Riverside',
    ])
    expect(songs[0]).toMatchObject({
      bandId: 'b9',
      notes: expect.stringMatching(/sample/i),
    })
    expect(songs[0].chartVersions.create.source).toMatch(/start_of_abc/)
    expect(sendPasswordLink).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u9',
        kind: 'WELCOME',
        origin: 'https://app.test',
      }),
    )
  })

  it('answers the same for an address with an account, and only emails it', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'ana@example.com',
    })
    const POST = await load()
    const res = await POST(post(start))
    expect(await res.json()).toEqual({ok: true})
    expect(prisma.user.create).not.toHaveBeenCalled()
    expect(prisma.tx.band.create).not.toHaveBeenCalled()
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({to: 'ana@example.com'}),
    )
  })

  it('does nothing for a bot that fills in the hidden field', async () => {
    const POST = await load()
    const res = await POST(post({...start, website: 'http://spam'}))
    expect(res.status).toBe(200)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('slows down one address trying again and again', async () => {
    const POST = await load()
    const codes = []
    for (let i = 0; i < 4; i++)
      codes.push((await POST(post(start, `9.9.9.${i}`))).status)
    expect(codes).toEqual([200, 200, 200, 429])
  })

  it('signed in: the new band is theirs at once, no email', async () => {
    session = {user: {email: 'me@x.com'}}
    const POST = await load()
    const res = await POST(post({bandName: 'Second Band'}))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({bandId: 'b9'})
    expect(prisma.tx.membership.create).toHaveBeenCalledWith({
      data: {userId: 'u7', bandId: 'b9', isAdmin: true},
    })
    expect(sendPasswordLink).not.toHaveBeenCalled()
  })
})
