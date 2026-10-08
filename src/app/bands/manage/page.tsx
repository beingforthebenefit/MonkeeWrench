export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {pageOwner} from '@/lib/guard'
import ManageBands from '@/components/ManageBands'

export const metadata = {title: 'All bands'}

/** The install owner's page: every band, and the web addresses they use. */
export default async function ManageBandsPage() {
  const {user} = await pageOwner()
  const bands = await prisma.band.findMany({
    orderBy: {name: 'asc'},
    select: {
      id: true,
      name: true,
      appName: true,
      domains: {select: {host: true}, orderBy: {host: 'asc'}},
      memberships: {where: {userId: user.id}, select: {isAdmin: true}},
      _count: {select: {memberships: true, songs: true}},
    },
  })
  return (
    <ManageBands
      bands={bands.map((b) => ({
        id: b.id,
        name: b.name,
        appName: b.appName,
        domains: b.domains.map((d) => d.host),
        members: b._count.memberships,
        songs: b._count.songs,
        mine: b.memberships.length > 0,
      }))}
    />
  )
}
