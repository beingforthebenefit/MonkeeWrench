import {getServerSession} from 'next-auth'
import {redirect} from 'next/navigation'
import {authOptions} from './auth'
import {prisma} from './db'
import {currentBand} from './band'

/**
 * Guards for API routes and pages. API routes let the thrown Response
 * through (see route()); pages use the page* versions, which redirect.
 *
 * - requireUser: signed in (account pages: password, photo, settings)
 * - requireSession: signed in AND in a current band; everything band-owned
 *   must be looked up with `band.id`, or another band's data would show
 * - requireAdmin: an admin of the current band
 */

export async function requireUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) throw new Response('Unauthorized', {status: 401})
  const user = await prisma.user.findUnique({
    where: {email: session.user.email},
  })
  if (!user) throw new Response('Unauthorized', {status: 401})
  return {session, user}
}

export async function requireSession() {
  const {session, user} = await requireUser()
  const {band, bands} = await currentBand(user.id)
  // 409: signed in, but in several bands and none picked on this device
  if (!band)
    throw new Response(bands.length ? 'Choose a band' : 'Not in a band', {
      status: 409,
    })
  // The install owner can manage any band they are in
  const isAdmin = band.isAdmin || user.isOwner
  return {session, user, band, bands, isAdmin}
}

export async function requireAdmin() {
  const ctx = await requireSession()
  if (!ctx.isAdmin) throw new Response('Forbidden', {status: 403})
  return ctx
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
