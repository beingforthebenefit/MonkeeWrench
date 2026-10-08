/**
 * Load a band's songs, charts, setlists and rehearsals from one JSON file
 * (for moving a band in from OnSong, a spreadsheet, another app...).
 *
 *   npx tsx scripts/import-band.ts band.json
 *
 * {
 *   "band": "band-slug",             // must exist (start it in the app)
 *   "as": "you@example.com",         // a member: the import is credited to them
 *   "songs": [{
 *     "title": "...", "writer"?, "leadSinger"?, "seconds"?, "youtubeUrl"?,
 *     "notes"?, "status"?: "READY" | "LEARNING",
 *     "chart": {"onsong": {"title", "byline"?, "key"?, "content"}}
 *            | {"chordpro": "..."},
 *     "cues"?: [{"kind": "TEXT" | "ABC", "text": "...", "anchor"?: ""}]
 *   }],
 *   "setlists"?: [{
 *     "name", "gigDate"?: "2026-10-17", "startTime"?: "13:30", "venue"?,
 *     "notes"?, "items": [{"song": "title", "key"?, "note"?}
 *                         | {"set": "Set 1", "minutes"?} | {"break": 15}]
 *   }],
 *   "rehearsals"?: [{"date": "2026-10-12", "time"?, "place"?, "note"?}]
 * }
 *
 * Safe to re-run: songs are matched by title within the band (an existing
 * one is left alone), cues are added once, setlists and rehearsals that
 * already exist (same name / same date) are skipped. An OnSong chart's
 * player notes on top ("Piano - Light and airy") become a personal cue for
 * "as" rather than part of everyone's chart.
 */
import fs from 'fs'
import {PrismaClient} from '@prisma/client'
import {convertOnSong, type OnSongIn} from '../src/lib/onsong'
import {detectKey, parseChordPro, semitonesBetween} from '../src/lib/chordpro'

type CueIn = {kind: 'TEXT' | 'ABC'; text: string; anchor?: string}
type SongIn = {
  title: string
  writer?: string | null
  leadSinger?: string | null
  seconds?: number | null
  youtubeUrl?: string | null
  notes?: string | null
  status?: 'READY' | 'LEARNING'
  chart: {onsong: OnSongIn} | {chordpro: string}
  cues?: CueIn[]
}
type ItemIn =
  | {song: string; key?: string | null; note?: string | null}
  | {set: string; minutes?: number | null}
  | {break: number | null}
type FileIn = {
  band: string
  as: string
  songs: SongIn[]
  setlists?: {
    name: string
    gigDate?: string | null
    startTime?: string | null
    venue?: string | null
    notes?: string | null
    items: ItemIn[]
  }[]
  rehearsals?: {
    date: string
    time?: string | null
    place?: string | null
    note?: string | null
  }[]
}

