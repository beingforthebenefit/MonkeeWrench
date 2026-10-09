export const dynamic = 'force-dynamic'

import {requireUser} from '@/lib/guard'
import {route} from '@/lib/route'

/** The public key a device subscribes with (null: push isn't set up here). */
export const GET = route(async () => {
  await requireUser()
  return Response.json({key: process.env.VAPID_PUBLIC_KEY ?? null})
})
