export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireSession} from '@/lib/guard'
import {logActivity} from '@/lib/songs'
import {formatDay, keyOf} from '@/lib/availability'
import {route} from '@/lib/route'

export const DELETE = route(
  async (_req: Request, {params}: {params: {id: string}}) => {
    const {user} = await requireSession()
    const r = await prisma.rehearsal.findUnique({where: {id: params.id}})
    if (!r) return new Response('Not Found', {status: 404})
    if (r.createdById !== user.id && !user.isAdmin)
      return new Response('Forbidden', {status: 403})
    await prisma.$transaction(async (tx) => {
      await tx.rehearsal.delete({where: {id: r.id}})
      await logActivity(tx, {
        userId: user.id,
        action: 'rehearsal.delete',
        targetType: 'rehearsal',
        targetId: r.id,
        summary: `cancelled the rehearsal on ${formatDay(keyOf(r.date))}`,
      })
    })
    return new Response(null, {status: 204})
  },
)
