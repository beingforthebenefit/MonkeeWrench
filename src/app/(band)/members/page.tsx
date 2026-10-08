export const dynamic = 'force-dynamic'

import {redirect} from 'next/navigation'
import {prisma} from '@/lib/db'
import {requireSession} from '@/lib/guard'
import Members from '@/components/Members'
import {avatarUrl} from '@/lib/avatars'

export const metadata = {title: 'Band members · Monkee Wrench'}

export default async function MembersPage() {
  const {user} = await requireSession()
  if (!user.isAdmin) redirect('/songs')
  const users = await prisma.user.findMany({
    orderBy: [{displayName: 'asc'}, {name: 'asc'}],
  })
  return (
    <Members
      me={user.id}
      initial={users.map((u) => ({
        id: u.id,
        name: u.name ?? '',
        displayName: u.displayName ?? '',
        email: u.email ?? '',
        isAdmin: u.isAdmin,
        hasPassword: Boolean(u.passwordHash),
        avatar: avatarUrl(u),
      }))}
    />
  )
}
