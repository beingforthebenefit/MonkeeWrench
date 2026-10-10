// @vitest-environment node
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {ctx, json, prismaMock} from '../prisma-mock'
import {hashPassword} from '@/lib/password'

let db: any
let session: any
let admin = true
let mail = true
const sendPasswordLink = vi.fn(async (..._a: any[]) => {})

vi.mock('@/lib/db', () => ({
  get prisma() {
    return db
  },
}))
vi.mock('@/lib/guard', async (orig) => {
  const need = () => {
    if (!session) throw new Response('Unauthorized', {status: 401})
    return session
  }
  return {
    requireScheduling: ((await orig()) as any).requireScheduling,
    requireUser: async () => need(),
    requireSession: async () => need(),
    requireOwner: async () => need(),
    requireAdmin: async () => {
      need()
      if (!admin) throw new Response('Forbidden', {status: 403})
      return session
    },
  }
})
vi.mock('@/lib/band', () => ({
  requestOrigin: () => 'https://app.test',
  bandSite: async () => 'https://app.test',
}))
vi.mock('@/lib/mail', () => ({mailConfigured: () => mail}))
vi.mock('@/lib/email-tokens', () => ({
  sendPasswordLink: (...a: any[]) => sendPasswordLink(...(a as [])),
}))

beforeEach(async () => {
  db = prismaMock()
  session = {
    ...ctx,
    user: {...ctx.user, shareAvailability: true, blockOtherBands: true},
    band: {...ctx.band},
  }
  admin = true
  mail = true
  sendPasswordLink.mockClear()
  ;(await import('@/lib/rate-limit')).resetRateLimitsForTests()
})

describe('/api/account/password', () => {
  it('needs the current password, then ends every session', async () => {
    const {POST} = await import('@/app/api/account/password/route')
    session.user.passwordHash = await hashPassword('the old password')
    expect((await POST(json('/x', 'POST', {next: 'short'}))).status).toBe(400)
    expect(
      (
        await POST(
          json('/x', 'POST', {
            current: 'wrong one',
            next: 'a new long password',
          }),
        )
      ).status,
    ).toBe(403)
    expect(
      (
        await POST(
          json('/x', 'POST', {
            current: 'the old password',
            next: 'a new long password',
          }),
        )
      ).status,
    ).toBe(204)
    expect(db.user.update.mock.calls[0][0].data.sessionVersion).toEqual({
      increment: 1,
    })
    expect(db.activity.create.mock.calls[0][0].data).toMatchObject({
      bandId: null,
      action: 'account.password',
    })
  })
  it('a Google-only account sets one without a current password', async () => {
    const {POST} = await import('@/app/api/account/password/route')
    session.user.passwordHash = null
    expect(
      (await POST(json('/x', 'POST', {next: 'a new long password'}))).status,
    ).toBe(204)
  })
})

describe('/api/account/settings', () => {
  it('changes only what’s sent; sharing days off merges them', async () => {
    const {PATCH} = await import('@/app/api/account/settings/route')
    expect((await PATCH(json('/x', 'PATCH', {tourDone: 'yes'}))).status).toBe(
      400,
    )
    await PATCH(
      json('/x', 'PATCH', {
        blockOtherBands: false,
        notifyCharts: false,
        tourDone: true,
      }),
    )
    const updates = db.user.update.mock.calls.map((c: any) => c[0].data)
    expect(updates[0]).toEqual({blockOtherBands: false})
    expect(updates[1]).toEqual({notifyCharts: false})
    expect(updates[2].tourDoneAt).toBeInstanceOf(Date)
    db.membership.findMany.mockResolvedValue([{bandId: 'b1'}, {bandId: 'b2'}])
    db.unavailability.findMany.mockResolvedValue([
      {date: new Date('2026-10-12'), kind: 'OUT', scope: ''},
    ])
    await PATCH(json('/x', 'PATCH', {shareAvailability: false}))
    expect(db.user.update.mock.calls.at(-1)[0].data).toMatchObject({
      shareAvailability: false,
    })
  })
})

