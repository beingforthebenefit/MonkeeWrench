export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireAdmin, requireSession} from '@/lib/guard'
import {BandFields} from '@/lib/band-fields'
import {logActivity} from '@/lib/songs'
import {route} from '@/lib/route'

/** The current band's settings. */
export const GET = route(async () => {
  const {band} = await requireSession()
  return Response.json(band)
})

export const PATCH = route(async (req: Request) => {
  const {user, band} = await requireAdmin()
  const parsed = BandFields.safeParse(await req.json())
  if (!parsed.success)
    return Response.json(
      {error: parsed.error.issues[0]?.message ?? 'Bad Request'},
      {status: 400},
    )
  const changed = Object.entries(parsed.data).filter(
    ([k, v]) => v !== undefined && band[k as keyof typeof band] !== v,
  )
  if (!changed.length) return new Response(null, {status: 204})
  await prisma.$transaction(async (tx) => {
    await tx.band.update({where: {id: band.id}, data: parsed.data})
    const LABELS: Record<string, string> = {
      name: 'the band name',
      appName: 'the app name',
      timezone: 'the time zone',
      chatUrl: 'the chat link',
      tributeTo: 'who the band covers',
      voteThreshold: 'the votes needed',
    }
    await logActivity(tx, {
      bandId: band.id,
      userId: user.id,
      action: 'band.update',
      targetType: 'band',
      targetId: band.id,
      summary: `changed ${changed.map(([k]) => LABELS[k]).join(', ')}`,
    })
  })
  return new Response(null, {status: 204})
})