const prisma = new PrismaClient()

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: import-band <band.json>')
    process.exit(2)
  }
  const data: FileIn = JSON.parse(fs.readFileSync(file, 'utf8'))
  const band = await prisma.band.findUniqueOrThrow({where: {slug: data.band}})
  const me = await prisma.user.findFirstOrThrow({
    where: {
      email: {equals: data.as, mode: 'insensitive'},
      memberships: {some: {bandId: band.id}},
    },
  })
  const log = (
    bandId: string | null,
    summary: string,
    targetType: string,
    targetId: string,
  ) =>
    prisma.activity.create({
      data: {
        bandId,
        userId: me.id,
        action: `${targetType}.import`,
        targetType,
        targetId,
        summary,
      },
    })

  const songIds = new Map<string, {id: string; key: string | null}>()
  let created = 0
  let cues = 0
  for (const s of data.songs) {
    const existing = await prisma.song.findFirst({
      where: {bandId: band.id, title: {equals: s.title, mode: 'insensitive'}},
      include: {chartVersions: {orderBy: {number: 'desc'}, take: 1}},
    })
    let partNotes: string[] = []
    let source: string
    if ('onsong' in s.chart) {
      // Its OnSong title ("Sway v2") is recognised in the header; the
      // song is called what this band calls it
      const r = convertOnSong({
        ...s.chart.onsong,
        title: s.title,
        aliases: [s.chart.onsong.title, ...(s.chart.onsong.aliases ?? [])],
      })
      source = r.source
      partNotes = r.partNotes
    } else source = s.chart.chordpro
    let id = existing?.id
    if (!id) {
      const song = await prisma.song.create({
        data: {
          bandId: band.id,
          title: s.title,
          writer: s.writer ?? null,
          leadSinger: s.leadSinger ?? null,
          seconds: s.seconds ?? null,
          youtubeUrl: s.youtubeUrl ?? null,
          notes: s.notes ?? null,
          status: s.status ?? 'READY',
          updatedById: me.id,
          chartVersions: {
            create: {
              number: 1,
              source,
              authorId: me.id,
              note: 'onsong' in s.chart ? 'Imported from OnSong' : 'Imported',
            },
          },
        },
      })
      id = song.id
      created++
      await log(band.id, `imported ${s.title}`, 'song', id)
    }
    songIds.set(s.title.toLowerCase(), {
      id,
      key: detectKey(
        parseChordPro(existing?.chartVersions[0]?.source ?? source),
      ),
    })

    // Personal cues: the chart's player notes, then any given
    const wanted: CueIn[] = [
      ...(partNotes.length
        ? [{kind: 'TEXT' as const, text: partNotes.join('\n')}]
        : []),
      ...(s.cues ?? []),
    ]
    for (const [n, c] of wanted.entries()) {
      const anchor = c.anchor ?? ''
      const dup = await prisma.cue.findFirst({
        where: {userId: me.id, songId: id, kind: c.kind, text: c.text},
      })
      if (dup) continue
      await prisma.cue.create({
        data: {
          userId: me.id,
          songId: id,
          anchor,
          kind: c.kind,
          text: c.text,
          position: n,
        },
      })
      cues++
    }
  }

  let sets = 0
  for (const sl of data.setlists ?? []) {
    if (
      await prisma.setlist.findFirst({where: {bandId: band.id, name: sl.name}})
    )
      continue
    const items = sl.items.map((it, position) => {
      if ('song' in it) {
        const song = songIds.get(it.song.toLowerCase())
        if (!song) throw new Error(`Setlist ${sl.name}: no song "${it.song}"`)
        // A set key only when it actually moves the song
        const key =
          it.key && song.key && semitonesBetween(song.key, it.key) !== 0
            ? it.key
            : null
        return {
          kind: 'SONG' as const,
          songId: song.id,
          key,
          note: it.note ?? null,
          position,
        }
      }
      if ('set' in it)
        return {
          kind: 'SET' as const,
          label: it.set,
          minutes: it.minutes ?? null,
          position,
        }
      return {kind: 'BREAK' as const, minutes: it.break, position}
    })
    const created = await prisma.setlist.create({
      data: {
        bandId: band.id,
        name: sl.name,
        gigDate: sl.gigDate ? new Date(sl.gigDate + 'T00:00:00Z') : null,
        startTime: sl.startTime ?? null,
        venue: sl.venue ?? null,
        notes: sl.notes ?? null,
        updatedById: me.id,
        items: {create: items},
      },
    })
    sets++
    await log(band.id, `imported the setlist ${sl.name}`, 'setlist', created.id)
  }

  let rehearsals = 0
  for (const r of data.rehearsals ?? []) {
    const date = new Date(r.date + 'T00:00:00Z')
    if (await prisma.rehearsal.findFirst({where: {bandId: band.id, date}}))
      continue
    const made = await prisma.rehearsal.create({
      data: {
        bandId: band.id,
        date,
        time: r.time ?? null,
        place: r.place ?? null,
        note: r.note ?? null,
        createdById: me.id,
      },
    })
    rehearsals++
    await log(band.id, `set a rehearsal for ${r.date}`, 'rehearsal', made.id)
  }

  console.log(
    `${band.name}: ${created} songs added (${data.songs.length - created} already there), ${cues} cues, ${sets} setlists, ${rehearsals} rehearsals`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
