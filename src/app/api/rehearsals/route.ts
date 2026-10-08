export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {requireSession} from '@/lib/guard'
import {logActivity} from '@/lib/songs'
import {formatDay} from '@/lib/availability'
import {route} from '@/lib/route'

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().trim().max(50).nullable().optional(),
  place: z.string().trim().max(200).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
})

export const POST = route(async (req: Request) => {
  const {user, band} = await requireSession()
  const parsed = Body.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad Request', {status: 400})
  const {date, time, place, note} = parsed.data
  const r = await prisma.$transaction(async (tx) => {
    const r = await tx.rehearsal.create({
      data: {
        bandId: band.id,
        date: new Date(date + 'T00:00:00Z'),
        time: time || null,
        place: place || null,
        note: note || null,
        createdById: user.id,
      },
    })
    await logActivity(tx, {
      bandId: band.id,
      userId: user.id,
      action: 'rehearsal.create',
      targetType: 'rehearsal',
      targetId: r.id,
      summary: `set a rehearsal for ${formatDay(date)}${time ? ` at ${time}` : ''}`,
    })
    return r
  })
  return Response.json({id: r.id}, {status: 201})
})
