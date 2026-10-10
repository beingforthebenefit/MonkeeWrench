// @vitest-environment node
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {ctx, json, prismaMock} from '../prisma-mock'

let db: any
let session: any
let admin: boolean
let owner: boolean
const cookieSet = vi.fn()

vi.mock('@/lib/db', () => ({
  get prisma() {
    return db
  },
}))
vi.mock('@/lib/guard', () => {
  const need = () => {
    if (!session) throw new Response('Unauthorized', {status: 401})
    return session
  }
  return {
    requireUser: async () => need(),
    requireSession: async () => need(),
    requireAdmin: async () => {
      need()
      if (!admin) throw new Response('Forbidden', {status: 403})
      return session
    },
    requireOwner: async () => {
      need()
      if (!owner) throw new Response('Forbidden', {status: 403})
      return session
    },
  }
})
vi.mock('next/headers', () => ({cookies: () => ({set: cookieSet})}))
vi.mock('@/lib/band', async (orig) => ({
  ...((await orig()) as any),
  myBands: async () => [{id: 'b1'}, {id: 'b2'}],
}))

const p = (id: string) => ({params: {id}})

beforeEach(() => {
  db = prismaMock()
  session = {...ctx, band: {...ctx.band}}
  admin = true
  owner = true
  cookieSet.mockClear()
})

describe('/api/setlists', () => {
  it('lists, and creates one (with its rows when given)', async () => {
    const {GET, POST} = await import('@/app/api/setlists/route')
    db.setlist.findMany.mockResolvedValue([{id: 'l1'}])
    expect(await (await GET()).json()).toEqual([{id: 'l1'}])
    expect((await POST(json('/x', 'POST', {name: ''}))).status).toBe(400)
    db.setlist.create.mockResolvedValue({id: 'l9', name: 'Gig'})
    expect(
      await (await POST(json('/x', 'POST', {name: 'Gig'}))).json(),
    ).toEqual({id: 'l9'})
    expect(db.setlist.update).not.toHaveBeenCalled()
    db.setlist.findFirst.mockResolvedValue({id: 'l9', name: 'Gig', items: []})
    await POST(json('/x', 'POST', {name: 'Gig', venue: 'The Pier'}))
    expect(db.setlist.update.mock.calls[0][0].data).toMatchObject({
      venue: 'The Pier',
    })
  })

  it('GET one, 404 for another band’s', async () => {
    const {GET} = await import('@/app/api/setlists/[id]/route')
    expect((await GET(json('/x', 'GET'), p('l1'))).status).toBe(404)
    db.setlist.findFirst.mockResolvedValue({id: 'l1', items: []})
    expect(await (await GET(json('/x', 'GET'), p('l1'))).json()).toEqual({
      id: 'l1',
      items: [],
    })
  })

  it('PUT saves rows: songs from other bands dropped, changes described', async () => {
    const {PUT} = await import('@/app/api/setlists/[id]/route')
    expect(
      (await PUT(json('/x', 'PUT', {name: 'Gig', startTime: '25:00'}), p('l1')))
        .status,
    ).toBe(400)
    expect((await PUT(json('/x', 'PUT', {name: 'Gig'}), p('l1'))).status).toBe(
      404,
    )
    db.setlist.findFirst.mockResolvedValue({
      id: 'l1',
      name: 'Old name',
      items: [
        {kind: 'SONG', songId: 's1', song: {title: 'Sway'}},
        {kind: 'SONG', songId: 's2', song: {title: 'Mustang Sally'}},
      ],
    })
    db.song.findMany.mockResolvedValue([
      {id: 's2', title: 'Mustang Sally'},
      {id: 's3', title: 'Proud Mary'},
    ])
    const res = await PUT(
      json('/x', 'PUT', {
        name: 'Gig',
        gigDate: '2026-11-01',
        items: [
          {kind: 'SET', label: 'Set 1', minutes: 45, startTime: '20:00'},
          {songId: 's3', key: 'E'},
          {kind: 'SONG', songId: 's2', note: 'Ana sings'},
          {kind: 'SONG', songId: 'elsewhere'},
          {kind: 'BREAK', minutes: 15},
        ],
      }),
      p('l1'),
    )
    expect(res.status).toBe(204)
    const rows = db.setlistItem.createMany.mock.calls[0][0].data
    expect(rows.map((r: any) => r.kind)).toEqual([
      'SET',
      'SONG',
      'SONG',
      'BREAK',
    ])
    expect(rows[1]).toMatchObject({songId: 's3', key: 'E', position: 1})
    expect(rows[0]).toMatchObject({
      label: 'Set 1',
      minutes: 45,
      startTime: '20:00',
    })
    const summary = db.activity.create.mock.calls[0][0].data.summary
    expect(summary).toContain('renamed it from Old name')
    expect(summary).toContain('added Proud Mary')
    expect(summary).toContain('removed Sway')
    expect(summary).toContain('changed the sets and breaks')
    expect(db.setlist.update.mock.calls[0][0].data.gigDate).toEqual(
      new Date('2026-11-01'),
    )
  })

  it('PUT notices notes and order changes, and logs nothing when nothing changed', async () => {
    const {PUT} = await import('@/app/api/setlists/[id]/route')
    const before = {
      id: 'l1',
      name: 'Gig',
      items: [
        {kind: 'SONG', songId: 's1', note: null, key: null, song: {title: 'A'}},
        {kind: 'SONG', songId: 's2', note: null, key: null, song: {title: 'B'}},
      ],
    }
    db.setlist.findFirst.mockResolvedValue(before)
    db.song.findMany.mockResolvedValue([
      {id: 's1', title: 'A'},
      {id: 's2', title: 'B'},
    ])
    await PUT(
      json('/x', 'PUT', {
        name: 'Gig',
        items: [{songId: 's1', note: 'x'}, {songId: 's2'}],
      }),
      p('l1'),
    )
    expect(db.activity.create.mock.calls[0][0].data.summary).toContain(
      'changed song notes or keys',
    )
    await PUT(
      json('/x', 'PUT', {name: 'Gig', items: [{songId: 's2'}, {songId: 's1'}]}),
      p('l1'),
    )
    expect(db.activity.create.mock.calls[1][0].data.summary).toContain(
      'changed the order',
    )
    await PUT(
      json('/x', 'PUT', {name: 'Gig', items: [{songId: 's1'}, {songId: 's2'}]}),
      p('l1'),
    )
    expect(db.activity.create).toHaveBeenCalledTimes(2)
  })

  it('DELETE is for admins', async () => {
    const {DELETE} = await import('@/app/api/setlists/[id]/route')
    expect((await DELETE(json('/x', 'DELETE'), p('l1'))).status).toBe(404)
    db.setlist.findFirst.mockResolvedValue({id: 'l1', name: 'Gig'})
    expect((await DELETE(json('/x', 'DELETE'), p('l1'))).status).toBe(204)
    expect(db.activity.create.mock.calls[0][0].data.summary).toBe(
      'deleted the setlist Gig',
    )
    admin = false
    expect((await DELETE(json('/x', 'DELETE'), p('l1'))).status).toBe(403)
  })
})

