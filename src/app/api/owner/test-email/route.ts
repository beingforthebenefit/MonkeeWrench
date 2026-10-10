export const dynamic = 'force-dynamic'

import {requireOwner} from '@/lib/guard'
import {requestOrigin} from '@/lib/band'
import {route} from '@/lib/route'
import {mailConfigured, sendMail} from '@/lib/mail'
import {emailFor} from '@/lib/email-tokens'

/**
 * The owner sees what the app's emails look like: one of each kind, to
 * their own address only, marked [Test]. The links are examples (they open
 * the "link has expired" page); nothing about any account changes.
 */
export const POST = route(async () => {
  const {user} = await requireOwner()
  if (!mailConfigured())
    return Response.json(
      {error: 'Email isn’t set up on this install (SMTP_HOST).'},
      {status: 503},
    )
  if (!user.email) return Response.json({error: 'No email.'}, {status: 400})
  const origin = requestOrigin()
  const url = `${origin}/set-password?token=example`
  const by = user.displayName ?? user.name ?? 'You'
  for (const kind of ['WELCOME', 'INVITE', 'RESET'] as const) {
    const mail = emailFor(kind, {url, origin, bandName: 'The Example Band', by})
    await sendMail({...mail, to: user.email, subject: `[Test] ${mail.subject}`})
  }
  return Response.json({sent: 3, to: user.email})
})
