export const dynamic = 'force-dynamic'

import {brandForRequest} from '@/lib/band'
import LoginForm from '@/components/LoginForm'
import {mailConfigured} from '@/lib/mail'
import {HOSTED} from '@/lib/hosted'
import {redirect} from 'next/navigation'
import {needsSetup} from '@/lib/setup'

export const metadata = {title: 'Sign in'}

export default async function LoginPage() {
  // A fresh install has nobody to sign in yet
  if (await needsSetup()) redirect('/setup')
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
