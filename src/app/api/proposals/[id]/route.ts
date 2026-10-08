export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireAdmin} from '@/lib/guard'
import {z} from 'zod'
import {isHttpUrl} from '@/lib/url'
import {route} from '@/lib/route'
import {addSongFromProposal, logActivity} from '@/lib/songs'

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

export const GET = route(
  async (_req: Request, {params}: {params: {id: string}}) => {
    const {band} = await requireAdmin()
    const p = await prisma.proposal.findFirst({
      where: {id: params.id, bandId: band.id},
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
  },
)

export const PATCH = route(
  async (req: Request, {params}: {params: {id: string}}) => {
    const {user: admin, band} = await requireAdmin()
    const json = await req.json()
    const parsed = PatchBody.safeParse(json)
    if (!parsed.success) return new Response('Bad Request', {status: 400})
    const before = await prisma.proposal.findFirst({
      where: {id: params.id, bandId: band.id},
    })
    if (!before) return new Response('Not Found', {status: 404})
    await prisma.$transaction(async (tx) => {
      const p = await tx.proposal.update({
        where: {id: params.id},
        data: parsed.data,
      })
      await tx.auditLog.create({
        data: {userId: admin.id, action: 'ADMIN_EDIT', targetId: params.id},
      })
      // An admin approving directly does what reaching the vote threshold
      // does: the song joins the book to learn
      if (p.status === 'APPROVED' && before.status !== 'APPROVED')
        await addSongFromProposal(tx, p, admin.id, band)
      else if (p.status === 'ARCHIVED' && before.status !== 'ARCHIVED')
        await logActivity(tx, {
          bandId: band.id,
          userId: admin.id,
          action: 'proposal.archive',
          targetType: 'proposal',
          targetId: p.id,
          summary: `archived the proposal ${p.title}`,
        })
    })
    return new Response(null, {status: 204})
  },
)

export const DELETE = route(
  async (_req: Request, {params}: {params: {id: string}}) => {
    const {user: admin, band} = await requireAdmin()
    const p = await prisma.proposal.findFirst({
      where: {id: params.id, bandId: band.id},
      select: {id: true},
    })
    if (!p) return new Response('Not Found', {status: 404})

    await prisma.$transaction(async (tx) => {
      // record audit
      await tx.auditLog.create({
        data: {userId: admin.id, action: 'ADMIN_DELETE', targetId: params.id},
      })
      // Cascade deletes votes via schema
      await tx.proposal.delete({where: {id: params.id}})
    })

    return new Response(null, {status: 204})
  },
)
