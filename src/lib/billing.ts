import {createPolar, webhooks} from '@polar-sh/sdk/2026-10'
import {prisma} from './db'
import {GRACE_DAYS, addDays, standing} from './hosted'

/**
 * Payments for the hosted service, through Polar (the merchant of record:
 * it takes the card, and handles sales tax and VAT). One product: a band,
 * $12 a year. Polar tells us what happened by webhook; the band's paidUntil
 * follows its subscription.
 *
 *   POLAR_ACCESS_TOKEN    an organization access token
 *   POLAR_PRODUCT_ID      the yearly product
 *   POLAR_WEBHOOK_SECRET  whsec_…, from the webhook endpoint
 *   POLAR_SERVER          "sandbox" while testing; production otherwise
 */

export function billingConfigured() {
  return Boolean(
    process.env.POLAR_ACCESS_TOKEN &&
      process.env.POLAR_PRODUCT_ID &&
      process.env.POLAR_WEBHOOK_SECRET,
  )
}

function polar() {
  return createPolar({
    accessToken: process.env.POLAR_ACCESS_TOKEN ?? '',
    environment:
      process.env.POLAR_SERVER === 'sandbox' ? 'sandbox' : 'production',
  })
}

/** Polar's checkout for this band; its address to send the admin to. */
export async function startCheckout(opts: {
  bandId: string
  email: string
  name: string | null
  origin: string
}) {
  const checkout = await polar().checkouts.create({
    products: [process.env.POLAR_PRODUCT_ID ?? ''],
    customer_email: opts.email,
    customer_name: opts.name ?? undefined,
    // Comes back on the subscription, to say which band it pays for
    metadata: {band_id: opts.bandId},
    // The trial is ours (30 days, no card): never Polar's on top of it,
    // even if the product in Polar has one set
    allow_trial: false,
    success_url: `${opts.origin}/admin?billing=thanks`,
  })
  await prisma.band.update({
    where: {id: opts.bandId},
    data: {polarCheckoutId: checkout.id},
  })
  return checkout.url
}

/** Polar's page for the band's subscription: card, receipts, cancelling. */
export async function portalUrl(customerId: string, returnUrl: string) {
  const session = await polar().customerSessions.create({
    customer_id: customerId,
    return_url: returnUrl,
  })
  return session.customer_portal_url
}

export type PolarSubscription = {
  id: string
  status: string
  current_period_end: string | null
  cancel_at_period_end: boolean
  ends_at: string | null
  ended_at: string | null
  customer_id: string
  checkout_id: string | null
  metadata: Record<string, string | number | boolean>
}

/**
 * How long a subscription keeps the band editable. Undefined: this event
 * says nothing about it (a checkout still being paid).
 */
export function paidUntilFor(
  sub: PolarSubscription,
  now = new Date(),
): Date | undefined {
  const end = sub.current_period_end ? new Date(sub.current_period_end) : null
  switch (sub.status) {
    case 'active':
    case 'trialing':
    case 'past_due':
      // Cancelled for the end of the period: until then, no grace after
      if (sub.cancel_at_period_end) return new Date(sub.ends_at ?? end ?? now)
      return end ? addDays(end, GRACE_DAYS) : undefined
    case 'incomplete':
      return undefined
    default:
      // canceled, unpaid, incomplete_expired, paused: over
      return new Date(sub.ended_at ?? sub.ends_at ?? now)
  }
}

/** Which band a subscription pays for. */
async function bandFor(sub: PolarSubscription) {
  const id = sub.metadata?.band_id
  if (typeof id === 'string') {
    const b = await prisma.band.findUnique({where: {id}, select: {id: true}})
    if (b) return b.id
  }
  const b = await prisma.band.findFirst({
    where: {
      OR: [
        {polarSubscriptionId: sub.id},
        ...(sub.checkout_id ? [{polarCheckoutId: sub.checkout_id}] : []),
      ],
    },
    select: {id: true},
  })
  return b?.id ?? null
}

/** Record what Polar says about a subscription. */
export async function applySubscription(
  sub: PolarSubscription,
  now = new Date(),
) {
  const bandId = await bandFor(sub)
  if (!bandId) return null
  const until = paidUntilFor(sub, now)
  await prisma.band.update({
    where: {id: bandId},
    data: {
      polarSubscriptionId: sub.id,
      polarCustomerId: sub.customer_id,
      // "canceling": cancelled for the end of the period, still paid until then
      ...(sub.status === 'incomplete'
        ? {}
        : {
            subscriptionStatus:
              sub.cancel_at_period_end && sub.status !== 'canceled'
                ? 'canceling'
                : sub.status,
          }),
      ...(until ? {paidUntil: until} : {}),
    },
  })
  return bandId
}

/** Check a webhook is from Polar, and read it. Throws if it isn't. */
export function readWebhook(body: string, headers: Headers) {
  return webhooks.validateEvent(
    body,
    {
      'webhook-id': headers.get('webhook-id') ?? '',
      'webhook-timestamp': headers.get('webhook-timestamp') ?? '',
      'webhook-signature': headers.get('webhook-signature') ?? '',
    },
    process.env.POLAR_WEBHOOK_SECRET ?? '',
  )
}

/** A band's standing on the hosted service, as the pages show it. */
export async function bandBilling(bandId: string) {
  const row = await prisma.band.findUnique({
    where: {id: bandId},
    select: {
      paidUntil: true,
      polarSubscriptionId: true,
      subscriptionStatus: true,
      polarCustomerId: true,
    },
  })
  const s = standing(row ?? {paidUntil: null})
  return {
    kind: s.kind,
    until:
      s.kind === 'lapsed'
        ? s.since.toISOString()
        : s.kind === 'free'
          ? null
          : s.until.toISOString(),
    daysLeft: s.kind === 'trial' ? s.daysLeft : null,
    status: row?.subscriptionStatus ?? null,
    hasCustomer: Boolean(row?.polarCustomerId),
    ready: billingConfigured(),
  }
}

export type BandBilling = Awaited<ReturnType<typeof bandBilling>>
