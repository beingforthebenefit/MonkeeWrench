export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireAdmin} from '@/lib/guard'

export async function GET() {
  await requireAdmin()

  const rows = await prisma.proposal.findMany({
    orderBy: [{updatedAt: 'desc'}],
    select: {id: true, title: true, artist: true, status: true},
  })

  return Response.json(rows)
}
