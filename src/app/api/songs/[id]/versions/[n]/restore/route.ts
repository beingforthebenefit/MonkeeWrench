export const dynamic = 'force-dynamic'

import {requireAdmin} from '@/lib/guard'
import {ConflictError, restoreVersion} from '@/lib/songs'

// Restoring writes a NEW version with the old content, so nothing is lost;
// it is still admin-only because it undoes someone else's work.
export const POST = async (
  _req: Request,
  {params}: {params: {id: string; n: string}},
) => {
  const admin = await requireAdmin()
  const number = Number(params.n)
  if (!Number.isInteger(number) || number < 1)
    return new Response('Bad Request', {status: 400})
  try {
    const v = await restoreVersion({
      songId: params.id,
      number,
      userId: admin.id,
    })
    if (!v) return new Response('Not Found', {status: 404})
    return Response.json({number: v.number}, {status: 201})
  } catch (e) {
    if (e instanceof ConflictError)
      return Response.json({error: e.message}, {status: 409})
    throw e
  }
}
