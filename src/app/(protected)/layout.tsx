export const dynamic = 'force-dynamic'
import {ReactNode} from 'react'
import {getServerSession} from 'next-auth'
import {authOptions} from '@/lib/auth'
import {redirect} from 'next/navigation'

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) {
    // Only the admin page lives in this group
    redirect('/login?callbackUrl=' + encodeURIComponent('/admin'))
  }
  return <>{children}</>
}
