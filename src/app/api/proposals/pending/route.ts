import {NextResponse} from 'next/server'
import {prisma} from '@/lib/db'
import {getServerSession} from 'next-auth'
import {authOptions} from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json([], {status: 401})

  // only PENDING + not archived
  const rows = await prisma.proposal.findMany({
    where: {status: 'PENDING'},
    orderBy: [{updatedAt: 'desc'}],
    select: {
      id: true,
      title: true,
      artist: true,
      _count: {select: {votes: true}},
      votes: {
        where: {user: {email: session.user.email}},
        select: {id: true},
      },
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
    mine: r.votes.length > 0,
    threshold,
  }))

  return NextResponse.json(data)
}
