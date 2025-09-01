export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireSession} from '@/lib/guard'
import {z} from 'zod'
import {bus, EVENTS} from '@/lib/events'

// Helper: only allow http(s) URLs, and allow empty string -> undefined
const httpUrl = z
  .string()
  .trim()
  .url()
  .refine(
    (s) => s.startsWith('http://') || s.startsWith('https://'),
    'Must be http(s) URL',
  )

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

export const POST = async (req: Request) => {
  const {user} = await requireSession()
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
  bus.emit(EVENTS.PROPOSAL_CREATED, {id: p.id})
  return Response.json({id: p.id})
}

export const GET = async () => {
  const all = await prisma.proposal.findMany({orderBy: {createdAt: 'desc'}})
  return Response.json(all)
}
