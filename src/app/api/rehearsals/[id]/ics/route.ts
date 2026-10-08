export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireSession} from '@/lib/guard'
import {route} from '@/lib/route'
import {buildIcs} from '@/lib/ics'
import {rehearsalEvent} from '@/lib/rehearsal-events'
import {bandSite} from '@/lib/band'

// One rehearsal as an .ics file: Apple Calendar and Outlook open it to add.
export const GET = route(
  async (_req: Request, {params}: {params: {id: string}}) => {
    const {band} = await requireSession()
    const r = await prisma.rehearsal.findFirst({
      where: {id: params.id, bandId: band.id},
    })
    if (!r) return new Response('Not Found', {status: 404})
    const site = await bandSite(band.id)
    const ics = buildIcs([rehearsalEvent(r, band, site)])
    const slug = band.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    return new Response(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${slug}-rehearsal-${r.date.toISOString().slice(0, 10)}.ics"`,
        'Cache-Control': 'private, no-store',
      },
    })
  },
)
