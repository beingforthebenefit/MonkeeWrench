// @vitest-environment node
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {ctx, json, prismaMock} from '../prisma-mock'

let db: any
let session: any
let admin: boolean
const sendPasswordLink = vi.fn(async (..._a: any[]) => {})
let mail = true

vi.mock('@/lib/db', () => ({
  get prisma() {
    return db
  },
}))
vi.mock('@/lib/guard', () => ({
  requireSession: async () => {
    if (!session) throw new Response('Unauthorized', {status: 401})
    return session
  },
  requireAdmin: async () => {
    if (!session) throw new Response('Unauthorized', {status: 401})
    if (!admin) throw new Response('Forbidden', {status: 403})
    return session
  },
}))
vi.mock('@/lib/band', () => ({
  requestOrigin: () => 'https://app.test',
  canManageAccount: async (_a: any, id: string) => id !== 'other-band',
}))
vi.mock('@/lib/mail', () => ({mailConfigured: () => mail}))
vi.mock('@/lib/email-tokens', () => ({
  sendPasswordLink: (...a: any[]) => sendPasswordLink(...(a as [])),
}))

const p = (id: string, extra: any = {}) => ({params: {id, ...extra}})

beforeEach(() => {
  db = prismaMock()
  session = {...ctx}
  admin = true
  mail = true
  sendPasswordLink.mockClear()
})

