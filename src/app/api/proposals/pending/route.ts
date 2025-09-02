import {NextResponse} from 'next/server'
import {prisma} from '@/lib/db'
import {getServerSession} from 'next-auth'
import {authOptions} from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)

  // only PENDING + not archived
  const rows = await prisma.proposal.findMany({
    where: {status: 'PENDING'},
    orderBy: [{updatedAt: 'desc'}],
    select: {
      id: true,
      title: true,
      artist: true,
      _count: {select: {votes: true}},
      // Only compute per-user vote membership if we have a session
      votes: session?.user?.email
        ? {
            where: {user: {email: session.user.email}},
            select: {id: true},
          }
        : undefined,
    },
  })

  // read threshold once
  const settings = await prisma.settings.findUnique({where: {id: 1}})
  const threshold =
    settings?.voteThreshold ?? Number(process.env.VOTE_THRESHOLD ?? 3)

  const data = rows.map((r) => ({
    id: r.id,
    title: r.title,
    artist: r.artist,
    votes: r._count.votes,
    mine: Array.isArray((r as any).votes) && (r as any).votes.length > 0,
    threshold,
  }))

  return NextResponse.json(data)
}
