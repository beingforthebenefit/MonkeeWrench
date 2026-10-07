export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {redirect} from 'next/navigation'
import {prisma} from '@/lib/db'
import {requireSession} from '@/lib/guard'
import VoteThreshold from '@/components/VoteThreshold'

export const metadata = {title: 'Admin · Monkee Wrench'}

export default async function AdminPage() {
  const {user} = await requireSession()
  if (!user.isAdmin) redirect('/songs')
  const [settings, members, noPassword, songs, versions] = await Promise.all([
    prisma.settings.findUnique({where: {id: 1}}),
    prisma.user.count(),
    prisma.user.count({where: {passwordHash: null}}),
    prisma.song.count(),
    prisma.chartVersion.count(),
  ])
  const cards = [
    {
      href: '/members',
      title: 'Band members',
      body: `${members} members${noPassword ? ` · ${noPassword} without a password yet` : ''}. Add people, send passwords, make admins.`,
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
      <section aria-labelledby="vote-h" className="mt-8">
        <h2
          id="vote-h"
          className="text-xs font-bold uppercase tracking-widest text-muted"
        >
          Proposals
        </h2>
        <VoteThreshold
          initial={settings?.voteThreshold ?? 2}
          max={members || 6}
        />
      </section>
    </main>
  )
}