describe('/api/members', () => {
  it('lists the band, admins only', async () => {
    const {GET} = await import('@/app/api/members/route')
    db.membership.findMany.mockResolvedValue([
      {isAdmin: true, user: {id: 'u1', name: 'Ana', passwordSetAt: new Date()}},
      {isAdmin: false, user: {id: 'u2', name: 'Bo', passwordSetAt: null}},
    ])
    const res = await GET()
    expect(await res.json()).toEqual([
      {id: 'u1', name: 'Ana', isAdmin: true, hasPassword: true},
      {id: 'u2', name: 'Bo', isAdmin: false, hasPassword: false},
    ])
    admin = false
    expect((await GET()).status).toBe(403)
  })

  it('adds a new person and emails them a link', async () => {
    const {POST} = await import('@/app/api/members/route')
    db.user.create.mockImplementation(async ({data}: any) => ({
      id: 'u9',
      passwordHash: null,
      ...data,
    }))
    const res = await POST(
      json('/api/members', 'POST', {name: 'Cy Young', email: 'CY@x.com'}),
    )
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({id: 'u9', existing: false, invited: true})
    expect(db.user.create.mock.calls[0][0].data).toEqual({
      name: 'Cy Young',
      displayName: 'Cy',
      email: 'cy@x.com',
    })
    expect(db.membership.create.mock.calls[0][0].data).toEqual({
      userId: 'u9',
      bandId: 'b1',
      isAdmin: false,
    })
    expect(sendPasswordLink.mock.calls[0][0]).toMatchObject({
      kind: 'INVITE',
      bandName: 'The Hollow Reeds',
      by: 'Ana',
    })
  })

  it('joins someone with their existing account; no email for one who can sign in', async () => {
    const {POST} = await import('@/app/api/members/route')
    db.user.findFirst.mockResolvedValue({
      id: 'u5',
      email: 'bo@x.com',
      passwordHash: 'h',
      memberships: [],
    })
    const res = await POST(
      json('/api/members', 'POST', {
        name: 'Bo',
        email: 'bo@x.com',
        isAdmin: true,
      }),
    )
    expect(await res.json()).toEqual({id: 'u5', existing: true, invited: false})
    expect(db.user.create).not.toHaveBeenCalled()
    expect(sendPasswordLink).not.toHaveBeenCalled()
  })

  it('refuses a duplicate and bad details; a failed email still adds them', async () => {
    const {POST} = await import('@/app/api/members/route')
    expect(
      (await POST(json('/api/members', 'POST', {name: '', email: 'x'}))).status,
    ).toBe(400)
    db.user.findFirst.mockResolvedValueOnce({id: 'u5', memberships: [{}]})
    expect(
      (
        await POST(
          json('/api/members', 'POST', {name: 'Bo', email: 'bo@x.com'}),
        )
      ).status,
    ).toBe(409)
    sendPasswordLink.mockRejectedValueOnce(new Error('smtp down'))
    vi.spyOn(console, 'error').mockImplementationOnce(() => {})
    const res = await POST(
      json('/api/members', 'POST', {name: 'Cy', email: 'cy@x.com'}),
    )
    expect(res.status).toBe(201)
    expect((await res.json()).invited).toBe(false)
  })

  it('PATCH: changes details and admin; never your own admin; not another band’s person', async () => {
    const {PATCH} = await import('@/app/api/members/[id]/route')
    expect(
      (await PATCH(json('/x', 'PATCH', {isAdmin: false}), p('u1'))).status,
    ).toBe(400)
    expect(
      (await PATCH(json('/x', 'PATCH', {isAdmin: 'yes'}), p('u2'))).status,
    ).toBe(400)
    expect(
      (await PATCH(json('/x', 'PATCH', {isAdmin: true}), p('u2'))).status,
    ).toBe(404)
    db.membership.findUnique.mockResolvedValue({
      userId: 'u2',
      user: {name: 'Bo Diddley', email: 'bo@x.com'},
    })
    expect(
      (
        await PATCH(
          json('/x', 'PATCH', {displayName: 'B', isAdmin: true}),
          p('u2'),
        )
      ).status,
    ).toBe(204)
    expect(db.user.update.mock.calls[0][0]).toEqual({
      where: {id: 'u2'},
      data: {displayName: 'B'},
    })
    expect(db.membership.update.mock.calls[0][0].data).toEqual({isAdmin: true})
    db.membership.findUnique.mockResolvedValue({
      userId: 'other-band',
      user: {name: 'X', email: 'x@x.com'},
    })
    expect(
      (await PATCH(json('/x', 'PATCH', {email: 'new@x.com'}), p('other-band')))
        .status,
    ).toBe(403)
  })

  it('DELETE: removes them, and their account when this was their only band', async () => {
    const {DELETE} = await import('@/app/api/members/[id]/route')
    const req = json('/x', 'DELETE')
    expect((await DELETE(req, p('u1'))).status).toBe(400)
    expect((await DELETE(req, p('u2'))).status).toBe(404)
    db.membership.findUnique.mockResolvedValue({
      userId: 'u2',
      user: {name: 'Bo', isOwner: false},
    })
    expect((await DELETE(req, p('u2'))).status).toBe(204)
    expect(db.user.delete).toHaveBeenCalledWith({where: {id: 'u2'}})
    db.membership.count.mockResolvedValue(1)
    db.user.delete.mockClear()
    await DELETE(req, p('u2'))
    expect(db.user.delete).not.toHaveBeenCalled()
  })

  it('password: makes one, stores only its hash, ends their sessions', async () => {
    const {POST} = await import('@/app/api/members/[id]/password/route')
    const req = json('/x', 'POST')
    expect((await POST(req, p('u2'))).status).toBe(404)
    db.user.findFirst.mockResolvedValue({id: 'other-band'})
    expect((await POST(req, p('other-band'))).status).toBe(403)
    db.user.findFirst.mockResolvedValue({
      id: 'u2',
      name: 'Bo',
      passwordHash: null,
    })
    const res = await POST(req, p('u2'))
    expect(res.status).toBe(201)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const {password} = await res.json()
    const data = db.user.update.mock.calls[0][0].data
    expect(data.passwordHash).toMatch(/^scrypt\$/)
    expect(data.passwordHash).not.toContain(password)
    expect(data.sessionVersion).toEqual({increment: 1})
    expect(db.activity.create.mock.calls[0][0].data.action).toBe(
      'member.password.set',
    )
  })
})

