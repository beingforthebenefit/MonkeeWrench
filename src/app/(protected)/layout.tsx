import { ReactNode } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    // Send back to login with the original target (defaults to /setlist)
    redirect('/login?callbackUrl=' + encodeURIComponent('/setlist'))
  }
  return <>{children}</>
}
