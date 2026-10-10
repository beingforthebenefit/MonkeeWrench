import type {Prisma, PrismaClient} from '@prisma/client'
import {prisma as defaultDb} from './db'
import {convertOnSong} from './onsong'
import {
  detectKey,
  importChordsOverWords,
  parseChordPro,
  semitonesBetween,
} from './chordpro'
import type {BandImport, ChartIn, CueIn, ItemIn} from './band-import-schema'

export type ImportSummary = {
  songsAdded: number
  songsThere: number
  cues: number
  setlistsAdded: number
  setlistsThere: number
  rehearsalsAdded: number
  /** Setlist songs that aren't in the band (left out of the setlist) */
  missing: string[]
}

/** A chart as ChordPro, plus a player's notes on top (OnSong) for a cue. */
export function chartSource(
  chart: ChartIn,
  title: string,
): {source: string; partNotes: string[]; note: string} {
  if ('onsong' in chart) {
    // Its OnSong title ("Sway v2") is recognised in the header; the song
    // is called what this band calls it
    const r = convertOnSong({
      ...chart.onsong,
      title,
      aliases: [chart.onsong.title, ...(chart.onsong.aliases ?? [])],
    })
    return {...r, note: 'Imported from OnSong'}
  }
  if ('text' in chart)
    return {
      source: importChordsOverWords(chart.text, title).source,
      partNotes: [],
      note: 'Imported',
    }
  return {source: chart.chordpro, partNotes: [], note: 'Imported'}
}

/**
 * Add an import to a band, credited to one of its members. Never changes
 * what's there: a song is matched by title (an existing one is left alone),
 * a cue is added once, a setlist or rehearsal that exists (same name, same
 * date) is skipped. So running it twice, or in batches, adds nothing twice.
 */
export async function importBand(
  data: BandImport,
  {bandId, userId}: {bandId: string; userId: string},
  db: PrismaClient = defaultDb,
): Promise<ImportSummary> {
  const sum: ImportSummary = {
    songsAdded: 0,
    songsThere: 0,
    cues: 0,
    setlistsAdded: 0,
    setlistsThere: 0,
    rehearsalsAdded: 0,
    missing: [],
  }
  const log = (summary: string, targetType: string, targetId: string) =>
    db.activity.create({
      data: {
        bandId,
        userId,
        action: `${targetType}.import`,
        targetType,
        targetId,
        summary,
      },
    })

  const songs = new Map<string, {id: string; key: string | null}>()
  for (const s of data.songs) {
    const title = s.title.trim()
    if (songs.has(title.toLowerCase())) continue
    const existing = await db.song.findFirst({
      where: {bandId, title: {equals: title, mode: 'insensitive'}},
      include: {chartVersions: {orderBy: {number: 'desc'}, take: 1}},
    })
    const chart = s.chart ? chartSource(s.chart, title) : null
    let id = existing?.id
    if (!id) {
      const song = await db.song.create({
        data: {
          bandId,
          title,
          writer: s.writer || null,
          leadSinger: s.leadSinger || null,
          seconds: s.seconds ?? null,
          youtubeUrl: s.youtubeUrl || null,
          notes: s.notes || null,
          status: s.status ?? (chart ? 'READY' : 'LEARNING'),
          updatedById: userId,
          ...(chart && {
            chartVersions: {
              create: {
                number: 1,
                source: chart.source,
                authorId: userId,
                note: chart.note,
              },
            },
          }),
        },
      })
      id = song.id
      sum.songsAdded++
      await log(`imported ${title}`, 'song', id)
    } else sum.songsThere++
    const source = existing?.chartVersions[0]?.source ?? chart?.source
    songs.set(title.toLowerCase(), {
      id,
      key: source ? detectKey(parseChordPro(source)) : null,
    })

    // Personal cues: the chart's player notes, then any given
    const wanted: CueIn[] = [
      ...(chart?.partNotes.length
        ? [{kind: 'TEXT' as const, text: chart.partNotes.join('\n')}]
        : []),
      ...(s.cues ?? []),
    ]
    for (const [n, c] of wanted.entries()) {
      const dup = await db.cue.findFirst({
        where: {userId, songId: id, kind: c.kind, text: c.text},
      })
      if (dup) continue
      await db.cue.create({
        data: {
          userId,
          songId: id,
          anchor: c.anchor ?? '',
          kind: c.kind,
          text: c.text,
          position: n,
        },
      })
      sum.cues++
    }
  }

  // A setlist may name songs imported in an earlier batch, or already here
  async function findSong(title: string) {
    const k = title.trim().toLowerCase()
    if (songs.has(k)) return songs.get(k)!
    const row = await db.song.findFirst({
      where: {bandId, title: {equals: title.trim(), mode: 'insensitive'}},
      include: {chartVersions: {orderBy: {number: 'desc'}, take: 1}},
    })
    const hit = row
      ? {
          id: row.id,
          key: row.chartVersions[0]
            ? detectKey(parseChordPro(row.chartVersions[0].source))
            : null,
        }
      : null
    if (hit) songs.set(k, hit)
    return hit
  }

  for (const sl of data.setlists ?? []) {
    if (await db.setlist.findFirst({where: {bandId, name: sl.name}})) {
      sum.setlistsThere++
      continue
    }
    const items: Prisma.SetlistItemCreateWithoutSetlistInput[] = []
    for (const it of sl.items as ItemIn[]) {
      const position = items.length
      if ('song' in it) {
        const song = await findSong(it.song)
        if (!song) {
          if (!sum.missing.includes(it.song)) sum.missing.push(it.song)
          continue
        }
        // A set key only when it actually moves the song
        const key =
          it.key && song.key && semitonesBetween(song.key, it.key) !== 0
            ? it.key
            : null
        items.push({
          kind: 'SONG',
          song: {connect: {id: song.id}},
          key,
          note: it.note || null,
          position,
        })
      } else if ('set' in it)
        items.push({
          kind: 'SET',
          label: it.set,
          minutes: it.minutes ?? null,
          position,
        })
      else items.push({kind: 'BREAK', minutes: it.break, position})
    }
    const made = await db.setlist.create({
      data: {
        bandId,
        name: sl.name,
        gigDate: sl.gigDate ? new Date(sl.gigDate + 'T00:00:00Z') : null,
        startTime: sl.startTime ?? null,
        venue: sl.venue || null,
        notes: sl.notes || null,
        updatedById: userId,
        items: {create: items},
      },
    })
    sum.setlistsAdded++
    await log(`imported the setlist ${sl.name}`, 'setlist', made.id)
  }

  for (const r of data.rehearsals ?? []) {
    const date = new Date(r.date + 'T00:00:00Z')
    if (await db.rehearsal.findFirst({where: {bandId, date}})) continue
    const made = await db.rehearsal.create({
      data: {
        bandId,
        date,
        time: r.time || null,
        place: r.place || null,
        note: r.note || null,
        createdById: userId,
      },
    })
    sum.rehearsalsAdded++
    await log(`set a rehearsal for ${r.date}`, 'rehearsal', made.id)
  }
  return sum
}
