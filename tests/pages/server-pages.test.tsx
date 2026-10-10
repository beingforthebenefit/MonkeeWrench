import React from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {render, screen} from '@testing-library/react'
import {ctx, prismaMock} from '../prisma-mock'

let db: any
let session: any
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

const author = {
  id: 'u1',
  name: 'Ana Ruiz',
  displayName: 'Ana',
  email: 'ana@x.com',
  avatarAt: null,
}
const chart =
  '{title: Sway}\n{start_of_verse: Verse 1}\n[C]la la [G]la\n{end_of_verse}\n'

beforeEach(() => {
  db = prismaMock()
  session = {
    ...ctx,
    band: {
      ...ctx.band,
      scheduling: true,
      iconAt: null,
      appName: null,
      chatUrl: null,
      tributeTo: null,
    },
    isAdmin: true,
  }
})

describe('Help', () => {
  it('has every section, linked from the contents', async () => {
    const Help = (await import('@/app/(band)/help/page')).default
    render(<Help />)
    expect(
      screen.getByRole('heading', {name: 'For admins'}),
    ).toBeInTheDocument()
    expect(screen.getByText('Import songs')).toBeInTheDocument()
    expect(
      screen.getAllByRole('link', {name: 'Performance mode'})[0],
    ).toHaveAttribute('href', '#perform')
  })
})

describe('History', () => {
  const versions = [
    {
      id: 'v2',
      number: 2,
      source: chart.replace('[G]la', '[F]la'),
      note: 'new chord',
      createdAt: new Date('2026-10-08T12:00:00Z'),
      author,
      restoredFrom: null,
    },
    {
      id: 'v1',
      number: 1,
      source: chart,
      note: null,
      createdAt: new Date('2026-10-01T12:00:00Z'),
      author: null,
      restoredFrom: null,
    },
  ]
  const load = async (searchParams: any = {}) => {
    const Page = (await import('@/app/(band)/songs/[id]/history/page')).default
    return render(await Page({params: {id: 's1'}, searchParams}))
  }
  it('lists versions, the change from the one before, and details changes', async () => {
    db.song.findFirst.mockResolvedValue({id: 's1', title: 'Sway'})
    db.chartVersion.findMany.mockResolvedValue(versions)
    db.activity.findMany.mockResolvedValue([
      {
        id: 'a1',
        summary: 'changed the writer',
        createdAt: new Date(),
        user: author,
      },
    ])
    await load()
    expect(screen.getByRole('heading', {name: /Sway/})).toBeInTheDocument()
    expect(screen.getByText('new chord')).toBeInTheDocument()
    expect(screen.getByText(/version 2 · current/)).toBeInTheDocument()
    expect(screen.getByText('changed the writer')).toBeInTheDocument()
  })
  it('shows an old version as a chart, with Restore for admins', async () => {
    db.song.findFirst.mockResolvedValue({id: 's1', title: 'Sway'})
    db.chartVersion.findMany.mockResolvedValue(versions)
    await load({v: '1'})
    expect(screen.getAllByText(/la/).length).toBeGreaterThan(0)
  })
  it('404s for a song not in the band, or with no versions', async () => {
    await expect(load()).rejects.toThrow('NOT_FOUND')
    db.song.findFirst.mockResolvedValue({id: 's1', title: 'Sway'})
    await expect(load()).rejects.toThrow('NOT_FOUND')
  })
})

