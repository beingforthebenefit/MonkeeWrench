import type {Prisma, PrismaClient} from '@prisma/client'
import {prisma} from './db'
import {keyOf, type Block, type Entry} from './availability'
import {parseTimes} from './ics'

/**
 * Where someone's days off are stored and read. By default one set covers
 * all their bands (scope ""); with User.shareAvailability off, each band has
 * its own (scope = band id).
 */
export const scopeFor = (u: {shareAvailability: boolean}, bandId: string) =>
  u.shareAvailability ? '' : bandId

type Person = {id: string; shareAvailability: boolean; blockOtherBands: boolean}

/** Everyone's marks as this band sees them. */
export async function bandEntries(
  bandId: string,
  people: Person[],
  from: Date,
  to: Date,
): Promise<Entry[]> {
  const scope = new Map(people.map((p) => [p.id, scopeFor(p, bandId)]))
  const rows = await prisma.unavailability.findMany({
    where: {
      userId: {in: people.map((p) => p.id)},
      scope: {in: ['', bandId]},
      date: {gte: from, lte: to},
    },
  })
  return rows
    .filter((r) => scope.get(r.userId) === r.scope)
    .map((r) => ({userId: r.userId, date: keyOf(r.date), kind: r.kind}))
}

/**
 * A rehearsal ending by 5 PM only takes the afternoon (still free for an
 * evening rehearsal); anything later, or with no time given, takes the day.
 */
export function rehearsalKind(time: string | null): 'OUT' | 'PM_OUT' {
  const t = parseTimes(time)
  return t && t.end <= '17:00' ? 'PM_OUT' : 'OUT'
}

/**
 * Days this band's members are busy with their OTHER bands: rehearsals and
 * gigs there. People can turn this off (User.blockOtherBands). The viewer
 * only learns the other band's name if they are in it too.
 */
export async function otherBandBlocks(
  bandId: string,
  people: Person[],
  viewerId: string,
  from: Date,
  to: Date,
): Promise<Block[]> {
  const ids = people.filter((p) => p.blockOtherBands).map((p) => p.id)
  if (!ids.length) return []
  const elsewhere = await prisma.membership.findMany({
    where: {userId: {in: ids}, bandId: {not: bandId}},
    select: {userId: true, band: {select: {id: true, name: true}}},
  })
  if (!elsewhere.length) return []
  const bandIds = [...new Set(elsewhere.map((m) => m.band.id))]
  const [rehearsals, gigs, viewerBands] = await Promise.all([
    prisma.rehearsal.findMany({
      where: {bandId: {in: bandIds}, date: {gte: from, lte: to}},
      select: {bandId: true, date: true, time: true},
    }),
    prisma.setlist.findMany({
      where: {bandId: {in: bandIds}, gigDate: {gte: from, lte: to}},
      select: {bandId: true, gigDate: true},
    }),
    prisma.membership.findMany({
      where: {userId: viewerId},
      select: {bandId: true},
    }),
  ])
  const visible = new Set(viewerBands.map((m) => m.bandId))
  const out: Block[] = []
  for (const m of elsewhere) {
    const name = visible.has(m.band.id) ? m.band.name : null
    for (const r of rehearsals)
      if (r.bandId === m.band.id)
        out.push({
          userId: m.userId,
          date: keyOf(r.date),
          kind: rehearsalKind(r.time),
          label: name
            ? `Rehearsal with ${name}${r.time ? ` (${r.time})` : ''}`
            : 'Busy with another band',
        })
    for (const g of gigs)
      if (g.bandId === m.band.id && g.gigDate)
        out.push({
          userId: m.userId,
          date: keyOf(g.gigDate),
          kind: 'OUT',
          label: name ? `Gig with ${name}` : 'Busy with another band',
        })
  }
  return out
}

type Tx = Prisma.TransactionClient | PrismaClient

/**
 * Switch someone between one shared set of days and one per band, without
 * losing anything: going per-band copies the shared days into each band;
 * going shared merges every band's days, keeping the strongest mark.
 */
export async function setSharing(tx: Tx, userId: string, share: boolean) {
  const bands = await tx.membership.findMany({
    where: {userId},
    select: {bandId: true},
  })
  if (share) {
    const rows = await tx.unavailability.findMany({
      where: {userId, scope: {not: ''}},
    })
    const shared = await tx.unavailability.findMany({
      where: {userId, scope: ''},
    })
    const RANK = {PREFER_NOT: 1, PM_OUT: 2, OUT: 3} as const
    const best = new Map(shared.map((r) => [keyOf(r.date), r.kind]))
    for (const r of rows) {
      const k = keyOf(r.date)
      const cur = best.get(k)
      if (!cur || RANK[r.kind] > RANK[cur]) best.set(k, r.kind)
    }
    await tx.unavailability.deleteMany({where: {userId}})
    await tx.unavailability.createMany({
      data: [...best].map(([date, kind]) => ({
        userId,
        scope: '',
        date: new Date(date + 'T00:00:00Z'),
        kind,
      })),
    })
  } else {
    const shared = await tx.unavailability.findMany({
      where: {userId, scope: ''},
    })
    await tx.unavailability.deleteMany({where: {userId}})
    await tx.unavailability.createMany({
      data: bands.flatMap((b) =>
        shared.map((r) => ({
          userId,
          scope: b.bandId,
          date: r.date,
          kind: r.kind,
        })),
      ),
    })
  }
  await tx.user.update({where: {id: userId}, data: {shareAvailability: share}})
}
