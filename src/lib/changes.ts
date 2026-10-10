import {prisma} from './db'

/**
 * Where the band is up to: the newest thing anyone changed that its pages
 * show. Every change is recorded as Activity (logActivity), so the newest
 * row says it; a member's own changes that every band sees (their days
 * away, their name) count too. Pages already open compare it with the one
 * they were drawn with, and fetch again when it differs (KeepFresh).
 */
export async function bandStamp(bandId: string) {
  const last = await prisma.activity.findFirst({
    where: {
      OR: [{bandId}, {bandId: null, user: {memberships: {some: {bandId}}}}],
    },
    orderBy: {createdAt: 'desc'},
    select: {id: true},
  })
  return last?.id ?? ''
}
