export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireOwner} from '@/lib/guard'
import {requestOrigin} from '@/lib/band'
import {route} from '@/lib/route'
import {mailConfigured} from '@/lib/mail'
import {sendPasswordLink} from '@/lib/email-tokens'

/** Email someone a link to choose a new password (their old one still works until then). */
export const POST = route(
  async (_req: Request, {params}: {params: {id: string}}) => {
    await requireOwner()
    if (!mailConfigured())
      return Response.json(
        {error: 'Email isn’t set up on this install.'},
        {status: 503},
      )
    const user = await prisma.user.findUnique({where: {id: params.id}})
    if (!user?.email) return new Response('Not Found', {status: 404})
    await sendPasswordLink({
      userId: user.id,
      email: user.email,
      kind: user.passwordHash ? 'RESET' : 'INVITE',
      origin: requestOrigin(),
    })
    return Response.json({sent: user.email})
  },
)
