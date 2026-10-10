// @vitest-environment node
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {prismaMock} from '../prisma-mock'

let db: any
let cookie: string | undefined
let hdrs = new Headers()
vi.mock('@/lib/db', () => ({
  get prisma() {
    return db
  },
}))
vi.mock('next/headers', () => ({
  headers: () => hdrs,
  cookies: () => ({get: () => (cookie ? {value: cookie} : undefined)}),
}))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`)
  },
}))

beforeEach(() => {
  db = prismaMock()
  cookie = undefined
  hdrs = new Headers()
})

const who = (id: string, name: string) => ({
  id,
  name,
  displayName: null,
  email: `${id}@x.com`,
  avatarAt: null,
})

describe('getBoard', () => {
  it('pending with voters and mine, approved linked to its song, archived', async () => {
    const {getBoard} = await import('@/lib/proposals')
    const at = new Date('2026-10-01T00:00:00Z')
    db.proposal.findMany
      .mockResolvedValueOnce([
        {
          id: 'p1',
          title: 'Proud Mary',
          artist: 'CCR',
          youtubeUrl: null,
          lyricsUrl: null,
          createdAt: at,
          proposer: who('u2', 'Bo Diddley'),
          votes: [{userId: 'u1', user: who('u1', 'Ana Ruiz')}],
        },
      ])
      .mockResolvedValueOnce([
        {id: 'p2', title: 'Sway', artist: 'Dean', updatedAt: at},
        {id: 'p3', title: 'Gone', artist: 'X', updatedAt: at},
      ])
      .mockResolvedValueOnce([
        {id: 'p4', title: 'Old', artist: 'Y', proposer: null},
      ])
    db.song.findMany.mockResolvedValue([{id: 's1', title: 'sway'}])
    const b = await getBoard('u1', {id: 'b1', voteThreshold: 3})
    expect(b.threshold).toBe(3)
    expect(b.pending[0]).toMatchObject({
      proposer: 'Bo',
      voters: [{name: 'Ana', avatar: null}],
      mine: true,
      proposedAt: at.toISOString(),
    })
    expect(b.approved.map((a) => a.songId)).toEqual(['s1', null])
    expect(b.archived[0]).toEqual({
      id: 'p4',
      title: 'Old',
      artist: 'Y',
      proposer: 'someone',
    })
  })
})

describe('band lib', () => {
  it('requestHost and requestOrigin follow the proxy’s headers', async () => {
    const {requestHost, requestOrigin} = await import('@/lib/band')
    hdrs.set('host', 'localhost:3000')
    expect(requestHost()).toBe('localhost')
    expect(requestOrigin()).toBe('http://localhost:3000')
    hdrs.set('x-forwarded-host', 'Band.Example.com:443, other')
    hdrs.set('x-forwarded-proto', 'https')
    expect(requestHost()).toBe('band.example.com')
    expect(requestOrigin()).toBe('https://Band.Example.com:443')
    expect(requestOrigin(new Headers())).toBe(
      (process.env.NEXTAUTH_URL ?? '').replace(/\/$/, ''),
    )
  })

  it('a web address brands the sign-in page; none is Bandstand', async () => {
    const {brandForRequest, bandForHost} = await import('@/lib/band')
    expect(await bandForHost('')).toBeNull()
    expect(await brandForRequest()).toEqual({
      band: null,
      appName: 'Bandstand',
      iconUrl: '/icons/default-512.png',
    })
    hdrs.set('host', 'reeds.example.com')
    const at = new Date(1000)
    db.bandDomain.findUnique.mockResolvedValue({
      band: {id: 'b1', appName: 'Reeds', iconAt: at},
    })
    expect(await brandForRequest()).toMatchObject({
      appName: 'Reeds',
      iconUrl: '/brand/b1/icon.png?v=1000',
    })
  })

  it('the current band: the chosen one, or the only one', async () => {
    const {currentBand} = await import('@/lib/band')
    db.membership.findMany.mockResolvedValue([
      {isAdmin: true, band: {id: 'b1', name: 'A'}},
      {isAdmin: false, band: {id: 'b2', name: 'B'}},
    ])
    expect((await currentBand('u1')).band).toBeNull()
    cookie = 'b2'
    expect((await currentBand('u1')).band).toMatchObject({
      id: 'b2',
      isAdmin: false,
    })
  })

  it('bandSite: its own address, else this install’s', async () => {
    const {bandSite} = await import('@/lib/band')
    expect(await bandSite('b1')).toBe(
      (process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
    )
    db.bandDomain.findFirst.mockResolvedValue({host: 'reeds.example.com'})
    expect(await bandSite('b1')).toBe('https://reeds.example.com')
  })

  it('shareABand, adminOver', async () => {
    const {shareABand, adminOver} = await import('@/lib/band')
    expect(await shareABand('u1', 'u1')).toBe(true)
    expect(await shareABand('u1', 'u2')).toBe(false)
    db.membership.count.mockResolvedValue(1)
    expect(await shareABand('u1', 'u2')).toBe(true)
    expect(await adminOver('u1', 'u2')).toBe(true)
  })

  it('canManageAccount: only an admin of every band they’re in (or the owner, or yourself)', async () => {
    const {canManageAccount} = await import('@/lib/band')
    expect(await canManageAccount({id: 'o', isOwner: true}, 'u2')).toBe(true)
    expect(await canManageAccount({id: 'u2', isOwner: false}, 'u2')).toBe(true)
    expect(await canManageAccount({id: 'u1', isOwner: false}, 'u2')).toBe(false)
    db.membership.findMany.mockResolvedValue([{bandId: 'b1'}, {bandId: 'b2'}])
    db.membership.count.mockResolvedValue(1)
    expect(await canManageAccount({id: 'u1', isOwner: false}, 'u2')).toBe(false)
    db.membership.count.mockResolvedValue(2)
    expect(await canManageAccount({id: 'u1', isOwner: false}, 'u2')).toBe(true)
  })

  it('followToBand switches to the band that has it, if I’m in it', async () => {
    const {followToBand} = await import('@/lib/band')
    await followToBand('song', 's1', 'u1', '/songs/s1')
    db.setlist.findFirst.mockResolvedValue({bandId: 'b2'})
    await expect(
      followToBand('setlist', 'l1', 'u1', '/setlists/l1'),
    ).rejects.toThrow('REDIRECT /bands/switch?to=b2&next=%2Fsetlists%2Fl1')
  })
})

describe('availability-server', () => {
  const people = [
    {id: 'u1', shareAvailability: true, blockOtherBands: true},
    {id: 'u2', shareAvailability: false, blockOtherBands: false},
  ]
  const from = new Date('2026-10-01')
  const to = new Date('2026-10-31')

  it('bandEntries: each person’s days off from the scope they use', async () => {
    const {bandEntries} = await import('@/lib/availability-server')
    db.unavailability.findMany.mockResolvedValue([
      {
        userId: 'u1',
        scope: '',
        date: new Date('2026-10-12T00:00:00Z'),
        kind: 'OUT',
      },
      {
        userId: 'u1',
        scope: 'b1',
        date: new Date('2026-10-13T00:00:00Z'),
        kind: 'OUT',
      },
      {
        userId: 'u2',
        scope: 'b1',
        date: new Date('2026-10-14T00:00:00Z'),
        kind: 'PM_OUT',
      },
      {
        userId: 'u2',
        scope: '',
        date: new Date('2026-10-15T00:00:00Z'),
        kind: 'OUT',
      },
    ])
    expect(await bandEntries('b1', people, from, to)).toEqual([
      {userId: 'u1', date: '2026-10-12', kind: 'OUT'},
      {userId: 'u2', date: '2026-10-14', kind: 'PM_OUT'},
    ])
  })

  it('otherBandBlocks: named for bands I’m in too, anonymous otherwise', async () => {
    const {otherBandBlocks, rehearsalKind} = await import(
      '@/lib/availability-server'
    )
    expect(rehearsalKind('1-4pm')).toBe('PM_OUT')
    expect(rehearsalKind('7pm')).toBe('OUT')
    expect(await otherBandBlocks('b1', [people[1]], 'u9', from, to)).toEqual([])
    expect(await otherBandBlocks('b1', people, 'u9', from, to)).toEqual([])
    db.membership.findMany
      .mockResolvedValueOnce([
        {userId: 'u1', band: {id: 'b2', name: 'Riverside'}},
        {userId: 'u1', band: {id: 'b3', name: 'Secret'}},
      ])
      .mockResolvedValueOnce([{bandId: 'b2'}])
    db.rehearsal.findMany.mockResolvedValue([
      {bandId: 'b2', date: new Date('2026-10-12T00:00:00Z'), time: '1-4pm'},
    ])
    db.setlist.findMany.mockResolvedValue([
      {bandId: 'b3', gigDate: new Date('2026-10-20T00:00:00Z')},
    ])
    expect(await otherBandBlocks('b1', people, 'u9', from, to)).toEqual([
      {
        userId: 'u1',
        date: '2026-10-12',
        kind: 'PM_OUT',
        label: 'Rehearsal with Riverside (1-4pm)',
      },
      {
        userId: 'u1',
        date: '2026-10-20',
        kind: 'OUT',
        label: 'Busy with another band',
      },
    ])
  })

  it('setSharing: merging keeps the strongest mark; splitting copies to every band', async () => {
    const {setSharing} = await import('@/lib/availability-server')
    db.membership.findMany.mockResolvedValue([{bandId: 'b1'}, {bandId: 'b2'}])
    db.unavailability.findMany
      .mockResolvedValueOnce([
        {date: new Date('2026-10-12T00:00:00Z'), kind: 'OUT', scope: 'b1'},
        {
          date: new Date('2026-10-13T00:00:00Z'),
          kind: 'PREFER_NOT',
          scope: 'b2',
        },
      ])
      .mockResolvedValueOnce([
        {date: new Date('2026-10-12T00:00:00Z'), kind: 'PM_OUT', scope: ''},
        {date: new Date('2026-10-13T00:00:00Z'), kind: 'PM_OUT', scope: ''},
      ])
    await setSharing(db, 'u1', true)
    expect(
      db.unavailability.createMany.mock.calls[0][0].data.map((r: any) => [
        r.date.toISOString().slice(0, 10),
        r.kind,
      ]),
    ).toEqual([
      ['2026-10-12', 'OUT'],
      ['2026-10-13', 'PM_OUT'],
    ])
    db.unavailability.findMany.mockResolvedValueOnce([
      {date: new Date('2026-10-12T00:00:00Z'), kind: 'OUT', scope: ''},
    ])
    await setSharing(db, 'u1', false)
    expect(
      db.unavailability.createMany.mock.calls[1][0].data.map(
        (r: any) => r.scope,
      ),
    ).toEqual(['b1', 'b2'])
    expect(db.user.update.mock.calls[1][0].data).toEqual({
      shareAvailability: false,
    })
  })
})
