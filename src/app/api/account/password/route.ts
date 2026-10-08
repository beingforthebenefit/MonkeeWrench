export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {requireUser} from '@/lib/guard'
import {MIN_PASSWORD_LENGTH, hashPassword, verifyPassword} from '@/lib/password'
import {logActivity} from '@/lib/songs'
import {route} from '@/lib/route'

const Body = z.object({
  // Not needed when setting a first password (Google sign-in members)
  current: z.string().optional(),
  next: z.string().min(MIN_PASSWORD_LENGTH).max(200),
})

// Change your own password. Signs out your other devices.
export const POST = route(async (req: Request) => {
  const {user} = await requireUser()
  const parsed = Body.safeParse(await req.json())
  if (!parsed.success)
    return Response.json(
      {
        error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      },
      {status: 400},
    )
  if (
    user.passwordHash &&
    !(await verifyPassword(parsed.data.current ?? '', user.passwordHash))
  )
    return Response.json({error: 'Current password is wrong.'}, {status: 403})
  const passwordHash = await hashPassword(parsed.data.next)
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: {id: user.id},
      data: {
        passwordHash,
        passwordSetAt: new Date(),
        sessionVersion: {increment: 1},
      },
    })
    await logActivity(tx, {
      bandId: null,
      userId: user.id,
      action: 'account.password',
      targetType: 'user',
      targetId: user.id,
      summary: 'changed their password',
    })
  })
  return new Response(null, {status: 204})
})
