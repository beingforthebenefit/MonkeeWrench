export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {prisma} from '@/lib/db'
import {displayName} from '@/lib/songs'

export const metadata = {title: 'Recent changes · Monkee Wrench'}

const dayFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'America/Los_Angeles',
})
const timeFmt = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Los_Angeles',
})

function hrefFor(a: {
  targetType: string
  targetId: string | null
  action: string
}) {
  if (!a.targetId) return null
  if (a.targetType === 'song')
    return a.action.startsWith('chart.')
      ? `/songs/${a.targetId}/history`
      : `/songs/${a.targetId}`
  if (a.targetType === 'setlist' && a.action !== 'setlist.delete')
    return `/setlists/${a.targetId}`
  if (a.targetType === 'rehearsal' || a.targetType === 'availability')
    return '/rehearsals'
  return null
}

/** Who changed what, newest first — every save in the app lands here. */
export default async function ActivityPage() {
  const rows = await prisma.activity.findMany({
    orderBy: {createdAt: 'desc'},
    take: 200,
    include: {user: {select: {name: true, displayName: true, email: true}}},
  })
  const groups: {day: string; rows: typeof rows}[] = []
  for (const r of rows) {
    const day = dayFmt.format(r.createdAt)
    if (groups[groups.length - 1]?.day !== day) groups.push({day, rows: []})
    groups[groups.length - 1].rows.push(r)
  }
  return (
    <main className="mx-auto max-w-3xl px-4 pb-10 pt-5">
      <h1 className="text-3xl font-extrabold">Recent changes</h1>
      <p className="mt-1 text-muted">
        Everything anyone has changed, newest first.
      </p>
      {!rows.length && <p className="py-8 text-muted">Nothing yet.</p>}
      {groups.map((g) => (
        <section key={g.day} className="mt-6">
          <h2 className="mb-1 text-xs font-bold uppercase tracking-widest text-muted">
            {g.day}
          </h2>
          <ul>
            {g.rows.map((r) => {
              const href = hrefFor(r)
              const body = (
                <>
                  <span className="w-16 shrink-0 font-mono text-xs text-faint">
                    {timeFmt.format(r.createdAt)}
                  </span>
                  <span>
                    <strong>{displayName(r.user)}</strong> {r.summary}
                  </span>
                </>
              )
              return (
                <li key={r.id} className="border-t border-line">
                  {href ? (
                    <Link
                      href={href}
                      className="flex min-h-12 items-baseline gap-3 py-2.5 no-underline hover:bg-panel-2"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex min-h-12 items-baseline gap-3 py-2.5">
                      {body}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </main>
  )
}
