export const dynamic = 'force-dynamic'

import {notFound} from 'next/navigation'
import {prisma} from '@/lib/db'
import {pageSession} from '@/lib/guard'
import {addDays, dayRange, keyOf, todayKey} from '@/lib/availability'
import {bandEntries, otherBandBlocks} from '@/lib/availability-server'
import {displayName} from '@/lib/songs'
import {avatarUrl} from '@/lib/avatars'
import Rehearsals from '@/components/Rehearsals'

export const metadata = {title: 'Rehearsals'}

// How far ahead to look for a day everyone can make
const HORIZON_DAYS = 730

export default async function RehearsalsPage() {
  const {user, band, isAdmin} = await pageSession()
  if (!band.scheduling) notFound()
  const today = todayKey(new Date(), band.timezone)
  const from = new Date(today + 'T00:00:00Z')
  const to = new Date(addDays(today, HORIZON_DAYS) + 'T00:00:00Z')
  const [members, rehearsals, myBandCount] = await Promise.all([
    prisma.membership.findMany({
      where: {bandId: band.id},
      select: {user: true},
      orderBy: {user: {name: 'asc'}},
    }),
    prisma.rehearsal.findMany({
      where: {bandId: band.id, date: {gte: from}},
      orderBy: {date: 'asc'},
      include: {
        createdBy: {select: {name: true, displayName: true, email: true}},
      },
    }),
    prisma.membership.count({where: {userId: user.id}}),
  ])
  const users = members.map((m) => m.user)
  const [entries, blocks] = await Promise.all([
    bandEntries(band.id, users, from, to),
    otherBandBlocks(band.id, users, user.id, from, to),
  ])
  return (
    <Rehearsals
      me={user.id}
      isAdmin={isAdmin}
      horizon={dayRange(today, HORIZON_DAYS)}
      members={users.map((u) => ({
        id: u.id,
        name: displayName(u),
        answered: Boolean(u.availabilityUpdatedAt),
        avatar: avatarUrl(u),
      }))}
      entries={entries}
      blocks={blocks}
      rehearsals={rehearsals.map((r) => ({
        id: r.id,
        date: keyOf(r.date),
        time: r.time,
        place: r.place,
        note: r.note,
        by: displayName(r.createdBy),
        mine: r.createdById === user.id,
      }))}
      bandName={band.name}
      timezone={band.timezone}
      blocksOn={user.blockOtherBands && myBandCount > 1}
    />
  )
}
