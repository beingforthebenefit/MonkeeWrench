export const dynamic = 'force-dynamic'
import {ReactNode} from 'react'
import {getServerSession} from 'next-auth'
import {headers} from 'next/headers'
import {redirect} from 'next/navigation'
import {authOptions} from '@/lib/auth'
import {prisma} from '@/lib/db'
import {currentBand} from '@/lib/band'

// Everything here holds copyrighted charts: band members only, and only the
// band they're looking at.
export default async function BandLayout({children}: {children: ReactNode}) {
  const session = await getServerSession(authOptions)
  const path = headers().get('x-pathname') ?? '/songs'
  if (!session?.user?.email)
    redirect('/login?callbackUrl=' + encodeURIComponent(path))
  const user = await prisma.user.findUnique({
    where: {email: session.user.email},
  })
  if (!user) redirect('/login')
  const {band} = await currentBand(user.id)
  // In several bands and none picked on this device yet
  if (!band) redirect('/bands?next=' + encodeURIComponent(path))
  return <>{children}</>
}
