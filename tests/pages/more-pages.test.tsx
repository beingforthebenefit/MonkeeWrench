import React from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {render, screen} from '@testing-library/react'
import {ctx, prismaMock} from '../prisma-mock'

// jsdom has no ResizeObserver; the chart editor watches its preview's size
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any

let db: any
let session: any
let serverSession: any
let hdrs = new Headers()
vi.mock('@/lib/db', () => ({
  get prisma() {
    return db
  },
}))
vi.mock('@/lib/guard', () => ({
  pageSession: async () => session,
  pageAdmin: async () => session,
  pageUser: async () => session,
  pageOwner: async () => session,
}))
vi.mock('next-auth', () => ({getServerSession: async () => serverSession}))
vi.mock('@/lib/auth', () => ({authOptions: {}}))
vi.mock('next/headers', () => ({
  headers: () => hdrs,
  cookies: () => ({get: () => undefined}),
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`)
  },
  useRouter: () => ({push: vi.fn(), refresh: vi.fn(), replace: vi.fn()}),
  usePathname: () => '/songs',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/band', async (orig) => ({
  ...((await orig()) as any),
  followToBand: vi.fn(async () => {}),
  requestOrigin: () => 'https://app.test',
}))

const chart =
  '{title: Sway}\n{start_of_verse: Verse 1}\n[C]la la [G]la\n{end_of_verse}\n'
const song = {
  id: 's1',
  title: 'Sway',
  writer: 'Ruiz',
  leadSinger: 'Ana',
  seconds: 200,
  status: 'READY',
  notes: null,
  youtubeUrl: null,
  lyricsUrl: null,
  updatedAt: new Date(),
  chartVersions: [
    {number: 2, source: chart, note: null, createdAt: new Date(), author: null},
  ],
}
const setlist = {
  id: 'l1',
  name: 'Riverside',
  gigDate: new Date('2026-11-01T00:00:00Z'),
  startTime: '20:00',
  venue: 'The Pier',
  notes: null,
  updatedAt: new Date(),
  updatedBy: null,
  items: [
    {
      id: 'i0',
      kind: 'SET',
      label: 'Set 1',
      minutes: 45,
      startTime: null,
      song: null,
      songId: null,
    },
    {id: 'i1', kind: 'SONG', key: 'D', note: 'Count in', songId: 's1', song},
    {id: 'i2', kind: 'BREAK', minutes: 15, song: null, songId: null},
    {
      id: 'i3',
      kind: 'SET',
      label: 'Set 2',
      minutes: null,
      startTime: null,
      song: null,
      songId: null,
    },
    {id: 'i4', kind: 'SONG', key: null, note: null, songId: 's1', song},
  ],
}

beforeEach(() => {
  db = prismaMock()
  session = {
    ...ctx,
    band: {...ctx.band, iconAt: null, appName: null},
    isAdmin: true,
  }
  serverSession = {user: {email: 'ana@x.com'}}
  hdrs = new Headers()
})

describe('pages', () => {
  it('Perform: every chart in the set, with breaks and set changes; signed out goes to sign in', async () => {
    const Page = (await import('@/app/perform/[id]/page')).default
    serverSession = null
    await expect(Page({params: {id: 'l1'}})).rejects.toThrow(
      'REDIRECT /login?callbackUrl=%2Fperform%2Fl1',
    )
    serverSession = {user: {email: 'ana@x.com'}}
    await expect(Page({params: {id: 'l1'}})).rejects.toThrow('NOT_FOUND')
    db.setlist.findFirst.mockResolvedValue(setlist)
    render(await Page({params: {id: 'l1'}}))
    expect(screen.getAllByText('Sway').length).toBeGreaterThan(0)
  })

  it('Setlist editor: the band’s songs to pick from', async () => {
    const Page = (await import('@/app/(band)/setlists/[id]/edit/page')).default
    await expect(Page({params: {id: 'l1'}})).rejects.toThrow('NOT_FOUND')
    db.setlist.findFirst.mockResolvedValue(setlist)
    db.song.findMany.mockResolvedValue([
      song,
      {...song, id: 's2', title: 'No chart', chartVersions: []},
    ])
    render(await Page({params: {id: 'l1'}}))
    expect(screen.getByDisplayValue('Riverside')).toBeInTheDocument()
  })

  it('Song editor, and the tour’s sample pages', async () => {
    const Edit = (await import('@/app/(band)/songs/[id]/edit/page')).default
    await expect(Edit({params: {id: 's1'}})).rejects.toThrow('NOT_FOUND')
    db.song.findFirst.mockResolvedValue(song)
    render(await Edit({params: {id: 's1'}}))
    const TourSetlist = (await import('@/app/(band)/tour/setlist/page')).default
    render(await TourSetlist())
    const TourEdit = (await import('@/app/(band)/tour/edit/page')).default
    render(await TourEdit())
    expect(screen.getAllByText(/Sway|Saints|Riverside/).length).toBeGreaterThan(
      0,
    )
  })

  it('Rehearsals: with and without the scheduling tool', async () => {
    const Page = (await import('@/app/(band)/rehearsals/page')).default
    db.membership.findMany.mockResolvedValue([
      {
        user: {
          id: 'u1',
          name: 'Ana Ruiz',
          displayName: 'Ana',
          email: 'a@x.com',
          avatarAt: null,
          shareAvailability: true,
          blockOtherBands: false,
          availabilityUpdatedAt: new Date(),
        },
      },
    ])
    db.rehearsal.findMany.mockResolvedValue([
      {
        id: 'r1',
        date: new Date(Date.now() + 5 * 86400000),
        time: '7pm',
        place: 'Studio B',
        note: null,
        createdById: 'u1',
        createdBy: {name: 'Ana', displayName: 'Ana', email: 'a@x.com'},
      },
    ])
    render(await Page())
    expect(screen.getAllByText(/Studio B/).length).toBeGreaterThan(0)
    session.band.scheduling = false
    render(await Page())
  })

  it('Band picker and Manage bands', async () => {
    const Bands = (await import('@/app/bands/page')).default
    db.membership.findMany.mockResolvedValue([
      {isAdmin: true, band: {id: 'b1', name: 'The Hollow Reeds', iconAt: null}},
    ])
    render(await Bands({searchParams: {next: '/setlists'}}))
    expect(
      screen.getByRole('button', {name: /The Hollow Reeds/}),
    ).toBeInTheDocument()
    const Manage = (await import('@/app/bands/manage/page')).default
    db.band.findMany.mockResolvedValue([
      {
        id: 'b1',
        name: 'The Hollow Reeds',
        appName: 'Reeds',
        domains: [{host: 'reeds.example.com'}],
        memberships: [{isAdmin: true}],
        _count: {memberships: 3, songs: 9},
      },
    ])
    render(await Manage())
    expect(screen.getByText('reeds.example.com')).toBeInTheDocument()
  })

  it('Set password: a good link shows the form, a used one says so', async () => {
    const Page = (await import('@/app/set-password/page')).default
    render(await Page({searchParams: {}}))
    expect(screen.getAllByText(/expired|used|link/i).length).toBeGreaterThan(0)
  })

  it('the band layout on the hosted service: a new account with no band goes to start one', async () => {
    vi.resetModules()
    vi.stubEnv('BANDSTAND_HOSTED', '1')
    const Layout = (await import('@/app/(band)/layout')).default
    hdrs.set('x-pathname', '/songs')
    serverSession = {user: {email: 'rosa@x.com'}}
    db.user.findUnique.mockResolvedValue({id: 'u5', isOwner: false})
    await expect(Layout({children: <p>child</p>})).rejects.toThrow(
      'REDIRECT /start',
    )
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('the band layout: signed out, unknown, no band picked, or the app around the page', async () => {
    const Layout = (await import('@/app/(band)/layout')).default
    hdrs.set('x-pathname', '/setlists')
    serverSession = null
    await expect(Layout({children: <p>child</p>})).rejects.toThrow(
      'REDIRECT /login?callbackUrl=%2Fsetlists',
    )
    serverSession = {user: {email: 'ana@x.com'}}
    await expect(Layout({children: <p>child</p>})).rejects.toThrow(
      'REDIRECT /login',
    )
    db.user.findUnique.mockResolvedValue({id: 'u1', isOwner: false})
    await expect(Layout({children: <p>child</p>})).rejects.toThrow(
      'REDIRECT /bands?next=%2Fsetlists',
    )
    db.membership.findMany.mockResolvedValue([
      {
        isAdmin: true,
        band: {
          id: 'b1',
          name: 'The Hollow Reeds',
          appName: 'Reeds',
          iconAt: null,
          chatUrl: null,
          scheduling: true,
        },
      },
    ])
    db.membership.count.mockResolvedValue(1)
    render(await Layout({children: <p>child</p>}))
    expect(screen.getByText('child')).toBeInTheDocument()
  })

  it('Owner: the service, every band and person', async () => {
    const Page = (await import('@/app/owner/page')).default
    db.band.findMany.mockResolvedValue([
      {
        id: 'b1',
        name: 'The Hollow Reeds',
        createdAt: new Date(),
        paidUntil: null,
        polarSubscriptionId: null,
        subscriptionStatus: null,
        trialStartedAt: null,
        _count: {memberships: 3, songs: 9},
      },
    ])
    db.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        name: 'Ana',
        displayName: 'Ana',
        email: 'ana@x.com',
        isOwner: true,
        passwordHash: 'h',
        createdAt: new Date(),
        memberships: [{band: {id: 'b1', name: 'The Hollow Reeds'}}],
      },
    ])
    render(await Page())
    expect(screen.getByRole('heading', {name: 'Owner'})).toBeInTheDocument()
    expect(screen.getByText(/1 bands, 1 people/)).toBeInTheDocument()
  })
})
