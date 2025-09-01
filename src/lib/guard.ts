import {getServerSession} from 'next-auth'
import {authOptions} from './auth'
import {prisma} from './db'

export async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) throw new Response('Unauthorized', {status: 401})
  const user = await prisma.user.findUnique({
    where: {email: session.user.email},
  })
  if (!user) throw new Response('Unauthorized', {status: 401})
  return {session, user}
}

export async function requireAdmin() {
  const {user} = await requireSession()
  if (!user.isAdmin) throw new Response('Forbidden', {status: 403})
  return user
}
