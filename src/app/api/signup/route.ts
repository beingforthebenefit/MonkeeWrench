export const dynamic = 'force-dynamic'

import {z} from 'zod'
import {getServerSession} from 'next-auth'
import {authOptions} from '@/lib/auth'
import {prisma} from '@/lib/db'
import {requestOrigin} from '@/lib/band'
import {slugify} from '@/lib/band-fields'
import {logActivity} from '@/lib/songs'
import {route} from '@/lib/route'
import {HOSTED, trialEnd} from '@/lib/hosted'
import {mailConfigured, sendMail} from '@/lib/mail'
import {sendPasswordLink} from '@/lib/email-tokens'
import {allow, clientIp} from '@/lib/rate-limit'
import {SAMPLE_NOTE, SAMPLE_SONGS} from '@/lib/sample-songs'
import {renderEmail} from '@/lib/email-layout'

const Body = z.object({
  bandName: z.string().trim().min(1).max(80),
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  // A field people can't see: only bots fill it in
  website: z.string().optional(),
})

const HOUR = 60 * 60 * 1000

async function newBand(name: string, userId: string) {
  const base = slugify(name)
  let slug = base
  for (let n = 2; await prisma.band.findUnique({where: {slug}}); n++)
    slug = `${base}-${n}`
  return prisma.$transaction(async (tx) => {
    const band = await tx.band.create({
      data: {name, slug, paidUntil: trialEnd()},
    })
    await tx.membership.create({data: {userId, bandId: band.id, isAdmin: true}})
    // Something to open straight away, and for the tour to show
    for (const song of SAMPLE_SONGS)
      await tx.song.create({
        data: {
          bandId: band.id,
          title: song.title,
          writer: song.writer,
          seconds: song.seconds,
          status: 'READY',
          notes: SAMPLE_NOTE,
          updatedById: userId,
          chartVersions: {
            create: {
              number: 1,
              source: song.chart,
              authorId: userId,
              note: 'Sample song',
            },
          },
        },
      })
    await logActivity(tx, {
      bandId: band.id,
      userId,
      action: 'band.create',
      targetType: 'band',
      targetId: band.id,
      summary: `started ${band.name}`,
    })
    return band
  })
}

/**
 * Start a band on the hosted service: free for the trial, then $12 a year.
 * Signed in: the band is theirs straight away. Otherwise they get an email
 * to choose a password, which also proves the address is theirs. The answer
 * is the same whether or not the address already has an account.
 */
export const POST = route(async (req: Request) => {
  if (!HOSTED) return new Response('Not Found', {status: 404})
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success)
    return Response.json(
      {error: 'Give the band a name, and your name and email.'},
      {status: 400},
    )
  const {bandName, name, email, website} = parsed.data

  const session = await getServerSession(authOptions)
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: {email: session.user.email},
    })
    if (!user) return new Response('Unauthorized', {status: 401})
    if (!allow(`start:${user.id}`, 5, 24 * HOUR))
      return Response.json(
        {error: 'That’s a lot of new bands for one day. Try tomorrow.'},
        {status: 429},
      )
    const band = await newBand(bandName, user.id)
    return Response.json({bandId: band.id}, {status: 201})
  }

  if (!name || !email)
    return Response.json(
      {error: 'Give the band a name, and your name and email.'},
      {status: 400},
    )
  if (!mailConfigured())
    return Response.json(
      {error: 'Starting a band needs email, which isn’t set up here.'},
      {status: 503},
    )
  const ip = clientIp(req.headers)
  if (!allow(`signup-ip:${ip}`, 5, HOUR) || !allow(`signup:${email}`, 3, HOUR))
    return Response.json(
      {error: 'Too many tries. Wait an hour and try again.'},
      {status: 429},
    )
  // A bot: say it worked, do nothing
  if (website) return Response.json({ok: true})

  const origin = requestOrigin()
  const existing = await prisma.user.findFirst({
    where: {email: {equals: email, mode: 'insensitive'}},
  })
  if (existing) {
    // Don't say so on the page (it would tell anyone who has an account)
    await sendMail({
      to: email,
      subject: `Starting ${bandName} on Bandstand`,
      ...renderEmail(
        {
          heading: 'You already have an account',
          paragraphs: [
            `Someone, probably you, asked to start ${bandName} on Bandstand with this address. It already has an account, so sign in and start the band from the same page.`,
          ],
          button: {label: 'Sign in and start it', url: `${origin}/start`},
          after: [`Forgotten your password? ${origin}/forgot`],
          footer: 'If this wasn’t you, ignore this email.',
        },
        origin,
      ),
    }).catch((e) => console.error('[signup] email failed', e))
    return Response.json({ok: true})
  }

  const user = await prisma.user.create({
    data: {email, name, displayName: name.split(' ')[0]},
  })
  const band = await newBand(bandName, user.id)
  try {
    await sendPasswordLink({
      userId: user.id,
      email,
      kind: 'WELCOME',
      origin,
      bandName: band.name,
    })
  } catch (e) {
    // The band is there; "Forgot your password?" sends a fresh link
    console.error('[signup] welcome email failed', e)
  }
  return Response.json({ok: true})
})
