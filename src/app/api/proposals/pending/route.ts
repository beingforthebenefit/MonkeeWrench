export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const GET = async () => {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email || ''
  const me = email ? await prisma.user.findUnique({ where: { email } }) : null

  const settings = await prisma.settings.findUnique({ where: { id: 1 } })
  const threshold = settings?.voteThreshold ?? 2

  // Query includes votes; give rows an explicit structural type to avoid implicit any
  const rows = await prisma.proposal.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    include: { votes: true },
  })

  type Row = { id: string; title: string; artist: string; votes: { userId: string }[] }

  const data = (rows as Row[]).map((r: Row) => ({
    id: r.id,
    title: r.title,
    artist: r.artist,
    votes: r.votes.length,
    // avoid non-null assertions; be explicit:
    mine: me ? r.votes.some((v) => v.userId === me.id) : false,
    threshold,
  }))

  return Response.json(data)
}
