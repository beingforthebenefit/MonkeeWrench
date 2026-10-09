export const dynamic = 'force-dynamic'

import {requireAdmin} from '@/lib/guard'
import {requestOrigin} from '@/lib/band'
import {route} from '@/lib/route'
import {HOSTED} from '@/lib/hosted'
import {billingConfigured, startCheckout} from '@/lib/billing'

/** Pay for the current band: where to send its admin (Polar's checkout). */
export const POST = route(async () => {
  if (!HOSTED || !billingConfigured())
    return new Response('Not Found', {status: 404})
  // Renewing has to work for a band that has lapsed
  const {user, band} = await requireAdmin({allowLapsed: true})
  const url = await startCheckout({
    bandId: band.id,
    email: user.email ?? '',
    name: user.name,
    origin: requestOrigin(),
  })
  return Response.json({url})
})
