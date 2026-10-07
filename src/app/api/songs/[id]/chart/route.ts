export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {requireSession} from '@/lib/guard'
import {ConflictError, saveChart} from '@/lib/songs'

const Body = z.object({
  source: z.string().min(1).max(100_000),
  note: z.string().trim().max(500).nullable().optional(),
  baseNumber: z.number().int().min(0),
})

export const POST = async (req: Request, {params}: {params: {id: string}}) => {
  const {user} = await requireSession()
  const parsed = Body.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad Request', {status: 400})
  try {
    const v = await saveChart({
      songId: params.id,
      userId: user.id,
      ...parsed.data,
    })
    return Response.json({number: v.number}, {status: 201})
  } catch (e) {
    if (e instanceof ConflictError)
      return Response.json({error: e.message, latest: e.latest}, {status: 409})
    throw e
  }
}
