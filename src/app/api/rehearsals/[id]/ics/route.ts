export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireSession} from '@/lib/guard'
import {route} from '@/lib/route'
import {buildIcs} from '@/lib/ics'
import {rehearsalEvent} from '@/lib/rehearsal-events'

// One rehearsal as an .ics file: Apple Calendar and Outlook open it to add.
export const GET = route(
  async (_req: Request, {params}: {params: {id: string}}) => {
    await requireSession()
    const r = await prisma.rehearsal.findUnique({where: {id: params.id}})
    if (!r) return new Response('Not Found', {status: 404})
    return new Response(buildIcs([rehearsalEvent(r)]), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="monkee-business-rehearsal-${r.date.toISOString().slice(0, 10)}.ics"`,
        'Cache-Control': 'private, no-store',
      },
    })
  },
)
