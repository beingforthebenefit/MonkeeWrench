export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {route} from '@/lib/route'
import {findEmailToken} from '@/lib/email-tokens'
import {MIN_PASSWORD_LENGTH, hashPassword} from '@/lib/password'

const Body = z.object({
  token: z.string().min(1),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
})

/**
 * Set a password from an emailed link. The link works once; any other
 * session is signed out (as with every password change).
 */
export const POST = route(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success)
    return Response.json(
      {error: `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`},
      {status: 400},
    )
  const row = await findEmailToken(parsed.data.token)
  if (!row)
    return Response.json(
      {error: 'This link has expired or was already used. Ask for a new one.'},
      {status: 410},
    )
  const now = new Date()
  const passwordHash = await hashPassword(parsed.data.password)
  await prisma.$transaction([
    prisma.user.update({
      where: {id: row.userId},
      data: {
        passwordHash,
        passwordSetAt: now,
        emailVerified: now,
        sessionVersion: {increment: 1},
      },
    }),
    // This link and any other outstanding ones
    prisma.emailToken.updateMany({
      where: {userId: row.userId, usedAt: null},
      data: {usedAt: now},
    }),
  ])
  return Response.json({email: row.user.email})
})
