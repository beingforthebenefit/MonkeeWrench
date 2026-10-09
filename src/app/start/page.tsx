export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {notFound} from 'next/navigation'
import {getServerSession} from 'next-auth'
import {authOptions} from '@/lib/auth'
import {HOSTED, PRICE, TRIAL_DAYS} from '@/lib/hosted'
import AuthCard from '@/components/AuthCard'
import StartBand from '@/components/StartBand'

export const metadata = {title: 'Start a band'}

/** Only on the hosted service; a self-hosted install starts bands itself. */
export default async function StartPage() {
  if (!HOSTED) notFound()
  const session = await getServerSession(authOptions)
  const signedIn = Boolean(session?.user?.email)
  return (
    <AuthCard
      title={signedIn ? 'Start another band' : 'Start your band'}
      intro={
        <>
          Free for {TRIAL_DAYS} days, no card needed. Then {PRICE} for the whole
          band, however many of you there are.
        </>
      }
    >
      <StartBand signedIn={signedIn} />
      <p className="mt-5 text-sm text-faint">
        {signedIn ? (
          <Link href="/songs" className="text-sky">
            Back to your band
          </Link>
        ) : (
          <>
            Already in a band here?{' '}
            <Link href="/login" className="text-sky">
              Sign in
            </Link>
          </>
        )}
      </p>
    </AuthCard>
  )
}
