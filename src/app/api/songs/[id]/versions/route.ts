export const dynamic = 'force-dynamic'

import {requireSession} from '@/lib/guard'
import {listVersions} from '@/lib/songs'
import {route} from '@/lib/route'

export const GET = route(
  async (_req: Request, {params}: {params: {id: string}}) => {
    const {band} = await requireSession()
    return Response.json(await listVersions(params.id, band.id))
  },
)
