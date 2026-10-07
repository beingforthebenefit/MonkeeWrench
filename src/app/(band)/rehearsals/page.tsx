export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'
import {requireSession} from '@/lib/guard'
import {addDays, dayRange, keyOf, todayKey} from '@/lib/availability'
import {displayName} from '@/lib/songs'
import Rehearsals from '@/components/Rehearsals'

export const metadata = {title: 'Rehearsals · Monkee Wrench'}

const WEEKS = 8

export default async function RehearsalsPage() {
  const {user} = await requireSession()
  const today = todayKey()
  const days = dayRange(today, WEEKS * 7)
  const [users, rows, rehearsals] = await Promise.all([
    prisma.user.findMany({orderBy: {name: 'asc'}}),
    prisma.unavailability.findMany({
      where: {
        date: {
          gte: new Date(today + 'T00:00:00Z'),
          lte: new Date(addDays(today, WEEKS * 7) + 'T00:00:00Z'),
        },
      },
    }),
    prisma.rehearsal.findMany({
      where: {date: {gte: new Date(today + 'T00:00:00Z')}},
      orderBy: {date: 'asc'},
      include: {createdBy: {select: {name: true, email: true}}},
    }),
  ])
  return (
    <Rehearsals
      me={user.id}
      isAdmin={user.isAdmin}
      days={days}
      members={users.map((u) => ({
        id: u.id,
        name: displayName(u),
        answered: Boolean(u.availabilityUpdatedAt),
      }))}
      entries={rows.map((r) => ({
        userId: r.userId,
        date: keyOf(r.date),
        kind: r.kind,
      }))}
      rehearsals={rehearsals.map((r) => ({
        id: r.id,
        date: keyOf(r.date),
        time: r.time,
        place: r.place,
        note: r.note,
        by: displayName(r.createdBy),
        mine: r.createdById === user.id,
      }))}
    />
  )
}
