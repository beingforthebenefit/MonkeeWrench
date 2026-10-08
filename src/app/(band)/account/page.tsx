export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {pageUser} from '@/lib/guard'
import ChangePassword from '@/components/ChangePassword'
import AvatarEditor from '@/components/AvatarEditor'
import BandSettingsToggles from '@/components/BandSettingsToggles'
import {avatarUrl} from '@/lib/avatars'
import {displayName} from '@/lib/songs'

export const metadata = {title: 'Account'}

export default async function AccountPage() {
  const {user} = await pageUser()
  const bands = await prisma.membership.count({where: {userId: user.id}})
  return (
    <main className="mx-auto max-w-sm px-4 pb-12 pt-5">
      <h1 className="text-3xl font-extrabold">Account</h1>
      <section className="mt-5" aria-label="Your photo">
        <AvatarEditor
          userId={user.id}
          name={displayName(user)}
          src={avatarUrl(user)}
          self
        />
      </section>
      {/* Someone who signs in with Google may never have had a password */}
      <ChangePassword hasPassword={Boolean(user.passwordHash)} />
      {bands > 1 && (
        <BandSettingsToggles
          initial={{
            shareAvailability: user.shareAvailability,
            blockOtherBands: user.blockOtherBands,
          }}
        />
      )}
    </main>
  )
}
