export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/guard'
import { bus, EVENTS } from '@/lib/events'
import { Prisma } from '@prisma/client'

async function withPromotion(tx: Prisma.TransactionClient, proposalId: string) {
  const settings = await tx.settings.findUnique({ where: { id: 1 } })
  const threshold = settings?.voteThreshold ?? 2
  const voteCount = await tx.vote.count({ where: { proposalId } })
  const p = await tx.proposal.findUnique({ where: { id: proposalId } })
  if (!p) return
  if (p.status === 'PENDING' && voteCount >= threshold) {
    await tx.proposal.update({
      where: { id: proposalId },
      data: { status: 'APPROVED' },
    })
  }
}

export const POST = async (_req: Request, { params }: { params: { id: string } }) => {
  const { user } = await requireSession()
  const pid = params.id

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.vote.create({ data: { userId: user.id, proposalId: pid } })
      await tx.auditLog.create({ data: { userId: user.id, action: 'VOTE', targetId: pid } })
      await withPromotion(tx, pid)
    })
  } catch {
    // unique(userId, proposalId) constraint trip -> conflict
    return new Response('Conflict', { status: 409 })
  }

  bus.emit(EVENTS.PROPOSAL_UPDATED, { id: pid })
  return new Response(null, { status: 204 })
}

export const DELETE = async (_req: Request, { params }: { params: { id: string } }) => {
  const { user } = await requireSession()
  const pid = params.id

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.vote.delete({
      where: { userId_proposalId: { userId: user.id, proposalId: pid } },
    })
    await tx.auditLog.create({ data: { userId: user.id, action: 'UNVOTE', targetId: pid } })
    // No auto-demote in v1
  })

  bus.emit(EVENTS.PROPOSAL_UPDATED, { id: pid })
  return new Response(null, { status: 204 })
}
