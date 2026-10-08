export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {requireSession} from '@/lib/guard'
import {route} from '@/lib/route'
import {dayRange, formatDay} from '@/lib/availability'
import {scopeFor} from '@/lib/availability-server'

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const Body = z.object({
  from: Day,
  to: Day,
  kind: z.enum(['OUT', 'PM_OUT', 'PREFER_NOT']).nullable(),
  // Only these weekdays (0 = Sunday); omitted = every day in the range
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).optional(),
})

const MAX_DAYS = 400

/** Mark a whole stretch at once: "away Dec 18 – Jan 4", "out every Tuesday". */
export const PUT = route(async (req: Request) => {
  const {user, band} = await requireSession()
  const scope = scopeFor(user, band.id)
  const parsed = Body.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad Request', {status: 400})
  const {from, to, kind, weekdays} = parsed.data
  if (to < from)
    return Response.json({error: 'The end is before the start.'}, {status: 400})
  const count = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1
  if (count > MAX_DAYS)
    return Response.json({error: 'That’s more than a year.'}, {status: 400})
  const days = dayRange(from, count).filter(
    (d) =>
      !weekdays || weekdays.includes(new Date(d + 'T00:00:00Z').getUTCDay()),
  )
  const dates = days.map((d) => new Date(d + 'T00:00:00Z'))
  await prisma.$transaction(async (tx) => {
    await tx.unavailability.deleteMany({
      where: {userId: user.id, scope, date: {in: dates}},
    })
    if (kind)
      await tx.unavailability.createMany({
        data: dates.map((date) => ({userId: user.id, scope, date, kind})),
      })
    await tx.user.update({
      where: {id: user.id},
      data: {availabilityUpdatedAt: new Date()},
    })
    const what =
      kind === 'OUT'
        ? 'out'
        : kind === 'PM_OUT'
          ? 'out in the afternoons'
          : kind === 'PREFER_NOT'
            ? '“prefer not”'
            : 'free'
    await tx.activity.create({
      data: {
        bandId: scope ? band.id : null,
        userId: user.id,
        action: 'availability.range',
        targetType: 'availability',
        targetId: user.id,
        summary: `marked themselves ${what} ${formatDay(from)} – ${formatDay(to)}${weekdays ? ' (some weekdays)' : ''}`,
      },
    })
  })
  return Response.json({days})
})
