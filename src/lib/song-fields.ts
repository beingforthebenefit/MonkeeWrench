import {z} from 'zod'
import {isHttpUrl} from './url'

const optText = z
  .string()
  .trim()
  .max(200)
  .transform((v) => v || null)
  .nullable()
  .optional()

const optUrl = z
  .string()
  .trim()
  .transform((v) => v || null)
  .refine((v) => v === null || isHttpUrl(v), 'Must be an http(s) URL')
  .nullable()
  .optional()

/** Editable song details (everything except the chart itself). */
export const SongFields = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  writer: optText,
  leadSinger: optText,
  guitars: z.number().int().min(0).max(9).nullable().optional(),
  keys: optText,
  percussion: optText,
  youtubeUrl: optUrl,
  lyricsUrl: optUrl,
  status: z.enum(['READY', 'LEARNING']).optional(),
  notes: z.string().max(5000).nullable().optional(),
})

export type SongFieldValues = z.infer<typeof SongFields>

const LABELS: Record<keyof SongFieldValues, string> = {
  title: 'title',
  writer: 'writer',
  leadSinger: 'lead singer',
  guitars: 'guitars',
  keys: 'keys',
  percussion: 'percussion',
  youtubeUrl: 'YouTube link',
  lyricsUrl: 'lyrics link',
  status: 'status',
  notes: 'notes',
}

/** Human-readable list of the fields that actually change. */
export function describeChanges(
  before: Record<string, unknown>,
  after: SongFieldValues,
): string[] {
  const out: string[] = []
  for (const k of Object.keys(after) as (keyof SongFieldValues)[]) {
    const next = after[k]
    if (next === undefined) continue
    if ((before[k] ?? null) === (next ?? null)) continue
    if (k === 'status')
      out.push(next === 'READY' ? 'status to gig-ready' : 'status to learning')
    else out.push(LABELS[k])
  }
  return out
}
