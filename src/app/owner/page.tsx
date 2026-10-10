export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {prisma} from '@/lib/db'
import {pageOwner} from '@/lib/guard'
import {HOSTED, standing} from '@/lib/hosted'
import {ownerStats} from '@/lib/owner-stats'
import {mailConfigured} from '@/lib/mail'
import OwnerNumbers from '@/components/owner/OwnerNumbers'
import OwnerBands from '@/components/owner/OwnerBands'
import OwnerPeople from '@/components/owner/OwnerPeople'
import TestEmail from '@/components/owner/TestEmail'

export const metadata = {title: 'Owner'}

const h2 = 'text-xs font-bold uppercase tracking-widest text-muted'

/**
 * Running this install: only its owner sees it. Numbers about the hosted
 * service, and every band and person, with the fixes an owner needs. Names
 * and counts only: never a band's charts.
 */
export default async function OwnerPage() {
  const {user} = await pageOwner()
  const now = new Date()
  const [bands, lastActivity, users] = await Promise.all([
    prisma.band.findMany({
      orderBy: {createdAt: 'desc'},
      select: {
        id: true,
        name: true,
        createdAt: true,
        paidUntil: true,
        polarSubscriptionId: true,
        subscriptionStatus: true,
        trialStartedAt: true,
        _count: {select: {memberships: true, songs: true}},
      },
    }),
    prisma.activity.groupBy({by: ['bandId'], _max: {createdAt: true}}),
    prisma.user.findMany({
      orderBy: {createdAt: 'desc'},
      select: {
        id: true,
        name: true,
        displayName: true,
        email: true,
        isOwner: true,
        passwordHash: true,
        createdAt: true,
        memberships: {select: {band: {select: {id: true, name: true}}}},
      },
    }),
  ])
  const last = new Map(lastActivity.map((a) => [a.bandId, a._max.createdAt]))
  const rows = bands.map((b) => ({...b, lastActivity: last.get(b.id) ?? null}))
  const stats = ownerStats(rows, now)

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-5">
      <h1 className="text-3xl font-extrabold">Owner</h1>
      <p className="mt-1 text-muted">
        Everything on this install: {stats.bands} bands, {users.length} people.{' '}
        {HOSTED && (
          <a
            href="https://polar.sh/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky"
          >
            Money in and out: Polar ↗
          </a>
        )}
      </p>

      {HOSTED && (
        <section aria-labelledby="num-h" className="mt-6">
          <h2 id="num-h" className={h2}>
            The hosted service
          </h2>
          <OwnerNumbers stats={stats} />
        </section>
      )}

      <section aria-labelledby="bands-h" className="mt-10">
        <h2 id="bands-h" className={h2}>
          Bands
        </h2>
        <OwnerBands
          hosted={HOSTED}
          bands={rows.map((b) => {
            const s = standing(b, now, HOSTED)
            return {
              id: b.id,
              name: b.name,
              standing:
                s.kind === 'paid' &&
                (b.subscriptionStatus === 'canceling' ||
                  b.subscriptionStatus === 'canceled')
                  ? 'cancelled'
                  : s.kind,
              paidUntil: b.paidUntil?.toISOString() ?? null,
              members: b._count.memberships,
              songs: b._count.songs,
              lastActivity: b.lastActivity?.toISOString() ?? null,
              createdAt: b.createdAt.toISOString(),
            }
          })}
        />
      </section>

      <section aria-labelledby="people-h" className="mt-10">
        <h2 id="people-h" className={h2}>
          People
        </h2>
        <OwnerPeople
          me={user.id}
          emails={mailConfigured()}
          bands={bands.map((b) => ({id: b.id, name: b.name}))}
          people={users.map((u) => ({
            id: u.id,
            name: u.name ?? '',
            displayName: u.displayName ?? '',
            email: u.email ?? '',
            isOwner: u.isOwner,
            hasPassword: Boolean(u.passwordHash),
            createdAt: u.createdAt.toISOString(),
            bands: u.memberships.map((m) => m.band.name),
          }))}
        />
      </section>

      <section aria-labelledby="email-h" className="mt-10">
        <h2 id="email-h" className={h2}>
          Emails
        </h2>
        <TestEmail email={user.email ?? ''} />
      </section>

      <p className="mt-8 text-sm">
        <Link href="/bands/manage" className="text-sky">
          Start a band, or connect a web address ›
        </Link>
      </p>
    </main>
  )
}
