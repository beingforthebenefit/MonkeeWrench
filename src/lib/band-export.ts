import {prisma} from './db'
import type {BandImport, ItemIn} from './band-import-schema'

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

/**
 * Everything a band has, in the import format: its songs with their current
 * charts, setlists and rehearsals, plus the exporting person's own cues
 * (other people's are theirs). Import it into any Bandstand, hosted or your
 * own, and it comes back the same.
 */
export async function exportBand(bandId: string, userId: string) {
  const [songs, setlists, rehearsals] = await Promise.all([
    prisma.song.findMany({
      where: {bandId},
      orderBy: {title: 'asc'},
      include: {
        chartVersions: {orderBy: {number: 'desc'}, take: 1},
        cues: {
          where: {userId, kind: {in: ['TEXT', 'ABC']}},
          orderBy: [{anchor: 'asc'}, {position: 'asc'}],
        },
      },
    }),
    prisma.setlist.findMany({
      where: {bandId},
      orderBy: [{gigDate: 'asc'}, {name: 'asc'}],
      include: {
        items: {orderBy: {position: 'asc'}, include: {song: true}},
      },
    }),
    prisma.rehearsal.findMany({where: {bandId}, orderBy: {date: 'asc'}}),
  ])
  const data: BandImport = {
    songs: songs.map((s) => ({
      title: s.title,
      writer: s.writer,
      leadSinger: s.leadSinger,
      seconds: s.seconds,
      youtubeUrl: s.youtubeUrl,
      notes: s.notes,
      status: s.status,
      chart: s.chartVersions[0] ? {chordpro: s.chartVersions[0].source} : null,
      ...(s.cues.length && {
        cues: s.cues.map((c) => ({
          kind: c.kind as 'TEXT' | 'ABC',
          text: c.text ?? '',
          anchor: c.anchor,
        })),
      }),
    })),
    setlists: setlists.map((sl) => ({
      name: sl.name,
      gigDate: day(sl.gigDate),
      startTime: sl.startTime,
      venue: sl.venue,
      notes: sl.notes,
      items: sl.items.flatMap((it): ItemIn[] =>
        it.kind === 'SONG'
          ? it.song
            ? [{song: it.song.title, key: it.key, note: it.note}]
            : []
          : it.kind === 'SET'
            ? [{set: it.label ?? 'Set', minutes: it.minutes}]
            : [{break: it.minutes}],
      ),
    })),
    rehearsals: rehearsals.map((r) => ({
      date: day(r.date)!,
      time: r.time,
      place: r.place,
      note: r.note,
    })),
  }
  return data
}
