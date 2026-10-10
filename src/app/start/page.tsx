export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {notFound} from 'next/navigation'
import {getServerSession} from 'next-auth'
import {authOptions} from '@/lib/auth'
import {HOSTED, PRICE, TRIAL_DAYS} from '@/lib/hosted'
import {prisma} from '@/lib/db'
import AuthCard from '@/components/AuthCard'
import StartBand from '@/components/StartBand'

export const metadata = {title: 'Start a band'}

/** Only on the hosted service; a self-hosted install starts bands itself. */
export default async function StartPage() {
  if (!HOSTED) notFound()
  const session = await getServerSession(authOptions)
  const email = session?.user?.email ?? null
  const signedIn = Boolean(email)
  // Just signed up with Google: an account, no band yet
  const bandless =
    email !== null &&
    (await prisma.membership.count({where: {user: {email}}})) === 0
  return (
    <AuthCard
      title={signedIn && !bandless ? 'Start another band' : 'Start your band'}
      intro={
        <>
          Free for {TRIAL_DAYS} days, no card needed. Then {PRICE} for the whole
          band, however many of you there are.
        </>
      }
    >
      <StartBand
        signedIn={signedIn}
        google={Boolean(
          process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
        )}
        newAccount={bandless && email ? email : undefined}
      />
      <p className="mt-5 text-sm text-faint">
        {bandless ? null : signedIn ? (
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
