export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireSession} from '@/lib/guard'
import {SetlistBody, saveSetlist} from '@/lib/setlists'
import {logActivity} from '@/lib/songs'

export const GET = async () => {
  await requireSession()
  const sets = await prisma.setlist.findMany({
    orderBy: [{gigDate: {sort: 'asc', nulls: 'last'}}, {updatedAt: 'desc'}],
    include: {_count: {select: {items: true}}},
  })
  return Response.json(sets)
}

export const POST = async (req: Request) => {
  const {user} = await requireSession()
  const parsed = SetlistBody.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad Request', {status: 400})
  const set = await prisma.$transaction(async (tx) => {
    const s = await tx.setlist.create({
      data: {name: parsed.data.name, updatedById: user.id},
    })
    await logActivity(tx, {
      userId: user.id,
      action: 'setlist.create',
      targetType: 'setlist',
      targetId: s.id,
      summary: `created the setlist ${s.name}`,
    })
    return s
  })
  // Dates, venue and songs go through the same path as later edits
  const {name: _n, ...rest} = parsed.data
  if (Object.keys(rest).length)
    await saveSetlist(set.id, user.id, {...rest, name: set.name})
  return Response.json({id: set.id}, {status: 201})
}
