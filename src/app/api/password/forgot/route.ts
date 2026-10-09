export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {requestOrigin} from '@/lib/band'
import {route} from '@/lib/route'
import {mailConfigured} from '@/lib/mail'
import {sendPasswordLink} from '@/lib/email-tokens'
import {allow, clientIp} from '@/lib/rate-limit'

const Body = z.object({email: z.string().trim().toLowerCase().email()})
const HOUR = 60 * 60 * 1000

/**
 * Email a link to choose a new password. The answer never says whether the
 * address has an account.
 */
export const POST = route(async (req: Request) => {
  if (!mailConfigured()) return new Response('Not Found', {status: 404})
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success)
    return Response.json({error: 'Check the email address.'}, {status: 400})
  const {email} = parsed.data
  const ip = clientIp(req.headers)
  if (!allow(`forgot-ip:${ip}`, 10, HOUR) || !allow(`forgot:${email}`, 3, HOUR))
    return Response.json(
      {error: 'Too many tries. Wait an hour and try again.'},
      {status: 429},
    )
  const user = await prisma.user.findFirst({
    where: {email: {equals: email, mode: 'insensitive'}},
  })
  if (user?.email)
    await sendPasswordLink({
      userId: user.id,
      email: user.email,
      kind: 'RESET',
      origin: requestOrigin(),
    }).catch((e) => console.error('[forgot] email failed', e))
  return Response.json({ok: true})
})
