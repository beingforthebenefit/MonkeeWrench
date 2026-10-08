export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {requireAdmin} from '@/lib/guard'
import {canManageAccount} from '@/lib/band'
import {displayName, logActivity} from '@/lib/songs'
import {route} from '@/lib/route'

type Ctx = {params: {id: string}}

const Patch = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  displayName: z.string().trim().min(1).max(40).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  isAdmin: z.boolean().optional(),
})

export const PATCH = route(async (req: Request, {params}: Ctx) => {
  const {user: admin, band} = await requireAdmin()
  const parsed = Patch.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad Request', {status: 400})
  const {isAdmin, ...account} = parsed.data
  if (params.id === admin.id && isAdmin === false)
    return Response.json(
      {error: 'You can’t remove your own admin access.'},
      {status: 400},
    )
  const m = await prisma.membership.findUnique({
    where: {userId_bandId: {userId: params.id, bandId: band.id}},
    include: {user: true},
  })
  if (!m) return new Response('Not Found', {status: 404})
  if (Object.keys(account).length && !(await canManageAccount(admin, m.userId)))
    return Response.json(
      {
        error:
          'They’re also in a band you don’t run, so only they (or that band’s admins) can change their details.',
      },
      {status: 403},
    )
  await prisma.$transaction(async (tx) => {
    if (Object.keys(account).length)
      await tx.user.update({where: {id: m.userId}, data: account})
    if (isAdmin !== undefined)
      await tx.membership.update({
        where: {userId_bandId: {userId: m.userId, bandId: band.id}},
        data: {isAdmin},
      })
    await logActivity(tx, {
      bandId: band.id,
      userId: admin.id,
      action: 'member.update',
      targetType: 'user',
      targetId: m.userId,
      summary: `updated ${displayName(m.user)}’s details`,
    })
  })
  return new Response(null, {status: 204})
})

/**
 * Take someone out of this band. Their account goes too unless they are in
 * another band. Chart versions, setlists and activity keep their rows.
 */
export const DELETE = route(async (_req: Request, {params}: Ctx) => {
  const {user: admin, band} = await requireAdmin()
  if (params.id === admin.id)
    return Response.json({error: 'You can’t remove yourself.'}, {status: 400})
  const m = await prisma.membership.findUnique({
    where: {userId_bandId: {userId: params.id, bandId: band.id}},
    include: {user: true},
  })
  if (!m) return new Response('Not Found', {status: 404})
  await prisma.$transaction(async (tx) => {
    await tx.membership.delete({
      where: {userId_bandId: {userId: m.userId, bandId: band.id}},
    })
    // Their own per-band availability for this band goes with them
    await tx.unavailability.deleteMany({
      where: {userId: m.userId, scope: band.id},
    })
    const others = await tx.membership.count({where: {userId: m.userId}})
    if (!others && !m.user.isOwner)
      await tx.user.delete({where: {id: m.userId}})
    await logActivity(tx, {
      bandId: band.id,
      userId: admin.id,
      action: 'member.remove',
      targetType: 'user',
      targetId: m.userId,
      summary: `removed ${displayName(m.user)} from the band`,
    })
  })
  return new Response(null, {status: 204})
})
