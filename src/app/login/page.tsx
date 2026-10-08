export const dynamic = 'force-dynamic'

import {brandForRequest} from '@/lib/band'
import LoginForm from '@/components/LoginForm'

export const metadata = {title: 'Sign in'}

export default async function LoginPage() {
  const {band, appName, iconUrl} = await brandForRequest()
  return (
    <LoginForm
      appName={appName}
      bandName={band?.name ?? null}
      iconUrl={iconUrl}
    />
  )
}
