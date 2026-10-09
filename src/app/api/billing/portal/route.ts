export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireAdmin} from '@/lib/guard'
import {requestOrigin} from '@/lib/band'
import {route} from '@/lib/route'
import {HOSTED} from '@/lib/hosted'
import {billingConfigured, portalUrl} from '@/lib/billing'

/** Polar's page for the band's subscription: card, receipts, cancelling. */
export const POST = route(async () => {
  if (!HOSTED || !billingConfigured())
    return new Response('Not Found', {status: 404})
  const {band} = await requireAdmin({allowLapsed: true})
  const row = await prisma.band.findUnique({
    where: {id: band.id},
    select: {polarCustomerId: true},
  })
  if (!row?.polarCustomerId)
    return Response.json({error: 'No subscription yet.'}, {status: 404})
  return Response.json({
    url: await portalUrl(row.polarCustomerId, `${requestOrigin()}/admin`),
  })
})
