export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireAdmin} from '@/lib/guard'
import {sniffImage} from '@/lib/avatars'
import {logActivity} from '@/lib/songs'
import {route} from '@/lib/route'

// A 512px PNG is ~50-300 KB; this refuses anything that skipped resizing
const MAX_BYTES = 800_000

/** The band's home-screen icon. Body: the image bytes (made in the browser). */
export const PUT = route(async (req: Request) => {
  const {user, band} = await requireAdmin()
  const data = Buffer.from(await req.arrayBuffer())
  if (!data.length || data.length > MAX_BYTES)
    return new Response('Payload Too Large', {status: 413})
  const mime = sniffImage(data)
  if (!mime) return new Response('Unsupported Media Type', {status: 415})
  const at = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.bandIcon.upsert({
      where: {bandId: band.id},
      create: {bandId: band.id, mime, data},
      update: {mime, data},
    })
    await tx.band.update({where: {id: band.id}, data: {iconAt: at}})
    await logActivity(tx, {
      bandId: band.id,
      userId: user.id,
      action: 'band.icon',
      targetType: 'band',
      targetId: band.id,
      summary: 'changed the home-screen icon',
    })
  })
  return Response.json({iconAt: at.toISOString()})
})

export const DELETE = route(async () => {
  const {band} = await requireAdmin()
  await prisma.$transaction([
    prisma.bandIcon.deleteMany({where: {bandId: band.id}}),
    prisma.band.update({where: {id: band.id}, data: {iconAt: null}}),
  ])
  return new Response(null, {status: 204})
})
