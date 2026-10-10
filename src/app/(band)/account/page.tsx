export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {pageUser} from '@/lib/guard'
import ChangePassword from '@/components/ChangePassword'
import AvatarEditor from '@/components/AvatarEditor'
import BandSettingsToggles from '@/components/BandSettingsToggles'
import AppSettings from '@/components/pwa/AppSettings'
import {pushReady} from '@/lib/push'
import {avatarUrl} from '@/lib/avatars'
import {displayName} from '@/lib/songs'
import DangerDelete from '@/components/DangerDelete'

export const metadata = {title: 'Account'}

export default async function AccountPage() {
  const {user} = await pageUser()
  const bands = await prisma.membership.count({where: {userId: user.id}})
  const devices = await prisma.pushSubscription.findMany({
    where: {userId: user.id},
    select: {device: true},
    orderBy: {createdAt: 'asc'},
  })
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
      <AppSettings
        ready={pushReady()}
        devices={devices.map((d) => d.device ?? 'A device')}
        initial={{
          notifyCharts: user.notifyCharts,
          notifySetlists: user.notifySetlists,
          notifyRehearsals: user.notifyRehearsals,
          notifyProposals: user.notifyProposals,
        }}
      />
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
      {!user.isOwner && user.email && (
        <DangerDelete
          what="your account"
          confirmText={user.email}
          confirmLabel="Type your email to confirm"
          endpoint="/api/account"
          signOutAfter
          explain="You leave every band you’re in, and can’t sign in again. Chart versions you wrote stay (without your name); your proposals, votes, cues and photo go. A band you’re the only one in is deleted too."
        />
      )}
    </main>
  )
}
