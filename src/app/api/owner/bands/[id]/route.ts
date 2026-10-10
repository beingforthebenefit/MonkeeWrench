export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {requireOwner} from '@/lib/guard'
import {route} from '@/lib/route'

type Ctx = {params: {id: string}}

const Patch = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  // null: never billed (comped); a date (YYYY-MM-DD): editable until then
  paidUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
})

/** The owner renames a band, or changes how long it's paid for. */
export const PATCH = route(async (req: Request, {params}: Ctx) => {
  await requireOwner()
  const parsed = Patch.safeParse(await req.json().catch(() => null))
  if (!parsed.success)
    return Response.json({error: 'Check the name or date.'}, {status: 400})
  const {name, paidUntil} = parsed.data
  const band = await prisma.band.update({
    where: {id: params.id},
    data: {
      ...(name ? {name} : {}),
      ...(paidUntil !== undefined
        ? {
            paidUntil: paidUntil ? new Date(paidUntil + 'T23:59:59Z') : null,
          }
        : {}),
    },
    select: {id: true, name: true, paidUntil: true},
  })
  return Response.json(band)
})

const Del = z.object({confirm: z.string()})

/**
 * Delete a band and everything in it (songs, charts, setlists, rehearsals).
 * The request must carry the band's exact name. People stay: they may be
 * in other bands.
 */
export const DELETE = route(async (req: Request, {params}: Ctx) => {
  await requireOwner()
  const parsed = Del.safeParse(await req.json().catch(() => null))
  const band = await prisma.band.findUnique({where: {id: params.id}})
  if (!band) return new Response('Not Found', {status: 404})
  if (!parsed.success || parsed.data.confirm !== band.name)
    return Response.json(
      {error: 'Type the band’s name exactly to delete it.'},
      {status: 400},
    )
  await prisma.band.delete({where: {id: band.id}})
  return new Response(null, {status: 204})
})
