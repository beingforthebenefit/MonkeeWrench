export const dynamic = 'force-dynamic'

import {requireUser} from '@/lib/guard'
import {route} from '@/lib/route'
import {sendToUser} from '@/lib/push'

/** "Send a test": a notification to every device you have turned on. */
export const POST = route(async () => {
  const {user} = await requireUser()
  const sent = await sendToUser(user.id, {
    title: 'Notifications are on',
    body: 'You’ll hear about changes to charts, setlists, rehearsals and proposals here.',
    url: '/account#notifications',
    tag: 'test',
  })
  return Response.json({sent})
})
