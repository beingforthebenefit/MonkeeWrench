export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireAdmin} from '@/lib/guard'
import {z} from 'zod'
import {isHttpUrl} from '@/lib/url'

const PatchBody = z.object({
  title: z.string().trim().min(1).optional(),
  artist: z.string().trim().min(1).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'ARCHIVED']).optional(),
  chartUrl: z
    .string()
    .trim()
    .refine(isHttpUrl, 'Must be http(s) URL')
    .nullable()
    .optional(),
  lyricsUrl: z
    .string()
    .trim()
    .refine(isHttpUrl, 'Must be http(s) URL')
    .nullable()
    .optional(),
  youtubeUrl: z
    .string()
    .trim()
    .refine(isHttpUrl, 'Must be http(s) URL')
    .nullable()
    .optional(),
})

export const GET = async (_req: Request, {params}: {params: {id: string}}) => {
  await requireAdmin()
  const p = await prisma.proposal.findUnique({
    where: {id: params.id},
    select: {
      id: true,
      title: true,
      artist: true,
      chartUrl: true,
      lyricsUrl: true,
      youtubeUrl: true,
      status: true,
    },
  })
  if (!p) return new Response('Not Found', {status: 404})
  return Response.json(p)
}

export const PATCH = async (req: Request, {params}: {params: {id: string}}) => {
  const admin = await requireAdmin()
  const json = await req.json()
  const parsed = PatchBody.safeParse(json)
  if (!parsed.success) return new Response('Bad Request', {status: 400})
  await prisma.$transaction(async (tx) => {
    await tx.proposal.update({where: {id: params.id}, data: parsed.data})
    await tx.auditLog.create({
      data: {userId: admin.id, action: 'ADMIN_EDIT', targetId: params.id},
    })
  })
  return new Response(null, {status: 204})
}

export const DELETE = async (
  _req: Request,
  {params}: {params: {id: string}},
) => {
  const admin = await requireAdmin()

  await prisma.$transaction(async (tx) => {
    // record audit
    await tx.auditLog.create({
      data: {userId: admin.id, action: 'ADMIN_DELETE', targetId: params.id},
    })
    // Cascade deletes votes via schema
    await tx.proposal.delete({where: {id: params.id}})
  })

  return new Response(null, {status: 204})
}
