export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {requireUser} from '@/lib/guard'
import {route} from '@/lib/route'

const Del = z.object({confirm: z.string()})

/**
 * Delete your own account. Not while you're the last admin of a band that
 * has other people in it (make someone else admin, or delete the band,
 * first). Bands where you're the only one go with you. Chart versions you
 * wrote stay, unattributed; your proposals, votes, cues and photo go.
 */
export const DELETE = route(async (req: Request) => {
  const {user} = await requireUser()
  const parsed = Del.safeParse(await req.json().catch(() => null))
  if (
    !parsed.success ||
    parsed.data.confirm.trim().toLowerCase() !==
      (user.email ?? '').toLowerCase()
  )
    return Response.json(
      {error: 'Type your email address exactly to delete your account.'},
      {status: 400},
    )
  if (user.isOwner)
    return Response.json(
      {error: 'The install’s owner can’t delete their account here.'},
      {status: 400},
    )
  const mine = await prisma.membership.findMany({
    where: {userId: user.id},
    select: {
      isAdmin: true,
      band: {
        select: {
          id: true,
          name: true,
          memberships: {select: {userId: true, isAdmin: true}},
        },
      },
    },
  })
  const alone = mine.filter((m) => m.band.memberships.length === 1)
  const stranded = mine.filter(
    (m) =>
      m.isAdmin &&
      m.band.memberships.length > 1 &&
      !m.band.memberships.some((o) => o.userId !== user.id && o.isAdmin),
  )
  if (stranded.length)
    return Response.json(
      {
        error: `You’re the only admin of ${stranded.map((m) => m.band.name).join(', ')}. Make someone else an admin there first (Members), or delete the band.`,
      },
      {status: 409},
    )
  await prisma.$transaction([
    prisma.band.deleteMany({where: {id: {in: alone.map((m) => m.band.id)}}}),
    prisma.user.delete({where: {id: user.id}}),
  ])
  return new Response(null, {status: 204})
})
