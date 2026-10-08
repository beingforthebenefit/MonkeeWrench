export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requestHost} from '@/lib/band'

/**
 * Browsers ask for /favicon.ico on their own. Answer with the icon of the
 * band this address belongs to (browsers take a PNG here), else the default.
 */
export const GET = async (req: Request) => {
  const domain = await prisma.bandDomain.findUnique({
    where: {host: requestHost(req.headers)},
    select: {band: {select: {icon: {select: {mime: true, data: true}}}}},
  })
  const icon = domain?.band.icon
  if (!icon)
    return Response.redirect(new URL('/icons/default-64.png', req.url), 307)
  return new Response(new Uint8Array(icon.data), {
    headers: {
      'Content-Type': icon.mime,
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
