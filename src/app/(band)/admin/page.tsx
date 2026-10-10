export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {prisma} from '@/lib/db'
import {pageAdmin} from '@/lib/guard'
import {iconUrl} from '@/lib/band'
import VoteThreshold from '@/components/VoteThreshold'
import BandSettings from '@/components/BandSettings'
import BillingPanel from '@/components/BillingPanel'
import DangerDelete from '@/components/DangerDelete'
import {HOSTED, PRICE} from '@/lib/hosted'
import {bandBilling} from '@/lib/billing'

export const metadata = {title: 'Admin'}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: {billing?: string}
}) {
  const {band, user} = await pageAdmin()
  const billing = HOSTED ? await bandBilling(band.id) : null
  const [members, noPassword, songs, versions] = await Promise.all([
    prisma.membership.count({where: {bandId: band.id}}),
    prisma.membership.count({
      where: {bandId: band.id, user: {passwordHash: null}},
    }),
    prisma.song.count({where: {bandId: band.id}}),
    prisma.chartVersion.count({where: {song: {bandId: band.id}}}),
  ])
  const cards = [
    {
      href: '/members',
      title: 'Band members',
      body: `${members} member${members === 1 ? '' : 's'}${noPassword ? ` · ${noPassword} without a password yet` : ''}. Add people, send passwords, make admins.`,
    },
    {
      href: '/activity',
      title: 'Recent changes',
      body: 'Everything anyone has changed, newest first.',
    },
    {
      href: '/songs/new',
      title: 'Add a song',
      body: `${songs} songs, ${versions} chart versions so far.`,
    },
  ]
  return (
    <main className="mx-auto max-w-3xl px-4 pb-12 pt-5">
      <h1 className="text-3xl font-extrabold">Admin</h1>
      <p className="mt-1 text-muted">{band.name}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-xl border border-line-2 bg-panel p-4 no-underline hover:border-text"
          >
            <span className="block font-bold">{c.title} ›</span>
            <span className="mt-1 block text-sm text-muted">{c.body}</span>
          </Link>
        ))}
      </div>
      {billing && billing.kind !== 'free' && (
        <section id="billing" aria-labelledby="billing-h" className="mt-8">
          <h2
            id="billing-h"
            className="text-xs font-bold uppercase tracking-widest text-muted"
          >
            Subscription
          </h2>
          <BillingPanel
            billing={billing}
            price={PRICE}
            thanks={searchParams.billing === 'thanks'}
          />
        </section>
      )}
      <section aria-labelledby="band-h" className="mt-8">
        <h2
          id="band-h"
          className="text-xs font-bold uppercase tracking-widest text-muted"
        >
          The band
        </h2>
        <BandSettings
          initial={{
            scheduling: band.scheduling,
            name: band.name,
            appName: band.appName,
            timezone: band.timezone,
            chatUrl: band.chatUrl ?? '',
            tributeTo: band.tributeTo ?? '',
          }}
          iconSrc={iconUrl(band)}
          hasIcon={Boolean(band.iconAt)}
        />
      </section>
      <section aria-labelledby="vote-h" className="mt-8">
        <h2
          id="vote-h"
          className="text-xs font-bold uppercase tracking-widest text-muted"
        >
          Proposals
        </h2>
        <VoteThreshold initial={band.voteThreshold} max={members || 6} />
      </section>
      {user.isOwner && (
        <p className="mt-8 text-sm">
          <Link href="/bands/manage" className="text-sky">
            All bands on this site and their web addresses ›
          </Link>
        </p>
      )}
      <DangerDelete
        what="this band"
        confirmText={band.name}
        confirmLabel="Type the band’s name to confirm"
        endpoint="/api/band"
        explain={`Every song and chart version, setlist, rehearsal and proposal in ${band.name} goes, for everyone, and can’t be brought back. Its people keep their accounts.${HOSTED ? ' A running subscription has to be cancelled first.' : ''}`}
      />
    </main>
  )
}