describe('/api/password/forgot', () => {
  const post = (body: unknown) =>
    new Request('http://t/x', {
      method: 'POST',
      headers: {'x-forwarded-for': '9.9.9.9'},
      body: JSON.stringify(body),
    })
  it('emails a reset link, and says the same either way', async () => {
    const {POST} = await import('@/app/api/password/forgot/route')
    expect((await POST(post({email: 'nope'}))).status).toBe(400)
    expect(await (await POST(post({email: 'nobody@x.com'}))).json()).toEqual({
      ok: true,
    })
    expect(sendPasswordLink).not.toHaveBeenCalled()
    db.user.findFirst.mockResolvedValue({id: 'u2', email: 'bo@x.com'})
    expect(await (await POST(post({email: 'BO@x.com'}))).json()).toEqual({
      ok: true,
    })
    expect(sendPasswordLink.mock.calls[0][0]).toMatchObject({
      userId: 'u2',
      kind: 'RESET',
    })
  })
  it('slows down repeated tries, and isn’t there without email', async () => {
    const {POST} = await import('@/app/api/password/forgot/route')
    for (let i = 0; i < 3; i++) await POST(post({email: 'x@x.com'}))
    expect((await POST(post({email: 'x@x.com'}))).status).toBe(429)
    mail = false
    expect((await POST(post({email: 'y@x.com'}))).status).toBe(404)
  })
})

describe('/api/push/subscribe', () => {
  it('saves a device, and forgets it', async () => {
    const {POST, DELETE} = await import('@/app/api/push/subscribe/route')
    expect((await POST(json('/x', 'POST', {endpoint: 'nope'}))).status).toBe(
      400,
    )
    const sub = {
      endpoint: 'https://push.test/abc',
      keys: {p256dh: 'p', auth: 'a'},
      device: 'iPhone',
    }
    expect((await POST(json('/x', 'POST', sub))).status).toBe(204)
    expect(db.pushSubscription.upsert.mock.calls[0][0].create).toMatchObject({
      userId: 'u1',
      device: 'iPhone',
    })
    expect((await DELETE(json('/x', 'DELETE', {}))).status).toBe(400)
    expect(
      (await DELETE(json('/x', 'DELETE', {endpoint: sub.endpoint}))).status,
    ).toBe(204)
    expect(db.pushSubscription.deleteMany.mock.calls[0][0].where).toEqual({
      endpoint: sub.endpoint,
      userId: 'u1',
    })
  })
})

describe('/api/owner/members', () => {
  it('adds someone to any band and invites them', async () => {
    const {POST} = await import('@/app/api/owner/members/route')
    expect((await POST(json('/x', 'POST', {bandId: 'b2'}))).status).toBe(400)
    expect(
      (
        await POST(
          json('/x', 'POST', {bandId: 'b2', name: 'Cy', email: 'cy@x.com'}),
        )
      ).status,
    ).toBe(404)
    db.band.findUnique.mockResolvedValue({id: 'b2', name: 'Riverside'})
    db.user.findFirst.mockResolvedValueOnce({id: 'u5', memberships: [{}]})
    expect(
      (
        await POST(
          json('/x', 'POST', {bandId: 'b2', name: 'Cy', email: 'cy@x.com'}),
        )
      ).status,
    ).toBe(409)
    db.user.create.mockImplementation(async ({data}: any) => ({
      id: 'u9',
      passwordHash: null,
      ...data,
    }))
    const res = await POST(
      json('/x', 'POST', {
        bandId: 'b2',
        name: 'Cy Young',
        email: 'cy@x.com',
        isAdmin: true,
      }),
    )
    expect(await res.json()).toEqual({id: 'u9', existing: false, invited: true})
    expect(db.membership.create.mock.calls[0][0].data).toEqual({
      userId: 'u9',
      bandId: 'b2',
      isAdmin: true,
    })
    sendPasswordLink.mockRejectedValueOnce(new Error('down'))
    vi.spyOn(console, 'error').mockImplementationOnce(() => {})
    expect(
      (
        await (
          await POST(
            json('/x', 'POST', {bandId: 'b2', name: 'D', email: 'd@x.com'}),
          )
        ).json()
      ).invited,
    ).toBe(false)
  })
})

