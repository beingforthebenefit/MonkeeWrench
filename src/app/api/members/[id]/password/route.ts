export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireAdmin} from '@/lib/guard'
import {generatePassword, hashPassword} from '@/lib/password'
import {displayName, logActivity} from '@/lib/songs'
import {route} from '@/lib/route'

/**
 * Generate a new random password for a member and return it ONCE, for the
 * admin to send them. Only the hash is stored. Any session they already had
 * ends (sessionVersion is bumped).
 */
export const POST = route(
  async (_req: Request, {params}: {params: {id: string}}) => {
    const admin = await requireAdmin()
    const u = await prisma.user.findUnique({where: {id: params.id}})
    if (!u) return new Response('Not Found', {status: 404})
    const password = generatePassword()
    const passwordHash = await hashPassword(password)
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {id: u.id},
        data: {
          passwordHash,
          passwordSetAt: new Date(),
          sessionVersion: {increment: 1},
        },
      })
      await logActivity(tx, {
        userId: admin.id,
        action: u.passwordHash
          ? 'member.password.reset'
          : 'member.password.set',
        targetType: 'user',
        targetId: u.id,
        summary: `${u.passwordHash ? 'reset' : 'set'} ${u.id === admin.id ? 'their own' : `${displayName(u)}’s`} password`,
      })
    })
    return Response.json(
      {password},
      {status: 201, headers: {'Cache-Control': 'no-store'}},
    )
  },
)
