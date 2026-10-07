export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {buildIcs} from '@/lib/ics'
import {rehearsalEvent} from '@/lib/rehearsal-events'

/**
 * Subscribable feed of every rehearsal: /api/calendar/<token>.ics. Calendar
 * apps can't sign in, so the URL carries a per-person secret instead; it can
 * be reset from the Rehearsals page, which kills the old link. Only rehearsal
 * dates, times and places are in it -- no charts.
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
    select: {id: true},
  })
  if (!user) return new Response('Not Found', {status: 404})
  const since = new Date(Date.now() - 90 * 86_400_000)
  const rehearsals = await prisma.rehearsal.findMany({
    where: {date: {gte: since}},
    orderBy: {date: 'asc'},
  })
  return new Response(
    buildIcs(rehearsals.map(rehearsalEvent), {
      name: 'Monkee Business rehearsals',
    }),
    {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'private, max-age=900',
      },
    },
  )
}
