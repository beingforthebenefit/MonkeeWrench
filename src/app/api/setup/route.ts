export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {prisma} from '@/lib/db'
import {route} from '@/lib/route'
import {startBand} from '@/lib/new-band'
import {MIN_PASSWORD_LENGTH, hashPassword} from '@/lib/password'

const Body = z.object({
  bandName: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
})

/**
 * A fresh install's first account: its owner, and the first admin of its
 * first band. Only while nobody has an account; after that it's gone.
 */
export const POST = route(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success)
    return Response.json(
      {
        error: `Give the band a name, your name and email, and a password of at least ${MIN_PASSWORD_LENGTH} characters.`,
      },
      {status: 400},
    )
  const {bandName, name, email, password} = parsed.data
  const passwordHash = await hashPassword(password)
  const now = new Date()
  // One at a time, so two people setting up at once can't both be owner
  const user = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7120)`
    if (await tx.user.count()) return null
    return tx.user.create({
      data: {
        email,
        name,
        displayName: name.split(' ')[0],
        isOwner: true,
        passwordHash,
        passwordSetAt: now,
      },
    })
  })
  if (!user)
    return Response.json(
      {error: 'This install is already set up. Sign in instead.'},
      {status: 409},
    )
  const band = await startBand(bandName, user.id, {trial: false})
  return Response.json({bandId: band.id}, {status: 201})
})
