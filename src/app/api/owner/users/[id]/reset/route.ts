export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {requireOwner} from '@/lib/guard'
import {requestOrigin} from '@/lib/band'
import {route} from '@/lib/route'
import {mailConfigured} from '@/lib/mail'
import {sendPasswordLink} from '@/lib/email-tokens'

const Body = z.object({kind: z.enum(['invite', 'reset']).default('reset')})

/**
 * Email one person a link to choose a password: the invite (naming their
 * band and the owner, as if just added) or a reset. Nobody else hears
 * anything; their current password works until they use the link.
 */
export const POST = route(
  async (req: Request, {params}: {params: {id: string}}) => {
    const {user: owner} = await requireOwner()
    if (!mailConfigured())
      return Response.json(
        {error: 'Email isn’t set up on this install.'},
        {status: 503},
      )
    const parsed = Body.safeParse(await req.json().catch(() => ({})))
    const kind = parsed.success ? parsed.data.kind : 'reset'
    const user = await prisma.user.findUnique({
      where: {id: params.id},
      include: {
        memberships: {
          select: {band: {select: {name: true}}},
          orderBy: {band: {name: 'asc'}},
          take: 1,
        },
      },
    })
    if (!user?.email) return new Response('Not Found', {status: 404})
    await sendPasswordLink({
      userId: user.id,
      email: user.email,
      kind: kind === 'invite' ? 'INVITE' : 'RESET',
      origin: requestOrigin(),
      bandName: user.memberships[0]?.band.name ?? null,
      by: owner.displayName ?? owner.name,
    })
    return Response.json({sent: user.email, kind})
  },
)
