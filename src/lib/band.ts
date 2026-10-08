import {cookies, headers} from 'next/headers'
import {redirect} from 'next/navigation'
import {prisma} from './db'

/**
 * Which band a request is about. One install serves several bands; people
 * only ever see the bands they belong to.
 *
 * - In one band: that band, always (nothing to choose).
 * - In several: the one they last picked on this device (a cookie), else
 *   nothing yet, and the app shows the band picker.
 *
 * A web address can belong to a band (BandDomain). That only decides the
 * branding before sign-in (name, icon, home-screen title) and which band the
 * picker puts first; it never grants access.
 */

export const BAND_COOKIE = 'ms_band'
export const PRODUCT = 'Bandstand'

export const bandSelect = {
  id: true,
  slug: true,
  name: true,
  appName: true,
  timezone: true,
  chatUrl: true,
  tributeTo: true,
  voteThreshold: true,
  scheduling: true,
  iconAt: true,
} as const

export type Band = {
  id: string
  slug: string
  name: string
  appName: string
  timezone: string
  chatUrl: string | null
  tributeTo: string | null
  voteThreshold: number
  scheduling: boolean
  iconAt: Date | null
}

/** The address the visitor typed, without the port (Traefik forwards it). */
export function requestHost(h: Headers = headers()) {
  const raw = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  return raw.split(',')[0].trim().split(':')[0].toLowerCase()
}

export async function bandForHost(host: string): Promise<Band | null> {
  if (!host) return null
  const d = await prisma.bandDomain.findUnique({
    where: {host},
    select: {band: {select: bandSelect}},
  })
  return d?.band ?? null
}

export type MyBand = Band & {isAdmin: boolean}

/** The bands someone belongs to, alphabetically. */
export async function myBands(userId: string): Promise<MyBand[]> {
  const rows = await prisma.membership.findMany({
    where: {userId},
    select: {isAdmin: true, band: {select: bandSelect}},
    orderBy: {band: {name: 'asc'}},
  })
  return rows.map((r) => ({...r.band, isAdmin: r.isAdmin}))
}

/** The current band among `bands`, or null when they must pick one. */
export function pickBand(bands: MyBand[], chosen: string | undefined) {
  if (bands.length === 1) return bands[0]
  return bands.find((b) => b.id === chosen) ?? null
}

export async function currentBand(userId: string) {
  const bands = await myBands(userId)
  const chosen = cookies().get(BAND_COOKIE)?.value
  return {bands, band: pickBand(bands, chosen)}
}

/** Name + icon for this address before anyone signs in. */
export async function brandForRequest() {
  const host = requestHost()
  const band = await bandForHost(host)
  return {
    band,
    appName: band?.appName ?? PRODUCT,
    iconUrl: iconUrl(band),
  }
}

export function iconUrl(band: {id: string; iconAt: Date | null} | null) {
  return band?.iconAt
    ? `/brand/${band.id}/icon.png?v=${band.iconAt.getTime()}`
    : '/icons/default-512.png'
}

/** Where a band's links point: its own address, else this install's. */
export async function bandSite(bandId: string) {
  const d = await prisma.bandDomain.findFirst({
    where: {bandId},
    orderBy: {host: 'asc'},
  })
  const fallback = (
    process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  ).replace(/\/$/, '')
  return d ? `https://${d.host}` : fallback
}

/** https://the-address-they-used, for links made on this request. */
export function requestOrigin(h: Headers = headers()) {
  const host = h.get('x-forwarded-host') ?? h.get('host')
  if (!host) return (process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '')
  const proto =
    h.get('x-forwarded-proto')?.split(',')[0].trim() ??
    (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host.split(',')[0].trim()}`
}

/** Do two people share a band? (Members only see people in their bands.) */
export async function shareABand(a: string, b: string) {
  if (a === b) return true
  const n = await prisma.membership.count({
    where: {userId: b, band: {memberships: {some: {userId: a}}}},
  })
  return n > 0
}

/** Is `adminId` an admin of some band that `userId` is in? */
export async function adminOver(adminId: string, userId: string) {
  const n = await prisma.membership.count({
    where: {
      userId,
      band: {memberships: {some: {userId: adminId, isAdmin: true}}},
    },
  })
  return n > 0
}

/**
 * May `actor` change this person's account (name, email, password)? Only if
 * they administer every band the person is in -- otherwise an admin of one
 * band could lock someone out of another. The install owner always may.
 */
export async function canManageAccount(
  actor: {id: string; isOwner: boolean},
  userId: string,
) {
  if (actor.isOwner || actor.id === userId) return true
  const theirs = await prisma.membership.findMany({
    where: {userId},
    select: {bandId: true},
  })
  if (!theirs.length) return false
  const mine = await prisma.membership.count({
    where: {
      userId: actor.id,
      isAdmin: true,
      bandId: {in: theirs.map((m) => m.bandId)},
    },
  })
  return mine === theirs.length
}

/**
 * A song or setlist that isn't in the current band but is in another band
 * this person is in (someone shared a link): switch to that band and show
 * it, rather than a "not found".
 */
export async function followToBand(
  kind: 'song' | 'setlist',
  id: string,
  userId: string,
  path: string,
) {
  const where = {id, band: {memberships: {some: {userId}}}}
  const row =
    kind === 'song'
      ? await prisma.song.findFirst({where, select: {bandId: true}})
      : await prisma.setlist.findFirst({where, select: {bandId: true}})
  if (row)
    redirect(`/bands/switch?to=${row.bandId}&next=${encodeURIComponent(path)}`)
}
