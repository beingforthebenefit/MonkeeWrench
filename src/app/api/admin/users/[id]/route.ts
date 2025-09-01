import {NextResponse} from 'next/server'
import {requireAdmin} from '@/lib/guard'
import {prisma} from '@/lib/db'

export async function PATCH(
  req: Request,
  {params}: {params: {id: string}},
) {
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

export async function DELETE(
  _req: Request,
  {params}: {params: {id: string}},
) {
  await requireAdmin()
  const id = params.id
  const [proposalsCount, votesCount] = await Promise.all([
    prisma.proposal.count({where: {proposerId: id}}),
    prisma.vote.count({where: {userId: id}}),
  ])
  if (proposalsCount > 0 || votesCount > 0) {
    return NextResponse.json(
      {
        error:
          'Cannot delete: user has existing proposals or votes. Remove those first.',
      },
      {status: 400},
    )
  }
  await prisma.user.delete({where: {id}})
  return new NextResponse(null, {status: 204})
}

