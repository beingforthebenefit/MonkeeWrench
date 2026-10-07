export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireAdmin} from '@/lib/guard'
import {route} from '@/lib/route'

export const GET = route(async function GET() {
  await requireAdmin()

  const rows = await prisma.proposal.findMany({
    orderBy: [{updatedAt: 'desc'}],
    select: {id: true, title: true, artist: true, status: true},
  })

  return Response.json(rows)
})
