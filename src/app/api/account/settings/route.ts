export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {requireUser} from '@/lib/guard'
import {setSharing} from '@/lib/availability-server'
import {route} from '@/lib/route'

const Body = z.object({
  shareAvailability: z.boolean().optional(),
  blockOtherBands: z.boolean().optional(),
})

/** Personal settings that span every band someone is in. */
export const PATCH = route(async (req: Request) => {
  const {user} = await requireUser()
  const parsed = Body.safeParse(await req.json())
  if (!parsed.success) return new Response('Bad Request', {status: 400})
  const {shareAvailability, blockOtherBands} = parsed.data
  await prisma.$transaction(async (tx) => {
    if (
      shareAvailability !== undefined &&
      shareAvailability !== user.shareAvailability
    )
      await setSharing(tx, user.id, shareAvailability)
    if (blockOtherBands !== undefined)
      await tx.user.update({where: {id: user.id}, data: {blockOtherBands}})
  })
  return new Response(null, {status: 204})
})
