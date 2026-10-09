import {getServerSession} from 'next-auth'
import {headers} from 'next/headers'
import {redirect} from 'next/navigation'
import {authOptions} from './auth'
import {prisma} from './db'
import {currentBand} from './band'
import {HOSTED, READ_ONLY_MESSAGE, standing} from './hosted'

/**
 * Guards for API routes and pages. API routes let the thrown Response
 * through (see route()); pages use the page* versions, which redirect.
 *
 * - requireUser: signed in (account pages: password, photo, settings)
 * - requireSession: signed in AND in a current band; everything band-owned
 *   must be looked up with `band.id`, or another band's data would show
 * - requireAdmin: an admin of the current band
 *
 * On the hosted service, a band whose subscription has lapsed is read-only:
 * requireSession refuses any API request that would change something (402),
 * unless the route says it must work anyway (renewing: `allowLapsed`).
 */

type Options = {allowLapsed?: boolean}

function isChange() {
  try {
    const m = headers().get('x-request-method')
    return Boolean(m) && m !== 'GET' && m !== 'HEAD'
  } catch {
    // Outside a request (scripts, tests): nothing to refuse
    return false
  }
}

export async function requireUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) throw new Response('Unauthorized', {status: 401})
  const user = await prisma.user.findUnique({
    where: {email: session.user.email},
  })
  if (!user) throw new Response('Unauthorized', {status: 401})
  return {session, user}
}

export async function requireSession(opts: Options = {}) {
  const {session, user} = await requireUser()
  const {band, bands} = await currentBand(user.id)
  // 409: signed in, but in several bands and none picked on this device
  if (!band)
    throw new Response(bands.length ? 'Choose a band' : 'Not in a band', {
      status: 409,
    })
  if (HOSTED && !opts.allowLapsed && isChange()) {
    const billing = await prisma.band.findUnique({
      where: {id: band.id},
      select: {paidUntil: true, polarSubscriptionId: true},
    })
    if (billing && standing(billing).kind === 'lapsed')
      throw Response.json({error: READ_ONLY_MESSAGE}, {status: 402})
  }
  // The install owner can manage any band they are in
  const isAdmin = band.isAdmin || user.isOwner
  return {session, user, band, bands, isAdmin}
}

export async function requireAdmin(opts: Options = {}) {
  const ctx = await requireSession(opts)
  if (!ctx.isAdmin) throw new Response('Forbidden', {status: 403})
  return ctx
}

/** A band with scheduling off has no availability tool (or its API). */
export function requireScheduling(band: {scheduling: boolean}) {
  if (!band.scheduling) throw new Response('Not Found', {status: 404})
}

export async function requireOwner() {
  const ctx = await requireUser()
  if (!ctx.user.isOwner) throw new Response('Forbidden', {status: 403})
  return ctx
}

function toRedirect(e: unknown): never {
  if (e instanceof Response) {
    if (e.status === 401) redirect('/login')
    if (e.status === 409) redirect('/bands')
    if (e.status === 403) redirect('/songs')
  }
  throw e
}

export const pageSession = () => requireSession().catch(toRedirect)
export const pageAdmin = () => requireAdmin().catch(toRedirect)
export const pageUser = () => requireUser().catch(toRedirect)
export const pageOwner = () => requireOwner().catch(toRedirect)
