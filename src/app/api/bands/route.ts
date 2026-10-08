export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {requireOwner} from '@/lib/guard'
import {slugify} from '@/lib/band-fields'
import {logActivity} from '@/lib/songs'
import {route} from '@/lib/route'

/** Every band on this install, for its owner. */
export const GET = route(async () => {
  await requireOwner()
  const bands = await prisma.band.findMany({
    orderBy: {name: 'asc'},
    select: {
      id: true,
      name: true,
      appName: true,
      domains: {select: {host: true}, orderBy: {host: 'asc'}},
      _count: {select: {memberships: true, songs: true}},
    },
  })
  return Response.json(bands)
})

const Body = z.object({name: z.string().trim().min(1).max(80)})

/** Start a new band. Whoever starts it is its first admin. */
export const POST = route(async (req: Request) => {
  const {user} = await requireOwner()
  const parsed = Body.safeParse(await req.json())
  if (!parsed.success)
    return Response.json({error: 'Give the band a name.'}, {status: 400})
  const base = slugify(parsed.data.name)
  let slug = base
  for (let n = 2; await prisma.band.findUnique({where: {slug}}); n++)
    slug = `${base}-${n}`
  const band = await prisma.$transaction(async (tx) => {
    const b = await tx.band.create({data: {name: parsed.data.name, slug}})
    await tx.membership.create({
      data: {userId: user.id, bandId: b.id, isAdmin: true},
    })
    await logActivity(tx, {
      bandId: b.id,
      userId: user.id,
      action: 'band.create',
      targetType: 'band',
      targetId: b.id,
      summary: `started ${b.name}`,
    })
    return b
  })
  return Response.json({id: band.id}, {status: 201})
})
