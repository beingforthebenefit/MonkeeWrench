export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {requireUser} from '@/lib/guard'
import {route} from '@/lib/route'

const Sub = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({p256dh: z.string().max(200), auth: z.string().max(100)}),
  device: z.string().max(60).nullable().optional(),
})

/** This device: turn notifications on (its push subscription). */
export const POST = route(async (req: Request) => {
  const {user} = await requireUser()
  const parsed = Sub.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad Request', {status: 400})
  const {endpoint, keys, device} = parsed.data
  // A shared device that someone else had on: it's this person's now
  await prisma.pushSubscription.upsert({
    where: {endpoint},
    create: {
      userId: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      device: device ?? null,
    },
    update: {
      userId: user.id,
      p256dh: keys.p256dh,
      auth: keys.auth,
      device: device ?? null,
    },
  })
  return new Response(null, {status: 204})
})

/** This device: turn notifications off. */
export const DELETE = route(async (req: Request) => {
  const {user} = await requireUser()
  const body = z.object({endpoint: z.string()}).safeParse(await req.json())
  if (!body.success) return new Response('Bad Request', {status: 400})
  await prisma.pushSubscription.deleteMany({
    where: {endpoint: body.data.endpoint, userId: user.id},
  })
  return new Response(null, {status: 204})
})
