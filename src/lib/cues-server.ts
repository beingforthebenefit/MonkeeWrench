import {prisma} from './db'
import type {Cue} from './cues'

/** This person's cues on these songs, by song id. */
export async function myCues(userId: string, songIds: string[]) {
  const rows = await prisma.cue.findMany({
    where: {userId, songId: {in: songIds}},
    include: {image: {select: {width: true, height: true}}},
    orderBy: [{position: 'asc'}, {createdAt: 'asc'}],
  })
  const out = new Map<string, Cue[]>()
  for (const r of rows)
    out.set(r.songId, [...(out.get(r.songId) ?? []), toCue(r)])
  return out
}

export function toCue(r: {
  id: string
  anchor: string
  position: number
  kind: Cue['kind']
  text: string | null
  updatedAt: Date
  image: {width: number; height: number} | null
}): Cue {
  return {
    id: r.id,
    anchor: r.anchor,
    position: r.position,
    kind: r.kind,
    text: r.text,
    image: r.image
      ? {
          // ?v= changes with every edit, so the image caches for good
          url: `/api/cues/${r.id}/image?v=${r.updatedAt.getTime()}`,
          width: r.image.width,
          height: r.image.height,
        }
      : null,
  }
}
