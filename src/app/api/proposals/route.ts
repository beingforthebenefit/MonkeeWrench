export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireSession} from '@/lib/guard'
import {z} from 'zod'
import {isHttpUrl} from '@/lib/url'
import {bus, EVENTS} from '@/lib/events'
import {route} from '@/lib/route'
import {logActivity} from '@/lib/songs'

// Helper: only allow http(s) URLs, and allow empty string -> undefined
const httpUrl = z.string().trim().refine(isHttpUrl, 'Must be http(s) URL')

const Url = z
  .union([httpUrl, z.literal('').transform(() => undefined)])
  .optional()

const Body = z.object({
  title: z.string().trim().min(1),
  artist: z.string().trim().min(1),
  chartUrl: Url,
  lyricsUrl: Url,
  youtubeUrl: Url,
})

export const POST = route(async (req: Request) => {
  const {user, band} = await requireSession()
  const json = await req.json().catch(() => null)
  const parsed = Body.safeParse(json)
  if (!parsed.success) return new Response('Bad Request', {status: 400})

  // Basic per-user rate limit: max 10 proposals/hour
  const since = new Date(Date.now() - 60 * 60 * 1000)
  const count = await prisma.auditLog.count({
    where: {userId: user.id, action: 'PROPOSE', createdAt: {gte: since}},
  })
  if (count >= 10) return new Response('Rate limit', {status: 429})

  const p = await prisma.proposal.create({
    data: {
      bandId: band.id,
      title: parsed.data.title,
      artist: parsed.data.artist,
      chartUrl: parsed.data.chartUrl ?? null,
      lyricsUrl: parsed.data.lyricsUrl ?? null,
      youtubeUrl: parsed.data.youtubeUrl ?? null,
      proposerId: user.id,
    },
  })

  await prisma.auditLog.create({
    data: {userId: user.id, action: 'PROPOSE', targetId: p.id},
  })
  await logActivity(prisma, {
    bandId: band.id,
    userId: user.id,
    action: 'proposal.create',
    targetType: 'proposal',
    targetId: p.id,
    summary: `proposed ${p.title}${p.artist ? ` (${p.artist})` : ''}`,
  })
  bus.emit(EVENTS.PROPOSAL_CREATED, {id: p.id, bandId: band.id})
  return Response.json({id: p.id})
})

export const GET = route(async () => {
  const {band} = await requireSession()
  const all = await prisma.proposal.findMany({
    where: {bandId: band.id},
    orderBy: {createdAt: 'desc'},
  })
  return Response.json(all)
})