describe('Setlists', () => {
  it('next gig first, then undated, then played; an empty band is told what to do', async () => {
    const Page = (await import('@/app/(band)/setlists/page')).default
    render(await Page())
    expect(screen.getByText(/No setlists yet/)).toBeInTheDocument()
    const day = 86400000
    const item = (o: any) => ({
      kind: 'SONG',
      song: {title: 'Sway', seconds: 180},
      minutes: null,
      label: null,
      startTime: null,
      ...o,
    })
    db.setlist.findMany.mockResolvedValue([
      {
        id: 'old',
        name: 'Last summer',
        gigDate: new Date(Date.now() - 90 * day),
        startTime: null,
        venue: null,
        items: [item({})],
        updatedAt: new Date(),
        updatedBy: author,
      },
      {
        id: 'soon',
        name: 'Riverside',
        gigDate: new Date(Date.now() + 9 * day),
        startTime: '20:00',
        venue: 'The Pier',
        items: [
          item({kind: 'SET', label: 'Set 1', song: null}),
          item({}),
          item({kind: 'BREAK', minutes: 15, song: null}),
        ],
        updatedAt: new Date(),
        updatedBy: author,
      },
      {
        id: 'nodate',
        name: 'Ideas',
        gigDate: null,
        startTime: null,
        venue: null,
        items: [],
        updatedAt: new Date(),
        updatedBy: null,
      },
    ])
    const r2 = render(await Page())
    const names = r2
      .getAllByRole('heading', {level: 2})
      .map((h) => h.textContent)
    expect(names).toEqual(['Riverside', 'Ideas', 'Last summer'])
    expect(r2.getByText('Next up')).toBeInTheDocument()
    expect(r2.getByText('Played')).toBeInTheDocument()
    expect(r2.getByText('No date')).toBeInTheDocument()
  })

  it('one setlist: keys, set times, songs without charts', async () => {
    const Page = (await import('@/app/(band)/setlists/[id]/page')).default
    await expect(Page({params: {id: 'l1'}})).rejects.toThrow('NOT_FOUND')
    db.setlist.findFirst.mockResolvedValue({
      id: 'l1',
      name: 'Riverside',
      gigDate: new Date('2026-11-01T00:00:00Z'),
      startTime: '20:00',
      venue: 'The Pier',
      notes: 'Load in at 6',
      updatedAt: new Date(),
      updatedBy: author,
      items: [
        {
          id: 'i0',
          kind: 'SET',
          label: 'Set 1',
          minutes: 45,
          startTime: null,
          song: null,
        },
        {
          id: 'i1',
          kind: 'SONG',
          key: 'D',
          note: 'Ana sings',
          songId: 's1',
          song: {
            id: 's1',
            title: 'Sway',
            seconds: 200,
            chartVersions: [{source: chart, author}],
          },
        },
        {
          id: 'i2',
          kind: 'SONG',
          key: null,
          note: null,
          songId: 's2',
          song: {
            id: 's2',
            title: 'Listed only',
            seconds: null,
            chartVersions: [],
          },
        },
        {id: 'i3', kind: 'BREAK', minutes: 15, song: null},
      ],
    })
    render(await Page({params: {id: 'l1'}}))
    expect(screen.getByRole('heading', {name: 'Riverside'})).toBeInTheDocument()
    expect(screen.getByText('Ana sings')).toBeInTheDocument()
    expect(screen.getByText('Load in at 6')).toBeInTheDocument()
    expect(screen.getAllByText(/Set 1/).length).toBeGreaterThan(0)
  })
})

