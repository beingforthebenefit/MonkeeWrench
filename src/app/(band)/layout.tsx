export const dynamic = 'force-dynamic'
import {ReactNode} from 'react'
import {getServerSession} from 'next-auth'
import {headers} from 'next/headers'
import {redirect} from 'next/navigation'
import {authOptions} from '@/lib/auth'

// Everything here holds copyrighted charts: band members only.
export default async function BandLayout({children}: {children: ReactNode}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    const path = headers().get('x-pathname') ?? '/songs'
    redirect('/login?callbackUrl=' + encodeURIComponent(path))
  }
  return <>{children}</>
}
