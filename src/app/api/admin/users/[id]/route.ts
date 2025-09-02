export const dynamic = 'force-dynamic'
import {NextResponse} from 'next/server'
import {requireAdmin} from '@/lib/guard'
import {prisma} from '@/lib/db'

export async function PATCH(req: Request, {params}: {params: {id: string}}) {
  await requireAdmin()
  const id = params.id
  const body = (await req.json().catch(() => ({}))) as {
    isAdmin?: boolean
  }
  if (typeof body.isAdmin !== 'boolean') {
    return NextResponse.json({error: 'Missing isAdmin boolean'}, {status: 400})
  }
  const user = await prisma.user.update({
    where: {id},
    data: {isAdmin: body.isAdmin},
    select: {id: true, email: true, isAdmin: true},
  })
  return NextResponse.json(user)
}

export async function DELETE(_req: Request, {params}: {params: {id: string}}) {
  await requireAdmin()
  const id = params.id
  // With ON DELETE CASCADE on Proposal.proposerId and Vote.userId,
  // deleting a user will also remove their proposals and votes.
  await prisma.user.delete({where: {id}})
  return new NextResponse(null, {status: 204})
}
