export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireSession} from '@/lib/guard'
import {bus, EVENTS} from '@/lib/events'
import {Prisma} from '@prisma/client'
import {addSongFromProposal} from '@/lib/songs'
import {route} from '@/lib/route'

async function withPromotion(
  tx: Prisma.TransactionClient,
  proposalId: string,
  userId: string,
  band: {id: string; voteThreshold: number; tributeTo: string | null},
) {
  const threshold = band.voteThreshold
  const voteCount = await tx.vote.count({where: {proposalId}})
  const p = await tx.proposal.findUnique({where: {id: proposalId}})
  if (!p) return
  if (p.status === 'PENDING' && voteCount >= threshold) {
    await tx.proposal.update({
      where: {id: proposalId},
      data: {status: 'APPROVED'},
    })
    await addSongFromProposal(tx, p, userId, band)
  }
}

async function inBand(proposalId: string, bandId: string) {
  const p = await prisma.proposal.findFirst({
    where: {id: proposalId, bandId},
    select: {id: true},
  })
  return Boolean(p)
}

export const POST = route(
  async (_req: Request, {params}: {params: {id: string}}) => {
    const {user, band} = await requireSession()
    const pid = params.id
    if (!(await inBand(pid, band.id)))
      return new Response('Not Found', {status: 404})

    try {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.vote.create({data: {userId: user.id, proposalId: pid}})
        await tx.auditLog.create({
          data: {userId: user.id, action: 'VOTE', targetId: pid},
        })
        await withPromotion(tx, pid, user.id, band)
      })
    } catch {
      // unique(userId, proposalId) constraint trip -> conflict
      return new Response('Conflict', {status: 409})
    }

    bus.emit(EVENTS.PROPOSAL_UPDATED, {id: pid, bandId: band.id})
    return new Response(null, {status: 204})
  },
)

export const DELETE = route(
  async (_req: Request, {params}: {params: {id: string}}) => {
    const {user, band} = await requireSession()
    const pid = params.id
    if (!(await inBand(pid, band.id)))
      return new Response('Not Found', {status: 404})

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.vote.delete({
        where: {userId_proposalId: {userId: user.id, proposalId: pid}},
      })
      await tx.auditLog.create({
        data: {userId: user.id, action: 'UNVOTE', targetId: pid},
      })
      // No auto-demote in v1
    })

    bus.emit(EVENTS.PROPOSAL_UPDATED, {id: pid, bandId: band.id})
    return new Response(null, {status: 204})
  },
)