describe('/api/rehearsals', () => {
  it('sets one, and checks the date', async () => {
    const {POST} = await import('@/app/api/rehearsals/route')
    expect((await POST(json('/x', 'POST', {date: 'Saturday'}))).status).toBe(
      400,
    )
    db.rehearsal.create.mockImplementation(async ({data}: any) => ({
      id: 'r1',
      ...data,
    }))
    const res = await POST(
      json('/x', 'POST', {date: '2026-10-24', time: '3pm', place: ''}),
    )
    expect(await res.json()).toEqual({id: 'r1'})
    expect(db.rehearsal.create.mock.calls[0][0].data).toMatchObject({
      date: new Date('2026-10-24T00:00:00Z'),
      time: '3pm',
      place: null,
    })
    expect(db.activity.create.mock.calls[0][0].data.summary).toMatch(
      /set a rehearsal for .* at 3pm/,
    )
  })

  it('cancels: whoever set it, or an admin', async () => {
    const {DELETE} = await import('@/app/api/rehearsals/[id]/route')
    expect((await DELETE(json('/x', 'DELETE'), p('r1'))).status).toBe(404)
    db.rehearsal.findFirst.mockResolvedValue({
      id: 'r1',
      createdById: 'someone',
      date: new Date('2026-10-24'),
    })
    session.isAdmin = false
    expect((await DELETE(json('/x', 'DELETE'), p('r1'))).status).toBe(403)
    session.isAdmin = true
    expect((await DELETE(json('/x', 'DELETE'), p('r1'))).status).toBe(204)
  })
})

