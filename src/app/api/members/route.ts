export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {requireAdmin} from '@/lib/guard'
import {logActivity} from '@/lib/songs'
import {route} from '@/lib/route'

export const GET = route(async () => {
  await requireAdmin()
  const users = await prisma.user.findMany({
    orderBy: [{displayName: 'asc'}, {name: 'asc'}],
    select: {
      id: true,
      name: true,
      displayName: true,
      email: true,
      isAdmin: true,
      passwordSetAt: true,
      availabilityUpdatedAt: true,
    },
  })
  return Response.json(
    users.map(({passwordSetAt, ...u}) => ({
      ...u,
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

export const POST = route(async (req: Request) => {
  const admin = await requireAdmin()
  const parsed = Body.safeParse(await req.json())
  if (!parsed.success)
    return Response.json({error: 'Check the name and email.'}, {status: 400})
  const {name, email, isAdmin} = parsed.data
  const displayName = parsed.data.displayName || name.split(' ')[0]
  const exists = await prisma.user.findFirst({
    where: {email: {equals: email, mode: 'insensitive'}},
  })
  if (exists)
    return Response.json(
      {error: 'Someone with that email is already a member.'},
      {status: 409},
    )
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {name, displayName, email, isAdmin: Boolean(isAdmin)},
    })
    await logActivity(tx, {
      userId: admin.id,
      action: 'member.add',
      targetType: 'user',
      targetId: u.id,
      summary: `added ${displayName} to the band`,
    })
    return u
  })
  return Response.json({id: user.id}, {status: 201})
})
