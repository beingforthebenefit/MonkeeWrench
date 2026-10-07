import {z} from 'zod'
import {prisma} from './db'
import {logActivity} from './songs'

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
  notes: z.string().max(5000).nullable().optional(),
  items: z
    .array(
      z.object({
        songId: z.string().min(1),
        note: z.string().trim().max(300).nullable().optional(),
        key: z.string().trim().max(8).nullable().optional(),
      }),
    )
    .max(200)
    .optional(),
})

export type SetlistInput = z.infer<typeof SetlistBody>

export async function getSetlist(id: string) {
  return prisma.setlist.findUnique({
    where: {id},
    include: {
      items: {
        orderBy: {position: 'asc'},
        include: {
          song: {
            include: {
              chartVersions: {
                orderBy: {number: 'desc'},
                take: 1,
                include: {author: {select: {name: true, email: true}}},
              },
            },
          },
        },
      },
      updatedBy: {select: {name: true, email: true}},
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
  if (added.length) parts.push(`added ${added.join(', ')}`)
  if (removed.length) parts.push(`removed ${removed.join(', ')}`)
  if (keptBefore.join() !== keptAfter.join()) parts.push('changed the order')
  return parts
}

export async function saveSetlist(
  id: string,
  userId: string,
  input: SetlistInput,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.setlist.findUnique({
      where: {id},
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
      const songs = await tx.song.findMany({
        where: {id: {in: items.map((i) => i.songId)}},
        select: {id: true, title: true},
      })
      const title = new Map(songs.map((s) => [s.id, s.title]))
      const valid = items.filter((i) => title.has(i.songId))
      await tx.setlistItem.deleteMany({where: {setlistId: id}})
      await tx.setlistItem.createMany({
        data: valid.map((i, position) => ({
          setlistId: id,
          songId: i.songId,
          position,
          note: i.note || null,
          key: i.key || null,
        })),
      })
      changes = describeSetChanges(
        before.items.map((i) => ({songId: i.songId, title: i.song.title})),
        valid.map((i) => ({songId: i.songId, title: title.get(i.songId)!})),
      )
      const beforeNotes = before.items
        .map((i) => `${i.songId}|${i.note ?? ''}|${i.key ?? ''}`)
        .join()
      const afterNotes = valid
        .map((i) => `${i.songId}|${i.note || ''}|${i.key || ''}`)
        .join()
      if (!changes.length && beforeNotes !== afterNotes)
        changes.push('changed song notes or keys')
    }
    if (fields.name && fields.name !== before.name)
      changes.unshift(`renamed it from ${before.name}`)
    if (changes.length || gigDate !== undefined || fields.venue !== undefined)
      await logActivity(tx, {
        userId,
        action: 'setlist.update',
        targetType: 'setlist',
        targetId: id,
        summary: `updated the setlist ${fields.name ?? before.name}${changes.length ? `: ${changes.join('; ')}` : ''}`,
      })
    return true
  })
}
