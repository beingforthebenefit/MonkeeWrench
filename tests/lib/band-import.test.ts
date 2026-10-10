import {beforeEach, describe, expect, it, vi} from 'vitest'
import {chartSource, importBand} from '@/lib/band-import'

vi.mock('@/lib/db', () => ({prisma: {}}))

// A tiny in-memory band: songs, cues, setlists, rehearsals
function fakeDb(existing: {id: string; title: string; source?: string}[] = []) {
  const songs = existing.map((s) => ({
    ...s,
    chartVersions: s.source ? [{source: s.source}] : [],
  }))
  const created: any = {
    songs: [],
    cues: [],
    setlists: [],
    rehearsals: [],
    activity: [],
  }
  let n = 0
  const findSong = async ({where}: any) =>
    songs.find(
      (s) => s.title.toLowerCase() === where.title.equals.toLowerCase(),
    ) ?? null
  return {
    created,
    db: {
      song: {
        findFirst: vi.fn(findSong),
        create: vi.fn(async ({data}: any) => {
          const row = {
            id: `new${++n}`,
            title: data.title,
            chartVersions: data.chartVersions
              ? [{source: data.chartVersions.create.source}]
              : [],
          }
          songs.push(row)
          created.songs.push(data)
          return row
        }),
      },
      cue: {
        findFirst: vi.fn(
          async ({where}: any) =>
            created.cues.find(
              (c: any) => c.songId === where.songId && c.text === where.text,
            ) ?? null,
        ),
        create: vi.fn(async ({data}: any) => created.cues.push(data)),
      },
      setlist: {
        findFirst: vi.fn(async ({where}: any) =>
          where.name === 'Old gig' ? {id: 'x'} : null,
        ),
        create: vi.fn(async ({data}: any) => {
          created.setlists.push(data)
          return {id: 'sl1'}
        }),
      },
      rehearsal: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({data}: any) => {
          created.rehearsals.push(data)
          return {id: 'r1'}
        }),
      },
      activity: {
        create: vi.fn(async ({data}: any) => created.activity.push(data)),
      },
    } as any,
  }
}

const who = {bandId: 'b1', userId: 'u1'}

describe('importBand', () => {
  let f: ReturnType<typeof fakeDb>
  beforeEach(() => {
    f = fakeDb([{id: 'here', title: 'Sway', source: '{title: Sway}\n[C]la la'}])
  })

  it('adds new songs, leaves one that’s there alone, and only once per title', async () => {
    const sum = await importBand(
      {
        songs: [
          {title: 'sway', chart: {chordpro: '[G]changed'}},
          {
            title: 'Proud Mary',
            writer: 'CCR',
            chart: {chordpro: '{title: Proud Mary}\n[D]Left'},
          },
          {title: 'proud mary', chart: {chordpro: 'twin'}},
          {title: 'On the list', chart: null},
        ],
      },
      who,
      f.db,
    )
    expect(sum).toMatchObject({songsAdded: 2, songsThere: 1})
    expect(
      f.created.songs.map((s: any) => [
        s.title,
        s.status,
        Boolean(s.chartVersions),
      ]),
    ).toEqual([
      ['Proud Mary', 'READY', true],
      ['On the list', 'LEARNING', false],
    ])
    expect(f.created.songs[0]).toMatchObject({
      bandId: 'b1',
      writer: 'CCR',
      updatedById: 'u1',
    })
  })

  it('turns OnSong player notes into the importer’s cue, once', async () => {
    const song = {
      title: 'Exactly Like You',
      chart: {
        onsong: {
          title: 'Exactly Like You',
          content: 'Exactly Like You\nPiano - Light and airy\n\nC\nwords',
        },
      },
    }
    const one = await importBand({songs: [song]}, who, f.db)
    const two = await importBand({songs: [song]}, who, f.db)
    expect(one.cues).toBe(1)
    expect(two.cues).toBe(0)
    expect(f.created.cues[0]).toMatchObject({
      userId: 'u1',
      kind: 'TEXT',
      text: 'Piano - Light and airy',
    })
  })

  it('builds setlists from this batch and songs already here; a missing one is reported', async () => {
    const sum = await importBand(
      {
        songs: [
          {
            title: 'Proud Mary',
            chart: {chordpro: '{title: Proud Mary}\n[D]first line here'},
          },
        ],
        setlists: [
          {
            name: 'Farmers market',
            gigDate: '2026-05-16',
            items: [
              {set: 'Set 1'},
              {song: 'proud mary', key: 'E'},
              {song: 'SWAY', key: 'C'},
              {song: 'Free Bird'},
              {break: 15},
            ],
          },
          {name: 'Old gig', items: []},
        ],
      },
      who,
      f.db,
    )
    expect(sum).toMatchObject({
      setlistsAdded: 1,
      setlistsThere: 1,
      missing: ['Free Bird'],
    })
    const sl = f.created.setlists[0]
    expect(sl.gigDate.toISOString()).toBe('2026-05-16T00:00:00.000Z')
    expect(sl.items.create).toEqual([
      {kind: 'SET', label: 'Set 1', minutes: null, position: 0},
      // Moved to E: kept. Sway is in C already: no set key
      {
        kind: 'SONG',
        song: {connect: {id: 'new1'}},
        key: 'E',
        note: null,
        position: 1,
      },
      {
        kind: 'SONG',
        song: {connect: {id: 'here'}},
        key: null,
        note: null,
        position: 2,
      },
      {kind: 'BREAK', minutes: 15, position: 3},
    ])
  })

  it('adds rehearsals', async () => {
    const sum = await importBand(
      {songs: [], rehearsals: [{date: '2026-10-12', time: '7pm'}]},
      who,
      f.db,
    )
    expect(sum.rehearsalsAdded).toBe(1)
    expect(f.created.rehearsals[0]).toMatchObject({
      bandId: 'b1',
      time: '7pm',
      createdById: 'u1',
    })
  })
})

describe('chartSource', () => {
  it('chords above the words become ChordPro', () => {
    const r = chartSource(
      {text: '[Verse 1]\nG        C\nla la la la'},
      'Daydream',
    )
    expect(r.source).toContain('{title: Daydream}')
    expect(r.source).toMatch(/\[G\]la.*\[C\]la/)
  })
})
