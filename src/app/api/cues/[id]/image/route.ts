export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireUser} from '@/lib/guard'
import {route} from '@/lib/route'

/** The picture on one of your cues. */
export const GET = route(
  async (_req: Request, {params}: {params: {id: string}}) => {
    const {user} = await requireUser()
    const img = await prisma.cueImage.findFirst({
      where: {cueId: params.id, cue: {userId: user.id}},
    })
    if (!img) return new Response('Not Found', {status: 404})
    return new Response(new Uint8Array(img.data), {
      headers: {
        'Content-Type': img.mime,
        'Cache-Control': 'private, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  },
)
