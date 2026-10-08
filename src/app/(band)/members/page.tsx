export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {pageAdmin} from '@/lib/guard'
import {requestOrigin} from '@/lib/band'
import Members from '@/components/Members'
import {avatarUrl} from '@/lib/avatars'

export const metadata = {title: 'Band members'}

export default async function MembersPage() {
  const {user, band} = await pageAdmin()
  const [rows, myAdminBands] = await Promise.all([
    prisma.membership.findMany({
      where: {bandId: band.id},
      include: {user: {include: {memberships: {select: {bandId: true}}}}},
      orderBy: [{user: {displayName: 'asc'}}, {user: {name: 'asc'}}],
    }),
    prisma.membership.findMany({
      where: {userId: user.id, isAdmin: true},
      select: {bandId: true},
    }),
  ])
  const mine = new Set(myAdminBands.map((m) => m.bandId))
  return (
    <Members
      me={user.id}
      bandName={band.name}
      site={requestOrigin()}
      initial={rows.map(({isAdmin, user: u}) => ({
        id: u.id,
        name: u.name ?? '',
        displayName: u.displayName ?? '',
        email: u.email ?? '',
        isAdmin,
        hasPassword: Boolean(u.passwordHash),
        avatar: avatarUrl(u),
        // Same rule as canManageAccount(), for every row at once
        managed:
          user.isOwner ||
          u.id === user.id ||
          u.memberships.every((m) => mine.has(m.bandId)),
      }))}
    />
  )
}
