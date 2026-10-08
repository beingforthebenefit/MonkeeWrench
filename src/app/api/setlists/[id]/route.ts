export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireAdmin, requireSession} from '@/lib/guard'
import {SetlistBody, getSetlist, saveSetlist} from '@/lib/setlists'
import {logActivity} from '@/lib/songs'
import {route} from '@/lib/route'

type Ctx = {params: {id: string}}

export const GET = route(async (_req: Request, {params}: Ctx) => {
  const {band} = await requireSession()
  const set = await getSetlist(params.id, band.id)
  if (!set) return new Response('Not Found', {status: 404})
  return Response.json(set)
})

export const PUT = route(async (req: Request, {params}: Ctx) => {
  const {user, band} = await requireSession()
  const parsed = SetlistBody.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad Request', {status: 400})
  const ok = await saveSetlist(band.id, params.id, user.id, parsed.data)
  if (!ok) return new Response('Not Found', {status: 404})
  return new Response(null, {status: 204})
})

export const DELETE = route(async (_req: Request, {params}: Ctx) => {
  const {user, band} = await requireAdmin()
  const set = await prisma.setlist.findFirst({
    where: {id: params.id, bandId: band.id},
  })
  if (!set) return new Response('Not Found', {status: 404})
  await prisma.$transaction(async (tx) => {
    await tx.setlist.delete({where: {id: params.id}})
    await logActivity(tx, {
      bandId: band.id,
      userId: user.id,
      action: 'setlist.delete',
      targetType: 'setlist',
      targetId: params.id,
      summary: `deleted the setlist ${set.name}`,
    })
  })
  return new Response(null, {status: 204})
})
