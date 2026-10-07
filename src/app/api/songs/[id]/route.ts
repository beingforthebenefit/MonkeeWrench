export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireAdmin, requireSession} from '@/lib/guard'
import {getSong, logActivity} from '@/lib/songs'
import {SongFields, describeChanges} from '@/lib/song-fields'
import {route} from '@/lib/route'

type Ctx = {params: {id: string}}

export const GET = route(async (_req: Request, {params}: Ctx) => {
  await requireSession()
  const song = await getSong(params.id)
  if (!song) return new Response('Not Found', {status: 404})
  return Response.json(song)
})

export const PATCH = route(async (req: Request, {params}: Ctx) => {
  const {user} = await requireSession()
  const parsed = SongFields.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad Request', {status: 400})
  const before = await prisma.song.findUnique({where: {id: params.id}})
  if (!before) return new Response('Not Found', {status: 404})
  const changes = describeChanges(before, parsed.data)
  if (!changes.length) return new Response(null, {status: 204})
  await prisma.$transaction(async (tx) => {
    await tx.song.update({
      where: {id: params.id},
      data: {...parsed.data, updatedById: user.id},
    })
    await logActivity(tx, {
      userId: user.id,
      action: 'song.update',
      targetType: 'song',
      targetId: params.id,
      summary: `changed ${changes.join(', ')} on ${parsed.data.title ?? before.title}`,
    })
  })
  return new Response(null, {status: 204})
})

export const DELETE = route(async (_req: Request, {params}: Ctx) => {
  const admin = await requireAdmin()
  const song = await prisma.song.findUnique({where: {id: params.id}})
  if (!song) return new Response('Not Found', {status: 404})
  await prisma.$transaction(async (tx) => {
    await tx.song.delete({where: {id: params.id}})
    await logActivity(tx, {
      userId: admin.id,
      action: 'song.delete',
      targetType: 'song',
      targetId: params.id,
      summary: `deleted ${song.title}`,
    })
  })
  return new Response(null, {status: 204})
})
