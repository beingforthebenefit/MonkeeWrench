export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {requireUser} from '@/lib/guard'
import {toCue} from '@/lib/cues-server'
import {route} from '@/lib/route'

type Ctx = {params: {id: string}}

const Patch = z.object({
  text: z.string().trim().max(5000).nullable().optional(),
  anchor: z
    .string()
    .regex(/^$|^[^#]{1,80}#\d{1,3}$/)
    .optional(),
  position: z.number().int().min(0).max(1000).optional(),
})

/** Only ever your own cues: anyone else's is "not found". */
async function mine(id: string, userId: string) {
  return prisma.cue.findFirst({
    where: {id, userId},
    select: {id: true, kind: true},
  })
}

export const PATCH = route(async (req: Request, {params}: Ctx) => {
  const {user} = await requireUser()
  const cue = await mine(params.id, user.id)
  if (!cue) return new Response('Not Found', {status: 404})
  const parsed = Patch.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad Request', {status: 400})
  const {text, ...rest} = parsed.data
  if (text !== undefined && !text && cue.kind !== 'IMAGE')
    return new Response('Bad Request', {status: 400})
  const updated = await prisma.cue.update({
    where: {id: cue.id},
    data: {...rest, ...(text !== undefined ? {text: text || null} : {})},
    include: {image: {select: {width: true, height: true}}},
  })
  return Response.json(toCue(updated))
})

export const DELETE = route(async (_req: Request, {params}: Ctx) => {
  const {user} = await requireUser()
  const {count} = await prisma.cue.deleteMany({
    where: {id: params.id, userId: user.id},
  })
  return new Response(null, {status: count ? 204 : 404})
})
