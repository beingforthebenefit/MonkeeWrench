import Link from 'next/link'
import {prisma} from '@/lib/db'
import {getServerSession} from 'next-auth'
import {authOptions} from '@/lib/auth'
import {redirect} from 'next/navigation'

async function getPending() {
  // Call our API route from the server without re-auth cookies (public pending)
  // Simpler: read from DB directly to avoid fetch/auth complexity
  const threshold = await prisma.settings
    .findUnique({where: {id: 1}})
    .then((s) => s?.voteThreshold ?? 3)

  const rows = await prisma.proposal.findMany({
    where: {status: 'PENDING'},
    include: {votes: true},
    orderBy: {updatedAt: 'desc'},
  })

  const pending = rows.map((r) => ({
    id: r.id,
    title: r.title,
    artist: r.artist,
    voteCount: r.votes.length,
  }))

  const near = pending.filter(
    (p) => p.voteCount >= threshold - 1 && p.voteCount < threshold,
  )
  return {pending, nearCount: near.length, threshold}
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    redirect('/login')
  }
  const [{pending, nearCount}, approvedCount] = await Promise.all([
    getPending(),
    prisma.proposal.count({where: {status: 'APPROVED'}}),
  ])

  return (
    <section className="space-y-8 max-w-4xl mx-auto w-full px-4 py-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <Link
          href="/propose"
          className="inline-flex items-center space-x-1 px-4 py-2 rounded-full bg-red-800 text-white font-semibold transition duration-150 hover:brightness-110 hover:ring-2 hover:ring-red-400/60 hover:shadow-lg"
        >
          <span>Propose Song</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="flex flex-col items-center p-6 bg-[#18191a] shadow-lg rounded-xl">
          <span className="text-3xl font-bold">{pending.length}</span>
          <span className="text-gray-400 mt-1">Pending Proposals</span>
        </div>
        <div className="flex flex-col items-center p-6 bg-[#18191a] shadow-lg rounded-xl">
          <span className="text-3xl font-bold">{nearCount}</span>
          <span className="text-gray-400 mt-1">Near Threshold</span>
        </div>
        <div className="flex flex-col items-center p-6 bg-[#18191a] shadow-lg rounded-xl">
          <span className="text-3xl font-bold">{approvedCount}</span>
          <span className="text-gray-400 mt-1">Approved</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mt-8">
        <Link
          href="/vote"
          className="group flex-1 min-w-[160px] flex flex-col items-center p-4 rounded-xl bg-red-900/15 border border-red-500/30 cursor-pointer shadow-md ring-1 ring-red-500/20 transition duration-150 hover:bg-monkee-red hover:text-white hover:shadow-red-500/30 hover:border-red-500/50 hover:-translate-y-0.5 hover:ring-2 hover:ring-red-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
        >
          <span className="font-semibold inline-flex items-center">
            Vote
            <span className="ml-2 opacity-70 translate-x-0 group-hover:opacity-100 group-hover:translate-x-1 transition">→</span>
          </span>
          <span className="text-xs text-gray-400 group-hover:text-white">
            Pending songs need your vote!
          </span>
        </Link>
        <Link
          href="/setlist"
          className="group flex-1 min-w-[160px] flex flex-col items-center p-4 rounded-xl bg-red-900/15 border border-red-500/30 cursor-pointer shadow-md ring-1 ring-red-500/20 transition duration-150 hover:bg-monkee-red hover:text-white hover:shadow-red-500/30 hover:border-red-500/50 hover:-translate-y-0.5 hover:ring-2 hover:ring-red-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
        >
          <span className="font-semibold inline-flex items-center">
            Setlist
            <span className="ml-2 opacity-70 translate-x-0 group-hover:opacity-100 group-hover:translate-x-1 transition">→</span>
          </span>
          <span className="text-xs text-gray-400 group-hover:text-white">
            See approved songs
          </span>
        </Link>
      </div>
    </section>
  )
}