describe('/api/availability', () => {
  it('marks and clears my day; an admin may mark someone else’s', async () => {
    const {PUT} = await import('@/app/api/availability/route')
    expect(
      (await PUT(json('/x', 'PUT', {date: 'soon', kind: 'OUT'}))).status,
    ).toBe(400)
    expect(
      (await PUT(json('/x', 'PUT', {date: '2026-10-12', kind: 'OUT'}))).status,
    ).toBe(204)
    expect(db.unavailability.upsert.mock.calls[0][0].create).toEqual({
      userId: 'u1',
      scope: '',
      date: new Date('2026-10-12T00:00:00Z'),
      kind: 'OUT',
    })
    expect(db.activity.create.mock.calls[0][0].data.summary).toMatch(
      /updated their availability/,
    )
    db.activity.findFirst.mockResolvedValue({id: 'a1'})
    await PUT(json('/x', 'PUT', {date: '2026-10-12', kind: null}))
    expect(db.unavailability.deleteMany).toHaveBeenCalled()
    expect(db.activity.update).toHaveBeenCalled()
    expect(
      (
        await PUT(
          json('/x', 'PUT', {date: '2026-10-12', kind: 'OUT', userId: 'u2'}),
        )
      ).status,
    ).toBe(404)
    db.user.findFirst.mockResolvedValue({id: 'u2', shareAvailability: false})
    await PUT(
      json('/x', 'PUT', {date: '2026-10-12', kind: 'PM_OUT', userId: 'u2'}),
    )
    expect(db.unavailability.upsert.mock.calls[1][0].create.scope).toBe('b1')
    session.isAdmin = false
    expect(
      (
        await PUT(
          json('/x', 'PUT', {date: '2026-10-12', kind: 'OUT', userId: 'u2'}),
        )
      ).status,
    ).toBe(403)
  })
  it('isn’t there when the band has scheduling off', async () => {
    const {PUT} = await import('@/app/api/availability/route')
    session.band.scheduling = false
    expect(
      (await PUT(json('/x', 'PUT', {date: '2026-10-12', kind: 'OUT'}))).status,
    ).toBe(404)
  })
})

describe('/api/calendar/[file]', () => {
  it('a feed of every band’s rehearsals and gigs, by secret link', async () => {
    const {GET} = await import('@/app/api/calendar/[file]/route')
    const req = new Request('http://t/x')
    expect((await GET(req, {params: {file: 'short.ics'}})).status).toBe(404)
    const token = 'a'.repeat(24)
    expect((await GET(req, {params: {file: `${token}.ics`}})).status).toBe(404)
    db.user.findUnique.mockResolvedValue({
      id: 'u1',
      memberships: [
        {
          band: {
            id: 'b1',
            name: 'The Hollow Reeds',
            timezone: 'America/Los_Angeles',
          },
        },
      ],
    })
    db.rehearsal.findMany.mockResolvedValue([
      {
        id: 'r1',
        bandId: 'b1',
        date: new Date('2026-10-24T00:00:00Z'),
        time: '3-6pm',
        place: 'Studio B',
        note: null,
      },
    ])
    db.setlist.findMany.mockResolvedValue([
      {
        id: 'l1',
        bandId: 'b1',
        name: 'Riverside',
        gigDate: new Date('2026-11-01T00:00:00Z'),
        startTime: '20:00',
        venue: 'The Pier',
        items: [],
      },
    ])
    const res = await GET(req, {params: {file: `${token}.ics`}})
    expect(res.headers.get('Content-Type')).toContain('text/calendar')
    const ics = await res.text()
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('The Hollow Reeds rehearsals and gigs')
    expect(ics).toContain('Studio B')
    expect(ics).toContain('Riverside')
  })
})

