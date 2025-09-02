export const dynamic = 'force-dynamic'
import {ReactNode} from 'react'
import {getServerSession} from 'next-auth'
import {authOptions} from '@/lib/auth'
import {prisma} from '@/lib/db'
import {redirect} from 'next/navigation'

export default async function AdminLayout({children}: {children: ReactNode}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    redirect('/login?callbackUrl=' + encodeURIComponent('/admin'))
  }
  const user = await prisma.user.findUnique({
    where: {email: session.user.email},
    select: {isAdmin: true},
  })
  if (!user?.isAdmin) {
    redirect('/')
  }
  return <>{children}</>
}
