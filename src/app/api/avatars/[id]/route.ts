export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireUser} from '@/lib/guard'
import {adminOver, shareABand} from '@/lib/band'
import {logActivity} from '@/lib/songs'
import {route} from '@/lib/route'
import {AVATAR_MAX_BYTES, sniffImage} from '@/lib/avatars'

type Ctx = {params: {id: string}}

/** Only to people who share a band with them. */
export const GET = route(async (_req: Request, {params}: Ctx) => {
  const {user} = await requireUser()
  if (!(await shareABand(user.id, params.id)))
    return new Response('Not Found', {status: 404})
  const a = await prisma.avatar.findUnique({where: {userId: params.id}})
  if (!a) return new Response('Not Found', {status: 404})
  return new Response(new Uint8Array(a.data), {
    headers: {
      'Content-Type': a.mime,
      // The URL carries ?v=<upload time>, so a new photo gets a new URL
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})

/** Your own photo; a band's admins can set its members'. Body: the bytes. */
export const PUT = route(async (req: Request, {params}: Ctx) => {
  const {user} = await requireUser()
  if (params.id !== user.id && !(await adminOver(user.id, params.id)))
    return new Response('Forbidden', {status: 403})
  const data = Buffer.from(await req.arrayBuffer())
  if (!data.length || data.length > AVATAR_MAX_BYTES)
    return new Response('Payload Too Large', {status: 413})
  const mime = sniffImage(data)
  if (!mime) return new Response('Unsupported Media Type', {status: 415})
  const target = await prisma.user.findUnique({where: {id: params.id}})
  if (!target) return new Response('Not Found', {status: 404})
  const at = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.avatar.upsert({
      where: {userId: target.id},
      create: {userId: target.id, mime, data},
      update: {mime, data},
    })
    await tx.user.update({where: {id: target.id}, data: {avatarAt: at}})
    await logActivity(tx, {
      bandId: null,
      userId: user.id,
      action: 'user.avatar',
      targetType: 'user',
      targetId: target.id,
      summary:
        target.id === user.id
          ? 'updated their photo'
          : `updated the photo for ${target.displayName ?? target.name ?? 'a member'}`,
    })
  })
  return Response.json({avatarAt: at.toISOString()})
})

export const DELETE = route(async (_req: Request, {params}: Ctx) => {
  const {user} = await requireUser()
  if (params.id !== user.id && !(await adminOver(user.id, params.id)))
    return new Response('Forbidden', {status: 403})
  await prisma.$transaction(async (tx) => {
    const {count} = await tx.avatar.deleteMany({where: {userId: params.id}})
    if (!count) return
    await tx.user.update({where: {id: params.id}, data: {avatarAt: null}})
    await logActivity(tx, {
      bandId: null,
      userId: user.id,
      action: 'user.avatar',
      targetType: 'user',
      targetId: params.id,
      summary:
        params.id === user.id ? 'removed their photo' : 'removed a photo',
    })
  })
  return new Response(null, {status: 204})
})
