export const dynamic = 'force-dynamic'

import {requireSession} from '@/lib/guard'
import {listVersions} from '@/lib/songs'

export const GET = async (_req: Request, {params}: {params: {id: string}}) => {
  await requireSession()
  return Response.json(await listVersions(params.id))
}
