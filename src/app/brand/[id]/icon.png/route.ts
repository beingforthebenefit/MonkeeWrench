export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'

/**
 * A band's home-screen icon. Public: the phone fetches it before anyone
 * signs in (and it is a logo, not band business). Versioned by ?v=, so it
 * caches for good.
 */
export const GET = async (req: Request, {params}: {params: {id: string}}) => {
  const icon = await prisma.bandIcon.findUnique({where: {bandId: params.id}})
  if (!icon)
    return Response.redirect(new URL('/icons/default-512.png', req.url), 307)
  return new Response(new Uint8Array(icon.data), {
    headers: {
      'Content-Type': icon.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
