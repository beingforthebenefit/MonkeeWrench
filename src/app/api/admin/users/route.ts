export const dynamic = 'force-dynamic'
import {NextResponse} from 'next/server'
import {requireAdmin} from '@/lib/guard'
import {prisma} from '@/lib/db'

export async function GET() {
  await requireAdmin()
  const users = await prisma.user.findMany({
    orderBy: {createdAt: 'desc'},
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      isAdmin: true,
      createdAt: true,
      proposals: {select: {id: true}},
      votes: {select: {id: true}},
    },
  })
  const data = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    isAdmin: u.isAdmin,
    createdAt: u.createdAt,
    proposalsCount: u.proposals.length,
    votesCount: u.votes.length,
    canDelete: true,
  }))
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  await requireAdmin()
  const body = (await req.json().catch(() => ({}))) as {
    email?: string
    name?: string
    isAdmin?: boolean
  }
  const email = (body.email || '').trim().toLowerCase()
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({error: 'Invalid email'}, {status: 400})
  }
  const isAdmin = Boolean(body.isAdmin)
  const name = body.name?.trim() || undefined

  const user = await prisma.user.upsert({
    where: {email},
    create: {email, name, isAdmin},
    update: {name, isAdmin},
    select: {id: true, email: true, name: true, isAdmin: true},
  })
  return NextResponse.json(user, {status: 201})
}
