export const dynamic = 'force-dynamic'
import {ReactNode} from 'react'
import {getServerSession} from 'next-auth'
import {headers} from 'next/headers'
import {redirect} from 'next/navigation'
import {authOptions} from '@/lib/auth'
import {prisma} from '@/lib/db'
import {currentBand} from '@/lib/band'
import Tour from '@/components/tour/Tour'
import DemoStrip from '@/components/DemoStrip'
import {DEMO} from '@/lib/demo'
import {HOSTED} from '@/lib/hosted'
import {bandBilling} from '@/lib/billing'
import BillingStrip from '@/components/BillingStrip'

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
  const billing = HOSTED ? await bandBilling(band.id) : null
  return (
    <>
      {DEMO && <DemoStrip />}
      {billing && (
        <BillingStrip
          billing={billing}
          isAdmin={band.isAdmin || user.isOwner}
        />
      )}
      {children}
      {/* The first-time tour, until they finish or skip it */}
      <Tour auto={!user.tourDoneAt} features={{scheduling: band.scheduling}} />
    </>
  )
}
