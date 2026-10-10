import {z} from 'zod'

/**
 * What an import carries: songs with their charts, setlists, rehearsals.
 * The browser builds it from whatever was dropped in (an OnSong backup,
 * Word files from Google Drive, ChordPro, a spreadsheet, a pasted setlist)
 * and sends it in batches to /api/import; scripts/import-band.ts reads the
 * same thing from a file. An export (/api/export) is this format too.
 */

const text = (max: number) => z.string().max(max)
const opt = (max: number) => text(max).nullish()

export const ChartIn = z.union([
  z.object({
    onsong: z.object({
      title: text(300),
      aliases: z.array(text(300)).max(10).optional(),
      byline: opt(300),
      key: opt(20),
      content: text(200_000),
    }),
  }),
  z.object({chordpro: text(200_000)}),
  // Chords above the words, as in a Word or Google Doc
  z.object({text: text(200_000)}),
])

export const CueIn = z.object({
  kind: z.enum(['TEXT', 'ABC']),
  text: text(20_000),
  anchor: text(200).optional(),
})

export const SongIn = z.object({
  title: z.string().trim().min(1).max(200),
  writer: opt(200),
  leadSinger: opt(200),
  seconds: z
    .number()
    .int()
    .min(0)
    .max(24 * 3600)
    .nullish(),
  youtubeUrl: opt(500),
  notes: opt(20_000),
  status: z.enum(['READY', 'LEARNING']).optional(),
  // None: a song on the list with no chart yet (a spreadsheet's rows)
  chart: ChartIn.nullish(),
  cues: z.array(CueIn).max(50).optional(),
})

export const ItemIn = z.union([
  z.object({song: text(200), key: opt(20), note: opt(500)}),
  z.object({
    set: text(100),
    minutes: z.number().int().min(0).max(600).nullish(),
  }),
  z.object({break: z.number().int().min(0).max(600).nullable()}),
])

export const SetlistIn = z.object({
  name: z.string().trim().min(1).max(200),
  gigDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  startTime: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/)
    .nullish(),
  venue: opt(200),
  notes: opt(5000),
  items: z.array(ItemIn).max(300),
})

export const RehearsalIn = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: opt(20),
  place: opt(200),
  note: opt(2000),
})

export const BandImport = z.object({
  songs: z.array(SongIn).max(2000).default([]),
  setlists: z.array(SetlistIn).max(500).optional(),
  rehearsals: z.array(RehearsalIn).max(500).optional(),
})

export type BandImport = z.infer<typeof BandImport>
export type SongIn = z.infer<typeof SongIn>
export type SetlistIn = z.infer<typeof SetlistIn>
export type ItemIn = z.infer<typeof ItemIn>
export type ChartIn = z.infer<typeof ChartIn>
export type CueIn = z.infer<typeof CueIn>
