export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireSession} from '@/lib/guard'
import {imageSize, sniffImage} from '@/lib/avatars'
import {myCues, toCue} from '@/lib/cues-server'
import {route} from '@/lib/route'

type Ctx = {params: {id: string}}

// A 1600px-wide screenshot of a few bars is ~100-400 KB
const MAX_IMAGE = 2_000_000
const MAX_TEXT = 5000
const ANCHOR = /^$|^[^#]{1,80}#\d{1,3}$/

async function songInBand(id: string, bandId: string) {
  return prisma.song.findFirst({where: {id, bandId}, select: {id: true}})
}

/** Your cues on this song (nobody else's: they're personal). */
export const GET = route(async (_req: Request, {params}: Ctx) => {
  const {user, band} = await requireSession()
  if (!(await songInBand(params.id, band.id)))
    return new Response('Not Found', {status: 404})
  return Response.json(
    (await myCues(user.id, [params.id])).get(params.id) ?? [],
  )
})

/**
 * Add a cue. Form fields: anchor, kind (TEXT | IMAGE | ABC), text, and for
 * an image the file (already resized in the browser).
 */
export const POST = route(async (req: Request, {params}: Ctx) => {
  const {user, band} = await requireSession()
  if (!(await songInBand(params.id, band.id)))
    return new Response('Not Found', {status: 404})
  const form = await req.formData()
  const anchor = String(form.get('anchor') ?? '')
  const kind = String(form.get('kind') ?? '')
  const text =
    String(form.get('text') ?? '')
      .trim()
      .slice(0, MAX_TEXT) || null
  if (!ANCHOR.test(anchor) || !['TEXT', 'IMAGE', 'ABC'].includes(kind))
    return new Response('Bad Request', {status: 400})

  let image: {
    mime: string
    width: number
    height: number
    data: Buffer
  } | null = null
  if (kind === 'IMAGE') {
    const file = form.get('file')
    if (!(file instanceof Blob))
      return new Response('Bad Request', {status: 400})
    const data = Buffer.from(await file.arrayBuffer())
    if (!data.length || data.length > MAX_IMAGE)
      return new Response('Payload Too Large', {status: 413})
    const mime = sniffImage(data)
    const size = imageSize(data)
    if (!mime || !size)
      return new Response('Unsupported Media Type', {status: 415})
    image = {mime, ...size, data}
  } else if (!text) return new Response('Bad Request', {status: 400})

  const last = await prisma.cue.findFirst({
    where: {userId: user.id, songId: params.id, anchor},
    orderBy: {position: 'desc'},
    select: {position: true},
  })
  const cue = await prisma.cue.create({
    data: {
      userId: user.id,
      songId: params.id,
      anchor,
      kind: kind as 'TEXT' | 'IMAGE' | 'ABC',
      text,
      position: (last?.position ?? -1) + 1,
      ...(image ? {image: {create: image}} : {}),
    },
    include: {image: {select: {width: true, height: true}}},
  })
  return Response.json(toCue(cue), {status: 201})
})
