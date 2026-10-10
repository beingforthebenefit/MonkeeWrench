export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {
  applySubscription,
  readWebhook,
  type PolarSubscription,
} from '@/lib/billing'

/**
 * Polar reports subscription changes here (Settings → Webhooks in Polar,
 * subscription.* events). Signed with POLAR_WEBHOOK_SECRET; anything else
 * is refused. Answers 2xx once recorded, so Polar stops retrying.
 */
export async function POST(req: Request) {
  if (!process.env.POLAR_WEBHOOK_SECRET)
    return new Response('Not Found', {status: 404})
  const body = await req.text()
  let event: Awaited<ReturnType<typeof readWebhook>>
  try {
    event = await readWebhook(body, req.headers)
  } catch {
    return new Response('Invalid signature', {status: 403})
  }
  if (event.type.startsWith('subscription.')) {
    const sub = (event as {data: PolarSubscription}).data
    const bandId = await applySubscription(sub)
    // The owner's history: what happened, when
    await prisma.billingEvent.create({
      data: {
        bandId,
        type: event.type,
        status: sub.cancel_at_period_end ? 'canceling' : sub.status,
        subscriptionId: sub.id,
      },
    })
    // A subscription for no band here (another app on the same Polar
    // account, or a deleted band): nothing to do, and no point retrying
    if (!bandId)
      console.warn('[billing] subscription for an unknown band', event.type)
  }
  return new Response(null, {status: 202})
}
