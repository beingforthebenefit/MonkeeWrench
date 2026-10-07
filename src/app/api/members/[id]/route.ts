export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {requireAdmin} from '@/lib/guard'
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
  const admin = await requireAdmin()
  const parsed = Patch.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad Request', {status: 400})
  if (params.id === admin.id && parsed.data.isAdmin === false)
    return Response.json(
      {error: 'You can’t remove your own admin access.'},
      {status: 400},
    )
  const u = await prisma.user.findUnique({where: {id: params.id}})
  if (!u) return new Response('Not Found', {status: 404})
  await prisma.$transaction(async (tx) => {
    await tx.user.update({where: {id: params.id}, data: parsed.data})
    await logActivity(tx, {
      userId: admin.id,
      action: 'member.update',
      targetType: 'user',
      targetId: params.id,
      summary: `updated ${displayName(u)}’s details`,
    })
  })
  return new Response(null, {status: 204})
})

export const DELETE = route(async (_req: Request, {params}: Ctx) => {
  const admin = await requireAdmin()
  if (params.id === admin.id)
    return Response.json({error: 'You can’t remove yourself.'}, {status: 400})
  const u = await prisma.user.findUnique({where: {id: params.id}})
  if (!u) return new Response('Not Found', {status: 404})
  // Chart versions, setlists and activity keep their rows (author set null)
  await prisma.$transaction(async (tx) => {
    await tx.user.delete({where: {id: params.id}})
    await logActivity(tx, {
      userId: admin.id,
      action: 'member.remove',
      targetType: 'user',
      targetId: params.id,
      summary: `removed ${displayName(u)} from the band`,
    })
  })
  return new Response(null, {status: 204})
})
