export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {requireOwner} from '@/lib/guard'
import {route} from '@/lib/route'

type Ctx = {params: {id: string}}

const Patch = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  displayName: z.string().trim().max(40).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
})

/** The owner corrects someone's name or email. */
export const PATCH = route(async (req: Request, {params}: Ctx) => {
  await requireOwner()
  const parsed = Patch.safeParse(await req.json().catch(() => null))
  if (!parsed.success)
    return Response.json({error: 'Check the name and email.'}, {status: 400})
  const {email} = parsed.data
  if (email) {
    const taken = await prisma.user.findFirst({
      where: {
        email: {equals: email, mode: 'insensitive'},
        NOT: {id: params.id},
      },
    })
    if (taken)
      return Response.json(
        {error: 'Someone else already uses that email.'},
        {status: 409},
      )
  }
  const user = await prisma.user.update({
    where: {id: params.id},
    data: parsed.data,
    select: {id: true, name: true, displayName: true, email: true},
  })
  return Response.json(user)
})

/**
 * Delete someone everywhere. Their chart versions stay (unattributed);
 * their proposals, votes and personal cues go. Never the owner.
 */
export const DELETE = route(async (_req: Request, {params}: Ctx) => {
  const {user: me} = await requireOwner()
  const user = await prisma.user.findUnique({where: {id: params.id}})
  if (!user) return new Response('Not Found', {status: 404})
  if (user.id === me.id || user.isOwner)
    return Response.json(
      {error: 'The owner’s account can’t be deleted here.'},
      {status: 400},
    )
  await prisma.user.delete({where: {id: user.id}})
  return new Response(null, {status: 204})
})
