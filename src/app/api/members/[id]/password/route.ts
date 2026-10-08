export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireAdmin} from '@/lib/guard'
import {canManageAccount} from '@/lib/band'
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
    const {user: admin, band} = await requireAdmin()
    const u = await prisma.user.findFirst({
      where: {id: params.id, memberships: {some: {bandId: band.id}}},
    })
    if (!u) return new Response('Not Found', {status: 404})
    if (!(await canManageAccount(admin, u.id)))
      return Response.json(
        {
          error:
            'They’re also in a band you don’t run, so ask its admin (or the person who runs this site) to reset it.',
        },
        {status: 403},
      )
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
        bandId: band.id,
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
