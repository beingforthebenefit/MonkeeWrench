export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/db'

type Near = { proposalId: string; _count: { _all: number } }

export default async function Dashboard() {
  const [pending, approved, settings] = await Promise.all([
    prisma.proposal.count({ where: { status: 'PENDING' } }),
    prisma.proposal.count({ where: { status: 'APPROVED' } }),
    prisma.settings.findUnique({ where: { id: 1 } }),
  ])

  const near = await prisma.vote.groupBy({
    by: ['proposalId'],
    _count: { _all: true },
    where: { proposal: { status: 'PENDING' } },
  })

  const threshold = settings?.voteThreshold ?? 2
  const nearCount = (near as Near[]).filter(
    (n: Near) => n._count._all >= Math.max(1, threshold - 1)
  ).length

  return (
    <div>
      <h2>Dashboard</h2>
      <p>Pending: {pending}</p>
      <p>Near threshold: {nearCount}</p>
      <p>Approved: {approved}</p>
    </div>
  )
}
