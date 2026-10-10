export const dynamic = 'force-dynamic'

import {z} from 'zod'
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
      scheduling: 'the scheduling tool',
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

const Del = z.object({confirm: z.string()})

/**
 * An admin deletes the band: every song, chart, setlist and rehearsal in
 * it. The request carries the band's exact name. A subscription still
 * running must be cancelled first, so nobody is charged for a band that's
 * gone. Its people keep their accounts (they may be in other bands).
 */
export const DELETE = route(async (req: Request) => {
  const {band} = await requireAdmin({allowLapsed: true})
  const parsed = Del.safeParse(await req.json().catch(() => null))
  if (!parsed.success || parsed.data.confirm.trim() !== band.name)
    return Response.json(
      {error: 'Type the band’s name exactly to delete it.'},
      {status: 400},
    )
  const billing = await prisma.band.findUnique({
    where: {id: band.id},
    select: {polarSubscriptionId: true, subscriptionStatus: true},
  })
  if (
    billing?.polarSubscriptionId &&
    ['active', 'trialing', 'past_due'].includes(
      billing.subscriptionStatus ?? '',
    )
  )
    return Response.json(
      {
        error:
          'Cancel the subscription first (Admin → Card, receipts and cancelling), so you aren’t charged again.',
      },
      {status: 409},
    )
  await prisma.band.delete({where: {id: band.id}})
  return new Response(null, {status: 204})
})
