export const dynamic = 'force-dynamic'

import {randomBytes} from 'crypto'
import {prisma} from '@/lib/db'
import {requireSession} from '@/lib/guard'
import {route} from '@/lib/route'
import {SITE} from '@/lib/rehearsal-events'

const feedUrl = (token: string) => `${SITE}/api/calendar/${token}.ics`

/** This person's calendar-feed link, or null if they haven't made one. */
export const GET = route(async () => {
  const {user} = await requireSession()
  return Response.json({
    url: user.calendarToken ? feedUrl(user.calendarToken) : null,
  })
})

/** Make the link, or replace it (the old one stops working). */
export const POST = route(async () => {
  const {user} = await requireSession()
  const token = randomBytes(24).toString('base64url')
  await prisma.user.update({where: {id: user.id}, data: {calendarToken: token}})
  return Response.json({url: feedUrl(token)}, {status: 201})
})
