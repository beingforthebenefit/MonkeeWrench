export const dynamic = 'force-dynamic'

import {requireSession} from '@/lib/guard'
import ChangePassword from '@/components/ChangePassword'
import ThemePicker from '@/components/ThemePicker'

export const metadata = {title: 'Account · Monkee Wrench'}

export default async function AccountPage() {
  const {user} = await requireSession()
  return (
    <main className="mx-auto max-w-sm px-4 pb-12 pt-5">
      <h1 className="text-3xl font-extrabold">Account</h1>
      <div className="mt-5">
        <ThemePicker />
      </div>
      {/* Someone who signs in with Google may never have had a password */}
      <ChangePassword hasPassword={Boolean(user.passwordHash)} />
    </main>
  )
}
