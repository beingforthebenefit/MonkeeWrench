export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {requireOwner} from '@/lib/guard'
import {requestOrigin} from '@/lib/band'
import {logActivity} from '@/lib/songs'
import {route} from '@/lib/route'
import {mailConfigured} from '@/lib/mail'
import {sendPasswordLink} from '@/lib/email-tokens'

const Body = z.object({
  bandId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  isAdmin: z.boolean().optional(),
})

/**
 * The owner adds someone to any band (an admin who's stuck, a band moving
 * in). Like Members: an existing account joins as it is; a new one is
 * emailed a link to choose a password.
 */
export const POST = route(async (req: Request) => {
  const {user: owner} = await requireOwner()
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success)
    return Response.json(
      {error: 'Pick a band, and give a name and email.'},
      {status: 400},
    )
  const {bandId, name, email, isAdmin} = parsed.data
  const band = await prisma.band.findUnique({where: {id: bandId}})
  if (!band) return new Response('Not Found', {status: 404})
  const exists = await prisma.user.findFirst({
    where: {email: {equals: email, mode: 'insensitive'}},
    include: {memberships: {where: {bandId}}},
  })
  if (exists?.memberships.length)
    return Response.json(
      {error: `They’re already in ${band.name}.`},
      {status: 409},
    )
  const user = await prisma.$transaction(async (tx) => {
    const u =
      exists ??
      (await tx.user.create({
        data: {name, displayName: name.split(' ')[0], email},
      }))
    await tx.membership.create({
      data: {userId: u.id, bandId, isAdmin: Boolean(isAdmin)},
    })
    await logActivity(tx, {
      bandId,
      userId: owner.id,
      action: 'member.add',
      targetType: 'user',
      targetId: u.id,
      summary: `added ${u.displayName ?? name} to the band`,
    })
    return u
  })
  let invited = false
  if (mailConfigured() && !user.passwordHash && user.email) {
    await sendPasswordLink({
      userId: user.id,
      email: user.email,
      kind: 'INVITE',
      origin: requestOrigin(),
      bandName: band.name,
      by: owner.displayName ?? owner.name,
    }).then(
      () => (invited = true),
      (e) => console.error('[owner] invite email failed', e),
    )
  }
  return Response.json(
    {id: user.id, existing: Boolean(exists), invited},
    {status: 201},
  )
})
