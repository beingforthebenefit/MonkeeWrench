export const dynamic = 'force-dynamic'
import {ReactNode} from 'react'
import {getServerSession} from 'next-auth'
import {headers} from 'next/headers'
import {redirect} from 'next/navigation'
import {authOptions} from '@/lib/auth'
import {prisma} from '@/lib/db'
import {currentBand} from '@/lib/band'
import Tour from '@/components/tour/Tour'
import IosInstall from '@/components/pwa/IosInstall'
import DemoStrip from '@/components/DemoStrip'
import {DEMO} from '@/lib/demo'
import {HOSTED} from '@/lib/hosted'
import {bandBilling} from '@/lib/billing'
import BillingStrip from '@/components/BillingStrip'
import InviteNudge from '@/components/InviteNudge'
import {mailConfigured} from '@/lib/mail'

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
  const {band, bands} = await currentBand(user.id)
  if (!band) {
    // Signed up with Google and no band yet: start one
    if (!bands.length && HOSTED) redirect('/start')
    // In several bands and none picked on this device yet
    redirect('/bands?next=' + encodeURIComponent(path))
  }
  const billing = HOSTED ? await bandBilling(band.id) : null
  const isAdmin = band.isAdmin || user.isOwner
  // Just its first member: the nudge to add the rest
  const alone =
    isAdmin &&
    !DEMO &&
    (await prisma.membership.count({where: {bandId: band.id}})) === 1
  return (
    <>
      {DEMO && <DemoStrip />}
      {billing && <BillingStrip billing={billing} isAdmin={isAdmin} />}
      {alone && <InviteNudge bandId={band.id} emails={mailConfigured()} />}
      {children}
      {/* The first-time tour, until they finish or skip it */}
      <Tour
        auto={!user.tourDoneAt}
        features={{scheduling: band.scheduling, admin: isAdmin, demo: DEMO}}
      />
      {/* iPhone and iPad: how to put it on the home screen */}
      <IosInstall tourDone={Boolean(user.tourDoneAt)} />
    </>
  )
}
