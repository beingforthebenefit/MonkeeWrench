export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {requireSession} from '@/lib/guard'
import {formatDay} from '@/lib/availability'
import {scopeFor} from '@/lib/availability-server'
import {route} from '@/lib/route'

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(['OUT', 'PM_OUT', 'PREFER_NOT']).nullable(),
  // Admins can fill in for someone (e.g. copying from a text message)
  userId: z.string().optional(),
})

export const PUT = route(async (req: Request) => {
  const {user, band, isAdmin} = await requireSession()
  const parsed = Body.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad Request', {status: 400})
  const {date, kind} = parsed.data
  const userId = parsed.data.userId ?? user.id
  if (userId !== user.id && !isAdmin)
    return new Response('Forbidden', {status: 403})
  const target =
    userId === user.id
      ? user
      : await prisma.user.findFirst({
          where: {id: userId, memberships: {some: {bandId: band.id}}},
        })
  if (!target) return new Response('Not Found', {status: 404})
  const scope = scopeFor(target, band.id)
  const day = new Date(date + 'T00:00:00Z')

  await prisma.$transaction(async (tx) => {
    if (kind)
      await tx.unavailability.upsert({
        where: {userId_scope_date: {userId, scope, date: day}},
        create: {userId, scope, date: day, kind},
        update: {kind},
      })
    else await tx.unavailability.deleteMany({where: {userId, scope, date: day}})
    await tx.user.update({
      where: {id: userId},
      data: {availabilityUpdatedAt: new Date()},
    })

    // Shared days show in every band they're in; per-band days in this one
    const bandId = scope ? band.id : null
    // One "updated availability" line per person per hour, not one per tap
    const recent = await tx.activity.findFirst({
      where: {
        bandId,
        userId: user.id,
        action: 'availability.update',
        targetId: userId,
        createdAt: {gt: new Date(Date.now() - 3_600_000)},
      },
    })
    const who = userId === user.id ? 'their' : 'someone else’s'
    if (recent)
      await tx.activity.update({
        where: {id: recent.id},
        data: {createdAt: new Date()},
      })
    else
      await tx.activity.create({
        data: {
          bandId,
          userId: user.id,
          action: 'availability.update',
          targetType: 'availability',
          targetId: userId,
          summary: `updated ${who} availability (starting ${formatDay(date)})`,
        },
      })
  })
  return new Response(null, {status: 204})
})
