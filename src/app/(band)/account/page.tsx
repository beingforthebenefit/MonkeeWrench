export const dynamic = 'force-dynamic'

import {requireSession} from '@/lib/guard'
import ChangePassword from '@/components/ChangePassword'

export const metadata = {title: 'Password · Monkee Wrench'}

export default async function AccountPage() {
  const {user} = await requireSession()
  // Someone who signs in with Google may never have had a password
  return <ChangePassword hasPassword={Boolean(user.passwordHash)} />
}
