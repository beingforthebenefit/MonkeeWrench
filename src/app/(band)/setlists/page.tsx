export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {prisma} from '@/lib/db'
import {displayName} from '@/lib/songs'
import {shortDate} from '@/lib/dates'
import NewSetlistButton from '@/components/NewSetlistButton'

export const metadata = {title: 'Setlists · Monkee Wrench'}

const gigFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

export default async function SetlistsPage() {
  const sets = await prisma.setlist.findMany({
    orderBy: [{gigDate: {sort: 'asc', nulls: 'last'}}, {updatedAt: 'desc'}],
    include: {
      items: {
        orderBy: {position: 'asc'},
        include: {song: {select: {title: true}}},
      },
      updatedBy: {select: {name: true, email: true}},
    },
  })
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const next = sets.find((s) => s.gigDate && s.gigDate >= today)
  const rest = sets.filter((s) => s !== next)

  return (
    <main className="mx-auto max-w-3xl px-4 pt-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Setlists</h1>
        <NewSetlistButton />
      </div>

      {next && (
        <section
          aria-labelledby="next-h"
          className="mt-5 rounded-2xl border border-amber bg-panel p-5"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-amber">
            Next up
          </p>
          <h2 id="next-h" className="mt-1 text-2xl font-extrabold">
            {next.name}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {[
              next.gigDate && gigFmt.format(next.gigDate),
              next.venue,
              `${next.items.length} songs`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <ol className="mt-3 space-y-1 text-[15px]">
            {next.items.slice(0, 5).map((i, n) => (
              <li key={i.id} className="flex gap-3">
                <span className="w-5 font-mono text-faint">{n + 1}</span>
                {i.song.title}
              </li>
            ))}
            {next.items.length > 5 && (
              <li className="pl-8 text-faint">
                + {next.items.length - 5} more
              </li>
            )}
          </ol>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              href={`/setlists/${next.id}`}
              className="flex min-h-12 items-center justify-center rounded-xl border border-line-2 font-semibold no-underline"
            >
              Edit
            </Link>
            <Link
              href={`/perform/${next.id}`}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber font-extrabold text-ink no-underline"
            >
              <PlayIcon /> Perform
            </Link>
          </div>
        </section>
      )}

      {(rest.length > 0 || !sets.length) && (
        <section aria-labelledby="all-h" className="mt-6">
          <h2
            id="all-h"
            className="mb-2 text-xs font-bold uppercase tracking-widest text-muted"
          >
            {next ? 'Other setlists' : 'All setlists'}
          </h2>
          {!sets.length && (
            <p className="py-8 text-muted">
              No setlists yet. Make one for the next gig, then use Perform on
              stage.
            </p>
          )}
          <ul>
            {rest.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 border-t border-line"
              >
                <Link
                  href={`/setlists/${s.id}`}
                  className="flex min-h-16 flex-1 flex-col justify-center py-2 no-underline"
                >
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-[13px] text-muted">
                    {[
                      `${s.items.length} songs`,
                      s.gigDate && gigFmt.format(s.gigDate),
                      s.venue,
                      `edited by ${displayName(s.updatedBy)} · ${shortDate(s.updatedAt)}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </Link>
                <Link
                  href={`/perform/${s.id}`}
                  aria-label={`Perform ${s.name}`}
                  className="flex min-h-11 items-center gap-1.5 rounded-lg border border-line-2 px-3 text-sm font-semibold no-underline"
                >
                  <PlayIcon /> Perform
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}

function PlayIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M7 4.5v15l13-7.5z" />
    </svg>
  )
}
