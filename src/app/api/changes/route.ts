export const dynamic = 'force-dynamic'

import {requireSession} from '@/lib/guard'
import {bandStamp} from '@/lib/changes'
import {route} from '@/lib/route'

/** Where the band is up to (lib/changes): asked often, so tiny. */
export const GET = route(async () => {
  const {band} = await requireSession({allowLapsed: true})
  return Response.json(
    {stamp: await bandStamp(band.id)},
    {headers: {'Cache-Control': 'no-store'}},
  )
})
