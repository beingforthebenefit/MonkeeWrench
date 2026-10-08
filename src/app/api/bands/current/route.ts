export const dynamic = 'force-dynamic'

import {cookies} from 'next/headers'
import {z} from 'zod'
import {requireUser} from '@/lib/guard'
import {BAND_COOKIE, myBands} from '@/lib/band'
import {route} from '@/lib/route'

const Body = z.object({bandId: z.string().min(1)})

/** Switch the band this device shows. Only to a band you're in. */
export const POST = route(async (req: Request) => {
  const {user} = await requireUser()
  const parsed = Body.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad Request', {status: 400})
  const bands = await myBands(user.id)
  if (!bands.some((b) => b.id === parsed.data.bandId))
    return new Response('Not Found', {status: 404})
  cookies().set(BAND_COOKIE, parsed.data.bandId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 400 * 24 * 60 * 60,
  })
  return new Response(null, {status: 204})
})