describe('/api/cues/[id]', () => {
  it('edits only my own cue; text can’t be emptied unless it’s a picture', async () => {
    const {PATCH, DELETE} = await import('@/app/api/cues/[id]/route')
    expect(
      (await PATCH(json('/x', 'PATCH', {text: 'x'}), p('c1'))).status,
    ).toBe(404)
    db.cue.findFirst.mockResolvedValue({id: 'c1', kind: 'TEXT'})
    expect(
      (await PATCH(json('/x', 'PATCH', {anchor: 'bad'}), p('c1'))).status,
    ).toBe(400)
    expect((await PATCH(json('/x', 'PATCH', {text: ''}), p('c1'))).status).toBe(
      400,
    )
    db.cue.update.mockImplementation(async ({data}: any) => ({
      id: 'c1',
      kind: 'TEXT',
      anchor: '',
      position: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      image: null,
      ...data,
    }))
    const ok = await PATCH(
      json('/x', 'PATCH', {text: 'louder', position: 2}),
      p('c1'),
    )
    expect(ok.status).toBe(200)
    expect(db.cue.update.mock.calls[0][0].data).toEqual({
      position: 2,
      text: 'louder',
    })
    db.cue.findFirst.mockResolvedValue({id: 'c1', kind: 'IMAGE'})
    await PATCH(json('/x', 'PATCH', {text: ''}), p('c1'))
    expect(db.cue.update.mock.calls[1][0].data).toEqual({text: null})
    expect((await DELETE(json('/x', 'DELETE'), p('c1'))).status).toBe(404)
    db.cue.deleteMany.mockResolvedValue({count: 1})
    expect((await DELETE(json('/x', 'DELETE'), p('c1'))).status).toBe(204)
    expect(db.cue.deleteMany.mock.calls[1][0].where).toEqual({
      id: 'c1',
      userId: 'u1',
    })
  })
})

describe('/api/bands (owner)', () => {
  it('lists and starts bands, with a free slug', async () => {
    const {GET, POST} = await import('@/app/api/bands/route')
    db.band.findMany.mockResolvedValue([{id: 'b1'}])
    expect(await (await GET()).json()).toEqual([{id: 'b1'}])
    expect((await POST(json('/x', 'POST', {name: ''}))).status).toBe(400)
    db.band.findUnique
      .mockResolvedValueOnce({id: 'taken'})
      .mockResolvedValueOnce(null)
    db.band.create.mockImplementation(async ({data}: any) => ({
      id: 'b9',
      ...data,
    }))
    expect((await POST(json('/x', 'POST', {name: 'Riverside'}))).status).toBe(
      201,
    )
    expect(db.band.create.mock.calls[0][0].data).toEqual({
      name: 'Riverside',
      slug: 'riverside-2',
    })
    expect(db.membership.create.mock.calls[0][0].data).toEqual({
      userId: 'u1',
      bandId: 'b9',
      isAdmin: true,
    })
    owner = false
    expect((await GET()).status).toBe(403)
  })

  it('sets a band’s web addresses, never one another band has', async () => {
    const {PUT} = await import('@/app/api/bands/[id]/route')
    expect(
      (await PUT(json('/x', 'PUT', {domains: ['not a host']}), p('b1'))).status,
    ).toBe(400)
    expect(
      (await PUT(json('/x', 'PUT', {domains: ['band.example.com']}), p('b1')))
        .status,
    ).toBe(404)
    db.band.findUnique.mockResolvedValue({id: 'b1'})
    db.bandDomain.findFirst.mockResolvedValueOnce({
      host: 'band.example.com',
      band: {name: 'Riverside'},
    })
    const taken = await PUT(
      json('/x', 'PUT', {domains: ['band.example.com']}),
      p('b1'),
    )
    expect(taken.status).toBe(409)
    expect((await taken.json()).error).toBe(
      'band.example.com already belongs to Riverside.',
    )
    expect(
      (
        await PUT(
          json('/x', 'PUT', {domains: ['a.example.com', 'a.example.com']}),
          p('b1'),
        )
      ).status,
    ).toBe(204)
    expect(db.bandDomain.createMany.mock.calls[0][0].data).toEqual([
      {host: 'a.example.com', bandId: 'b1'},
    ])
  })

  it('switches the current band only to one I’m in', async () => {
    const {POST} = await import('@/app/api/bands/current/route')
    expect((await POST(json('/x', 'POST', {}))).status).toBe(400)
    expect((await POST(json('/x', 'POST', {bandId: 'b7'}))).status).toBe(404)
    expect((await POST(json('/x', 'POST', {bandId: 'b2'}))).status).toBe(204)
    expect(cookieSet.mock.calls[0][1]).toBe('b2')
  })
})

