export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {requireAdmin} from '@/lib/guard'
import {logActivity} from '@/lib/songs'
import {route} from '@/lib/route'

export const GET = route(async () => {
  const {band} = await requireAdmin()
  const rows = await prisma.membership.findMany({
    where: {bandId: band.id},
    select: {
      isAdmin: true,
      user: {
        select: {
          id: true,
          name: true,
          displayName: true,
          email: true,
          passwordSetAt: true,
          availabilityUpdatedAt: true,
        },
      },
    },
    orderBy: [{user: {displayName: 'asc'}}, {user: {name: 'asc'}}],
  })
  return Response.json(
    rows.map(({isAdmin, user: {passwordSetAt, ...u}}) => ({
      ...u,
      isAdmin,
      hasPassword: Boolean(passwordSetAt),
    })),
  )
})

const Body = z.object({
  name: z.string().trim().min(1).max(100),
  displayName: z.string().trim().max(40).optional(),
  email: z.string().trim().toLowerCase().email(),
  isAdmin: z.boolean().optional(),
})

/**
 * Add someone to this band. If they already have an account (they play in
 * another band here), they join with it: same sign-in, same photo.
 */
export const POST = route(async (req: Request) => {
  const {user: admin, band} = await requireAdmin()
  const parsed = Body.safeParse(await req.json())
  if (!parsed.success)
    return Response.json({error: 'Check the name and email.'}, {status: 400})
  const {name, email, isAdmin} = parsed.data
  const exists = await prisma.user.findFirst({
    where: {email: {equals: email, mode: 'insensitive'}},
    include: {memberships: {where: {bandId: band.id}}},
  })
  if (exists?.memberships.length)
    return Response.json(
      {error: 'Someone with that email is already in the band.'},
      {status: 409},
    )
  const result = await prisma.$transaction(async (tx) => {
    const u =
      exists ??
      (await tx.user.create({
        data: {
          name,
          displayName: parsed.data.displayName || name.split(' ')[0],
          email,
        },
      }))
    await tx.membership.create({
      data: {userId: u.id, bandId: band.id, isAdmin: Boolean(isAdmin)},
    })
    await logActivity(tx, {
      bandId: band.id,
      userId: admin.id,
      action: 'member.add',
      targetType: 'user',
      targetId: u.id,
      summary: `added ${u.displayName ?? name} to the band`,
    })
    return u
  })
  return Response.json(
    {id: result.id, existing: Boolean(exists)},
    {status: 201},
  )
})
