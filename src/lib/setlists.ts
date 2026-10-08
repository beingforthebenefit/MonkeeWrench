import {z} from 'zod'
import {prisma} from './db'
import {logActivity} from './songs'

const Clock = z
  .string()
  .trim()
  .regex(/^([01]?\d|2[0-3]):[0-5]\d$/)

const Minutes = z.number().int().min(1).max(600).nullable().optional()

/** One row of the running order: a song, a set header or a break. */
const Row = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('SONG'),
    songId: z.string().min(1),
    note: z.string().trim().max(300).nullable().optional(),
    key: z.string().trim().max(8).nullable().optional(),
  }),
  z.object({
    kind: z.literal('SET'),
    label: z.string().trim().min(1).max(40),
    minutes: Minutes,
    startTime: Clock.nullable().optional(),
  }),
  z.object({kind: z.literal('BREAK'), minutes: Minutes}),
])

// Rows sent before sets existed have no kind: they're songs
const Rows = z.preprocess(
  (v) =>
    Array.isArray(v)
      ? v.map((r) =>
          r && typeof r === 'object' && !('kind' in r)
            ? {...r, kind: 'SONG'}
            : r,
        )
      : v,
  z.array(Row).max(250),
)

export const SetlistBody = z.object({
  name: z.string().trim().min(1).max(200),
  gigDate: z
    .string()
    .trim()
    .transform((v) => v || null)
    .nullable()
    .optional()
    .refine((v) => v == null || !Number.isNaN(Date.parse(v)), 'Invalid date'),
  venue: z.string().trim().max(200).nullable().optional(),
  // When the first set starts: "20:00"
  startTime: Clock.nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  items: Rows.optional(),
})

export type SetlistInput = z.infer<typeof SetlistBody>

export async function getSetlist(id: string, bandId: string) {
  return prisma.setlist.findFirst({
    where: {id, bandId},
    include: {
      items: {
        orderBy: {position: 'asc'},
        include: {
          song: {
            include: {
              chartVersions: {
                orderBy: {number: 'desc'},
                take: 1,
                include: {
                  author: {
                    select: {name: true, displayName: true, email: true},
                  },
                },
              },
            },
          },
        },
      },
      updatedBy: {select: {name: true, displayName: true, email: true}},
    },
  })
}

/** "added X, removed Y, reordered" — for the activity log. */
export function describeSetChanges(
  before: {songId: string; title: string}[],
  after: {songId: string; title: string}[],
) {
  const b = new Set(before.map((x) => x.songId))
  const a = new Set(after.map((x) => x.songId))
  const added = after.filter((x) => !b.has(x.songId)).map((x) => x.title)
  const removed = before.filter((x) => !a.has(x.songId)).map((x) => x.title)
  const keptBefore = before.filter((x) => a.has(x.songId)).map((x) => x.songId)
  const keptAfter = after.filter((x) => b.has(x.songId)).map((x) => x.songId)
  const parts: string[] = []
  if (added.length)
    parts.push(
      added.length > 3
        ? `added ${added.length} songs`
        : `added ${added.join(', ')}`,
    )
  if (removed.length) parts.push(`removed ${removed.join(', ')}`)
  if (keptBefore.join() !== keptAfter.join()) parts.push('changed the order')
  return parts
}

export async function saveSetlist(
  bandId: string,
  id: string,
  userId: string,
  input: SetlistInput,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.setlist.findFirst({
      where: {id, bandId},
      include: {
        items: {
          orderBy: {position: 'asc'},
          include: {song: {select: {title: true}}},
        },
      },
    })
    if (!before) return null
    const {items, gigDate, ...fields} = input
    await tx.setlist.update({
      where: {id},
      data: {
        ...fields,
        ...(gigDate !== undefined
          ? {gigDate: gigDate ? new Date(gigDate) : null}
          : {}),
        updatedById: userId,
      },
    })
    let changes: string[] = []
    if (items) {
      const songIds = items.flatMap((i) =>
        i.kind === 'SONG' ? [i.songId] : [],
      )
      const songs = await tx.song.findMany({
        where: {bandId, id: {in: songIds}},
        select: {id: true, title: true},
      })
      const title = new Map(songs.map((s) => [s.id, s.title]))
      // Songs from another band (or deleted since) are dropped
      const valid = items.filter(
        (i) => i.kind !== 'SONG' || title.has(i.songId),
      )
      await tx.setlistItem.deleteMany({where: {setlistId: id}})
      await tx.setlistItem.createMany({
        data: valid.map((i, position) =>
          i.kind === 'SONG'
            ? {
                setlistId: id,
                kind: i.kind,
                songId: i.songId,
                position,
                note: i.note || null,
                key: i.key || null,
              }
            : {
                setlistId: id,
                kind: i.kind,
                position,
                label: i.kind === 'SET' ? i.label : null,
                minutes: i.minutes ?? null,
                startTime: i.kind === 'SET' ? i.startTime || null : null,
              },
        ),
      })
      const songRows = (rows: {songId: string | null}[]) =>
        rows.flatMap((r) => (r.songId ? [r.songId] : []))
      changes = describeSetChanges(
        before.items.flatMap((i) =>
          i.songId && i.song ? [{songId: i.songId, title: i.song.title}] : [],
        ),
        songRows(
          valid.map((i) => ({songId: i.kind === 'SONG' ? i.songId : null})),
        ).map((songId) => ({songId, title: title.get(songId)!})),
      )
      const shape = (
        rows: {
          kind: string
          label?: string | null
          minutes?: number | null
          startTime?: string | null
          songId?: string | null
          note?: string | null
          key?: string | null
        }[],
      ) =>
        rows
          .map((r) =>
            r.kind === 'SONG'
              ? `${r.songId}|${r.note || ''}|${r.key || ''}`
              : `${r.kind}|${r.label ?? ''}|${r.minutes ?? ''}|${r.startTime ?? ''}`,
          )
          .join()
      const setShape = (
        rows: {
          kind: string
          label?: string | null
          minutes?: number | null
          startTime?: string | null
        }[],
      ) =>
        rows
          .filter((r) => r.kind !== 'SONG')
          .map(
            (r) =>
              `${r.kind}|${r.label ?? ''}|${r.minutes ?? ''}|${r.startTime ?? ''}`,
          )
          .join()
      if (setShape(before.items) !== setShape(valid))
        changes.push('changed the sets and breaks')
      else if (!changes.length && shape(before.items) !== shape(valid))
        changes.push('changed song notes or keys')
    }
    if (fields.name && fields.name !== before.name)
      changes.unshift(`renamed it from ${before.name}`)
    if (
      changes.length ||
      gigDate !== undefined ||
      fields.venue !== undefined ||
      fields.startTime !== undefined
    )
      await logActivity(tx, {
        bandId,
        userId,
        action: 'setlist.update',
        targetType: 'setlist',
        targetId: id,
        summary: `updated the setlist ${fields.name ?? before.name}${changes.length ? `: ${changes.join('; ')}` : ''}`,
      })
    return true
  })
}