describe('/api/songs', () => {
  it('lists the band’s songs with their latest chart', async () => {
    const {GET} = await import('@/app/api/songs/route')
    db.song.findMany.mockResolvedValue([
      {id: 's1', title: 'Sway', chartVersions: [{number: 3}]},
      {id: 's2', title: 'X', chartVersions: []},
    ])
    expect(await (await GET()).json()).toEqual([
      {id: 's1', title: 'Sway', latest: {number: 3}},
      {id: 's2', title: 'X', latest: null},
    ])
    expect(db.song.findMany.mock.calls[0][0].where).toEqual({bandId: 'b1'})
  })

  it('adds a song with a first chart version, blank or given', async () => {
    const {POST} = await import('@/app/api/songs/route')
    db.song.create.mockImplementation(async ({data}: any) => ({
      id: 's9',
      ...data,
    }))
    expect((await POST(json('/api/songs', 'POST', {title: ' '}))).status).toBe(
      400,
    )
    const res = await POST(
      json('/api/songs', 'POST', {title: 'Sway', writer: 'Ruiz'}),
    )
    expect(await res.json()).toEqual({id: 's9'})
    expect(db.chartVersion.create.mock.calls[0][0].data).toMatchObject({
      songId: 's9',
      number: 1,
      source: '{title: Sway}\n',
      note: 'Created',
    })
    await POST(json('/api/songs', 'POST', {title: 'B', source: '[C]x'}))
    expect(db.chartVersion.create.mock.calls[1][0].data.source).toBe('[C]x')
  })

  it('GET/PATCH/DELETE one song, only in this band', async () => {
    const mod = await import('@/app/api/songs/[id]/route')
    const req = json('/x', 'GET')
    expect((await mod.GET(req, p('s1'))).status).toBe(404)
    db.song.findFirst.mockResolvedValue({
      id: 's1',
      title: 'Sway',
      writer: null,
      chartVersions: [{number: 2}],
    })
    expect(await (await mod.GET(req, p('s1'))).json()).toMatchObject({
      id: 's1',
      latest: {number: 2},
    })

    expect(
      (await mod.PATCH(json('/x', 'PATCH', {seconds: 'long'}), p('s1'))).status,
    ).toBe(400)
    expect(
      (await mod.PATCH(json('/x', 'PATCH', {title: 'Sway'}), p('s1'))).status,
    ).toBe(204)
    expect(db.song.update).not.toHaveBeenCalled()
    await mod.PATCH(json('/x', 'PATCH', {writer: 'Ruiz'}), p('s1'))
    expect(db.song.update.mock.calls[0][0].data).toMatchObject({
      writer: 'Ruiz',
      updatedById: 'u1',
    })

    admin = false
    expect((await mod.DELETE(req, p('s1'))).status).toBe(403)
    admin = true
    expect((await mod.DELETE(req, p('s1'))).status).toBe(204)
    expect(db.song.delete).toHaveBeenCalledWith({where: {id: 's1'}})
    db.song.findFirst.mockResolvedValue(null)
    expect((await mod.DELETE(req, p('s1'))).status).toBe(404)
    expect(
      (await mod.PATCH(json('/x', 'PATCH', {writer: 'x'}), p('s1'))).status,
    ).toBe(404)
  })

  it('saves a chart as the next version; a stale base is a 409 with the latest', async () => {
    const {POST} = await import('@/app/api/songs/[id]/chart/route')
    expect((await POST(json('/x', 'POST', {source: ''}), p('s1'))).status).toBe(
      400,
    )
    expect(
      (await POST(json('/x', 'POST', {source: 'x', baseNumber: 1}), p('s1')))
        .status,
    ).toBe(404)
    db.song.findFirst.mockResolvedValue({id: 's1'})
    db.chartVersion.findFirst.mockResolvedValue({number: 2})
    db.song.update.mockResolvedValue({title: 'Sway'})
    db.chartVersion.create.mockImplementation(async ({data}: any) => data)
    const ok = await POST(
      json('/x', 'POST', {source: '[C]x', note: ' tidy ', baseNumber: 2}),
      p('s1'),
    )
    expect(await ok.json()).toEqual({number: 3})
    expect(db.chartVersion.create.mock.calls[0][0].data).toMatchObject({
      number: 3,
      note: 'tidy',
    })
    expect(db.activity.create.mock.calls[0][0].data.summary).toBe(
      'edited the chart for Sway — “tidy”',
    )
    const stale = await POST(
      json('/x', 'POST', {source: '[C]x', baseNumber: 1}),
      p('s1'),
    )
    expect(stale.status).toBe(409)
    expect((await stale.json()).latest).toBe(2)
  })

  it('restores an old version as a new one (admins)', async () => {
    const {POST} = await import(
      '@/app/api/songs/[id]/versions/[n]/restore/route'
    )
    const req = json('/x', 'POST')
    expect((await POST(req, p('s1', {n: 'x'}))).status).toBe(400)
    expect((await POST(req, p('s1', {n: '1'}))).status).toBe(404)
    db.chartVersion.findFirst.mockResolvedValue({number: 4, source: 'old'})
    db.song.findFirst.mockResolvedValue({id: 's1'})
    db.song.update.mockResolvedValue({title: 'Sway'})
    db.chartVersion.create.mockImplementation(async ({data}: any) => data)
    const res = await POST(req, p('s1', {n: '1'}))
    expect(await res.json()).toEqual({number: 5})
    expect(db.chartVersion.create.mock.calls[0][0].data).toMatchObject({
      restoredFrom: 1,
      note: 'Restored version 1',
    })
    admin = false
    expect((await POST(req, p('s1', {n: '1'}))).status).toBe(403)
  })

  it('lists versions', async () => {
    const {GET} = await import('@/app/api/songs/[id]/versions/route')
    db.chartVersion.findMany.mockResolvedValue([{number: 2}, {number: 1}])
    expect(await (await GET(json('/x', 'GET'), p('s1'))).json()).toEqual([
      {number: 2},
      {number: 1},
    ])
  })

  it('cues: mine for a song in this band; add text, refuse bad ones', async () => {
    const mod = await import('@/app/api/songs/[id]/cues/route')
    const form = (o: Record<string, string>) => {
      const f = new FormData()
      for (const [k, v] of Object.entries(o)) f.append(k, v)
      return new Request('http://t/x', {method: 'POST', body: f})
    }
    expect((await mod.GET(json('/x', 'GET'), p('s1'))).status).toBe(404)
    expect(
      (await mod.POST(form({kind: 'TEXT', text: 'x'}), p('s1'))).status,
    ).toBe(404)
    db.song.findFirst.mockResolvedValue({id: 's1'})
    expect(await (await mod.GET(json('/x', 'GET'), p('s1'))).json()).toEqual([])
    expect(
      (await mod.POST(form({kind: 'VIDEO', text: 'x'}), p('s1'))).status,
    ).toBe(400)
    expect(
      (await mod.POST(form({kind: 'TEXT', anchor: 'nope', text: 'x'}), p('s1')))
        .status,
    ).toBe(400)
    expect(
      (await mod.POST(form({kind: 'TEXT', text: '  '}), p('s1'))).status,
    ).toBe(400)
    expect((await mod.POST(form({kind: 'IMAGE'}), p('s1'))).status).toBe(400)
    db.cue.findFirst.mockResolvedValue({position: 2})
    db.cue.create.mockImplementation(async ({data}: any) => ({
      id: 'c1',
      createdAt: new Date(),
      updatedAt: new Date(),
      image: null,
      ...data,
    }))
    const res = await mod.POST(
      form({kind: 'TEXT', anchor: 'chorus#1', text: ' count in '}),
      p('s1'),
    )
    expect(res.status).toBe(201)
    expect(db.cue.create.mock.calls[0][0].data).toMatchObject({
      anchor: 'chorus#1',
      text: 'count in',
      position: 3,
    })
  })

  it('cues: an image must be a real picture', async () => {
    const {POST} = await import('@/app/api/songs/[id]/cues/route')
    db.song.findFirst.mockResolvedValue({id: 's1'})
    const send = (bytes: Uint8Array) => {
      const f = new FormData()
      f.append('kind', 'IMAGE')
      f.append('file', new Blob([bytes as BlobPart]))
      return POST(new Request('http://t/x', {method: 'POST', body: f}), p('s1'))
    }
    expect((await send(new Uint8Array([1, 2, 3]))).status).toBe(415)
    expect((await send(new Uint8Array(2_000_001))).status).toBe(413)
  })

  it('anything needs a session', async () => {
    session = null
    const {GET} = await import('@/app/api/songs/route')
    expect((await GET()).status).toBe(401)
  })
})
