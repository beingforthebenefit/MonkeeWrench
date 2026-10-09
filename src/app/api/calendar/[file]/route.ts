export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {buildIcs} from '@/lib/ics'
import {rehearsalEvent} from '@/lib/rehearsal-events'
import {gigEvent} from '@/lib/gig-events'
import {bandSite} from '@/lib/band'

/**
 * Subscribable feed of every rehearsal and gig (a setlist with a date) in
 * every band this person is in:
 * /api/calendar/<token>.ics. Calendar apps can't sign in, so the URL carries
 * a per-person secret instead; it can be reset from the Rehearsals page,
 * which kills the old link. Only dates, times, places and set times are in
 * it -- no charts.
 */
export const GET = async (
  _req: Request,
  {params}: {params: {file: string}},
) => {
  const token = params.file.replace(/\.ics$/, '')
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token))
    return new Response('Not Found', {status: 404})
  const user = await prisma.user.findUnique({
    where: {calendarToken: token},
    select: {
      id: true,
      memberships: {
        select: {band: {select: {id: true, name: true, timezone: true}}},
      },
    },
  })
  if (!user) return new Response('Not Found', {status: 404})
  const bands = new Map(user.memberships.map((m) => [m.band.id, m.band]))
  const sites = new Map(
    await Promise.all(
      [...bands.keys()].map(async (id) => [id, await bandSite(id)] as const),
    ),
  )
  const since = new Date(Date.now() - 90 * 86_400_000)
  const rehearsals = await prisma.rehearsal.findMany({
    where: {date: {gte: since}, bandId: {in: [...bands.keys()]}},
    orderBy: {date: 'asc'},
  })
  const gigs = await prisma.setlist.findMany({
    where: {gigDate: {gte: since}, bandId: {in: [...bands.keys()]}},
    orderBy: {gigDate: 'asc'},
    include: {
      items: {
        orderBy: {position: 'asc'},
        include: {song: {select: {seconds: true}}},
      },
    },
  })
  const name =
    bands.size === 1
      ? `${[...bands.values()][0].name} rehearsals and gigs`
      : 'Band rehearsals and gigs'
  return new Response(
    buildIcs(
      [
        ...rehearsals.map((r) =>
          rehearsalEvent(r, bands.get(r.bandId)!, sites.get(r.bandId)),
        ),
        ...gigs.flatMap(
          (g) => gigEvent(g, bands.get(g.bandId)!, sites.get(g.bandId)) ?? [],
        ),
      ],
      {name},
    ),
    {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'private, max-age=900',
      },
    },
  )
}