describe('/api/band/icon', () => {
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000100000001008060000001ff3ff61',
    'hex',
  )
  it('takes a real picture, small enough, from an admin', async () => {
    const {PUT, DELETE} = await import('@/app/api/band/icon/route')
    const put = (body: BodyInit) =>
      PUT(new Request('http://t/x', {method: 'PUT', body}))
    expect((await put(new Uint8Array(0))).status).toBe(413)
    expect((await put(new Uint8Array([1, 2, 3, 4]))).status).toBe(415)
    const res = await put(new Uint8Array(png))
    expect(res.status).toBe(200)
    expect(db.bandIcon.upsert.mock.calls[0][0].create).toMatchObject({
      bandId: 'b1',
      mime: 'image/png',
    })
    expect((await DELETE()).status).toBe(204)
    admin = false
    expect((await DELETE()).status).toBe(403)
  })
})

describe('PDFs', () => {
  const chart =
    '{title: Sway}\n{start_of_verse: Verse 1}\n[C]la la [G]la\n{end_of_verse}\n'
  it('a song’s chart, any version and key, as a PDF', async () => {
    const {GET} = await import('@/app/api/songs/[id]/pdf/route')
    const req = (q = '') => new Request(`http://t/api/songs/s1/pdf${q}`)
    expect((await GET(req(), {params: {id: 's1'}})).status).toBe(404)
    db.song.findFirst.mockResolvedValue({
      id: 's1',
      title: 'Sway',
      writer: 'Ruiz',
      leadSinger: null,
    })
    expect((await GET(req(), {params: {id: 's1'}})).status).toBe(404)
    db.chartVersion.findFirst.mockResolvedValue({
      number: 2,
      source: chart,
      createdAt: new Date('2026-10-01'),
      author: {name: 'Ana', displayName: 'Ana', email: 'a@x.com'},
    })
    const res = await GET(req('?key=D&version=2&download&paper=a4'), {
      params: {id: 's1'},
    })
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain('attachment')
    const head = Buffer.from(await res.arrayBuffer())
      .subarray(0, 5)
      .toString()
    expect(head).toBe('%PDF-')
  }, 20000)

  it('a setlist: every chart in order, or the big-type sheet', async () => {
    const {GET} = await import('@/app/api/setlists/[id]/pdf/route')
    const req = (q = '') => new Request(`http://t/api/setlists/l1/pdf${q}`)
    expect((await GET(req(), {params: {id: 'l1'}})).status).toBe(404)
    const song = {
      id: 's1',
      title: 'Sway',
      writer: null,
      leadSinger: null,
      seconds: 200,
      chartVersions: [
        {number: 1, source: chart, createdAt: new Date(), author: null},
      ],
    }
    db.setlist.findFirst.mockResolvedValue({
      id: 'l1',
      name: 'Riverside',
      startTime: '20:00',
      items: [
        {
          kind: 'SET',
          label: 'Set 1',
          minutes: 45,
          startTime: null,
          song: null,
          songId: null,
        },
        {kind: 'SONG', key: 'D', note: 'Ana sings', songId: 's1', song},
        {kind: 'BREAK', minutes: 15, song: null, songId: null},
        {
          kind: 'SET',
          label: 'Set 2',
          minutes: null,
          startTime: null,
          song: null,
          songId: null,
        },
        {kind: 'SONG', key: null, note: null, songId: 's1', song},
      ],
    })
    const charts = await GET(req('?cues=1'), {params: {id: 'l1'}})
    expect(
      Buffer.from(await charts.arrayBuffer())
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-')
    const sheet = await GET(req('?sheet=1'), {params: {id: 'l1'}})
    expect(sheet.headers.get('Content-Type')).toBe('application/pdf')
  }, 20000)
})
