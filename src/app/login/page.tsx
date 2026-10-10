export const dynamic = 'force-dynamic'

import {brandForRequest} from '@/lib/band'
import LoginForm from '@/components/LoginForm'
import {mailConfigured} from '@/lib/mail'
import {HOSTED} from '@/lib/hosted'
import {redirect} from 'next/navigation'
import {needsSetup} from '@/lib/setup'
import {getServerSession} from 'next-auth'
import {authOptions} from '@/lib/auth'
import {prisma} from '@/lib/db'
import {safeCallback} from '@/lib/url'

export const metadata = {title: 'Sign in'}

export default async function LoginPage({
  searchParams = {},
}: {
  searchParams?: {callbackUrl?: string}
}) {
  // A fresh install has nobody to sign in yet
  if (await needsSetup()) redirect('/setup')
  // Already signed in (the product page's "Log in", an old bookmark): in.
  // Only for an account that still exists, or the band pages would send
  // them straight back here
  const session = await getServerSession(authOptions)
  if (
    session?.user?.email &&
    (await prisma.user.findUnique({
      where: {email: session.user.email},
      select: {id: true},
    }))
  )
    redirect(safeCallback(searchParams.callbackUrl))
  const {band, appName, iconUrl} = await brandForRequest()
  return (
    <LoginForm
      appName={appName}
      bandName={band?.name ?? null}
      iconUrl={iconUrl}
      forgot={mailConfigured()}
      signup={HOSTED}
    />
  )
}
