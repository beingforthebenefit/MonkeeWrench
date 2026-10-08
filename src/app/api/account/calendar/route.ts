export const dynamic = 'force-dynamic'

import {randomBytes} from 'crypto'
import {prisma} from '@/lib/db'
import {requireUser} from '@/lib/guard'
import {route} from '@/lib/route'
import {requestOrigin} from '@/lib/band'

// On the address they're using, so each band's members see their own domain
const feedUrl = (token: string) =>
  `${requestOrigin()}/api/calendar/${token}.ics`

/** This person's calendar-feed link, or null if they haven't made one. */
export const GET = route(async () => {
  const {user} = await requireUser()
  return Response.json({
    url: user.calendarToken ? feedUrl(user.calendarToken) : null,
  })
})

/** Make the link, or replace it (the old one stops working). */
export const POST = route(async () => {
  const {user} = await requireUser()
  const token = randomBytes(24).toString('base64url')
  await prisma.user.update({where: {id: user.id}, data: {calendarToken: token}})
  return Response.json({url: feedUrl(token)}, {status: 201})
})