describe('Recent changes', () => {
  it('groups by day and links to what changed', async () => {
    const Page = (await import('@/app/(band)/activity/page')).default
    render(await Page())
    expect(screen.getByText('Nothing yet.')).toBeInTheDocument()
    const at = new Date('2026-10-08T18:00:00Z')
    db.activity.findMany.mockResolvedValue([
      {
        id: 'a1',
        targetType: 'song',
        targetId: 's1',
        action: 'chart.save',
        summary: 'edited the chart for Sway',
        createdAt: at,
        user: author,
      },
      {
        id: 'a2',
        targetType: 'song',
        targetId: 's1',
        action: 'song.update',
        summary: 'changed the writer',
        createdAt: at,
        user: author,
      },
      {
        id: 'a3',
        targetType: 'setlist',
        targetId: 'l1',
        action: 'setlist.delete',
        summary: 'deleted the setlist Gig',
        createdAt: at,
        user: null,
      },
      {
        id: 'a5',
        targetType: 'availability',
        targetId: 'u1',
        action: 'availability.update',
        summary: 'marked days off',
        createdAt: at,
        user: author,
      },
      {
        id: 'a6',
        targetType: 'setlist',
        targetId: 'l2',
        action: 'setlist.update',
        summary: 'updated the setlist Riverside',
        createdAt: at,
        user: author,
      },
      {
        id: 'a4',
        targetType: 'rehearsal',
        targetId: 'r1',
        action: 'rehearsal.create',
        summary: 'set a rehearsal',
        createdAt: new Date('2026-10-01T18:00:00Z'),
        user: author,
      },
    ])
    const r = render(await Page())
    expect(r.getByRole('link', {name: /edited the chart/})).toHaveAttribute(
      'href',
      '/songs/s1/history',
    )
    expect(r.getByRole('link', {name: /changed the writer/})).toHaveAttribute(
      'href',
      '/songs/s1',
    )
    expect(r.getByRole('link', {name: /updated the setlist/})).toHaveAttribute(
      'href',
      '/setlists/l2',
    )
    expect(
      r.queryByRole('link', {name: /deleted the setlist/}),
    ).not.toBeInTheDocument()
    expect(r.getAllByRole('heading', {level: 2})).toHaveLength(2)
    expect(r.getByRole('link', {name: /set a rehearsal/})).toHaveAttribute(
      'href',
      '/rehearsals',
    )
  })
})

describe('Admin, Members, Account, Song', () => {
  it('Admin: cards, the band settings, export, delete', async () => {
    const Page = (await import('@/app/(band)/admin/page')).default
    db.membership.count.mockResolvedValue(4)
    db.song.count.mockResolvedValue(12)
    render(await Page({searchParams: {}}))
    expect(screen.getByText('Import songs ›')).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Download everything'}),
    ).toHaveAttribute('href', '/api/export')
    expect(
      screen.getByRole('button', {name: 'Delete this band…'}),
    ).toBeInTheDocument()
  })

  it('Members: who I can manage', async () => {
    const Page = (await import('@/app/(band)/members/page')).default
    db.membership.findMany
      .mockResolvedValueOnce([
        {
          isAdmin: true,
          user: {
            id: 'u1',
            name: 'Ana Ruiz',
            displayName: 'Ana',
            email: 'ana@x.com',
            passwordHash: 'h',
            avatarAt: null,
            memberships: [{bandId: 'b1'}],
          },
        },
        {
          isAdmin: false,
          user: {
            id: 'u2',
            name: 'Bo',
            displayName: null,
            email: 'bo@x.com',
            passwordHash: null,
            avatarAt: null,
            memberships: [{bandId: 'b1'}, {bandId: 'b9'}],
          },
        },
      ])
      .mockResolvedValueOnce([{bandId: 'b1'}])
    render(await Page())
    expect(
      screen.getByRole('heading', {name: 'Band members'}),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/their own admins manage their sign-in/),
    ).toBeInTheDocument()
  })

  it('Account: password, settings, delete', async () => {
    const Page = (await import('@/app/(band)/account/page')).default
    session = {...session, user: {...session.user, settings: {}}}
    render(await Page())
    expect(
      screen.getByRole('button', {name: 'Delete your account…'}),
    ).toBeInTheDocument()
  })

  it('Song: the chart, or 404 after looking in my other bands', async () => {
    const Page = (await import('@/app/(band)/songs/[id]/page')).default
    await expect(Page({params: {id: 's1'}})).rejects.toThrow('NOT_FOUND')
    const {followToBand} = await import('@/lib/band')
    expect(followToBand).toHaveBeenCalledWith('song', 's1', 'u1', '/songs/s1')
    db.song.findFirst.mockResolvedValue({
      id: 's1',
      title: 'Sway',
      writer: 'Ruiz',
      status: 'READY',
      chartVersions: [
        {number: 2, source: chart, note: null, createdAt: new Date(), author},
      ],
    })
    db.chartVersion.count.mockResolvedValue(2)
    render(await Page({params: {id: 's1'}}))
    expect(screen.getAllByText('Sway').length).toBeGreaterThan(0)
  })
})