describe('/api/band', () => {
  it('GET is the current band; PATCH logs only what changed', async () => {
    const {GET, PATCH} = await import('@/app/api/band/route')
    expect(await (await GET()).json()).toMatchObject({id: 'b1'})
    expect(
      (await PATCH(json('/x', 'PATCH', {name: 'The Hollow Reeds'}))).status,
    ).toBe(204)
    expect(db.band.update).not.toHaveBeenCalled()
    expect((await PATCH(json('/x', 'PATCH', {voteThreshold: 0}))).status).toBe(
      400,
    )
    await PATCH(json('/x', 'PATCH', {voteThreshold: 3, scheduling: false}))
    expect(db.activity.create.mock.calls[0][0].data.summary).toBe(
      'changed the votes needed, the scheduling tool',
    )
  })
})

describe('/api/export', () => {
  it('the band in the import format, with only my cues', async () => {
    const {GET} = await import('@/app/api/export/route')
    db.song.findMany.mockResolvedValue([
      {
        title: 'Sway',
        writer: 'Ruiz',
        leadSinger: null,
        seconds: 180,
        youtubeUrl: null,
        notes: null,
        status: 'READY',
        chartVersions: [{source: '[C]x'}],
        cues: [{kind: 'TEXT', text: 'soft', anchor: ''}],
      },
      {
        title: 'Listed',
        writer: null,
        leadSinger: null,
        seconds: null,
        youtubeUrl: null,
        notes: null,
        status: 'LEARNING',
        chartVersions: [],
        cues: [],
      },
    ])
    db.setlist.findMany.mockResolvedValue([
      {
        name: 'Gig',
        gigDate: new Date('2026-11-01T00:00:00Z'),
        startTime: '20:00',
        venue: null,
        notes: null,
        items: [
          {kind: 'SET', label: 'Set 1', minutes: 45},
          {kind: 'SONG', song: {title: 'Sway'}, key: 'D', note: null},
          {kind: 'SONG', song: null},
          {kind: 'BREAK', minutes: 15},
        ],
      },
    ])
    db.rehearsal.findMany.mockResolvedValue([
      {
        date: new Date('2026-10-24T00:00:00Z'),
        time: '3pm',
        place: null,
        note: null,
      },
    ])
    const res = await GET()
    expect(res.headers.get('Content-Disposition')).toMatch(
      /attachment; filename="the-hollow-reeds-\d{4}-\d{2}-\d{2}\.bandstand\.json"/,
    )
    const body = await res.json()
    expect(body).toMatchObject({
      format: 'bandstand',
      version: 1,
      band: 'The Hollow Reeds',
    })
    expect(body.songs[0]).toMatchObject({
      title: 'Sway',
      chart: {chordpro: '[C]x'},
      cues: [{kind: 'TEXT', text: 'soft', anchor: ''}],
    })
    expect(body.songs[1]).toMatchObject({chart: null})
    expect(body.songs[1].cues).toBeUndefined()
    expect(body.setlists[0]).toMatchObject({
      gigDate: '2026-11-01',
      items: [
        {set: 'Set 1', minutes: 45},
        {song: 'Sway', key: 'D', note: null},
        {break: 15},
      ],
    })
    expect(body.rehearsals).toEqual([
      {date: '2026-10-24', time: '3pm', place: null, note: null},
    ])
    expect(db.song.findMany.mock.calls[0][0].include.cues.where.userId).toBe(
      'u1',
    )
    // What it exports, Import takes back
    const {BandImport} = await import('@/lib/band-import-schema')
    expect(BandImport.safeParse(body).success).toBe(true)
    admin = false
    expect((await GET()).status).toBe(403)
  })
})
