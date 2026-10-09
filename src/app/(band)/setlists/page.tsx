export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {prisma} from '@/lib/db'
import {displayName} from '@/lib/songs'
import {shortDate} from '@/lib/dates'
import NewSetlistButton from '@/components/NewSetlistButton'
import RunningOrder from '@/components/RunningOrder'
import {
  formatClock,
  parseClock,
  runningOrder,
  setSummary,
  timeRange,
} from '@/lib/gig'
import {pageSession} from '@/lib/guard'

export const metadata = {title: 'Setlists'}

const gigFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

export default async function SetlistsPage() {
  const {band} = await pageSession()
  const sets = await loadSets(band.id)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  // Soonest gig first; then setlists without a date; then past gigs, the
  // most recent first
  const upcoming = sets.filter((s) => s.gigDate && s.gigDate >= today)
  const undated = sets.filter((s) => !s.gigDate)
  const past = sets
    .filter((s) => s.gigDate && s.gigDate < today)
    .sort((a, b) => b.gigDate!.getTime() - a.gigDate!.getTime())
  const ordered = [...upcoming, ...undated, ...past]

  return (
    <main className="mx-auto max-w-3xl px-4 pb-10 pt-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Setlists</h1>
        <NewSetlistButton />
      </div>
      {!sets.length && (
        <p className="py-8 text-muted">
          No setlists yet. Make one for the next gig, then use Perform on stage.
        </p>
      )}
      <div className="mt-5 flex flex-col gap-4">
        {ordered.map((set) => (
          <SetlistCard
            key={set.id}
            set={set}
            next={set === upcoming[0]}
            past={past.includes(set)}
          />
        ))}
      </div>
    </main>
  )
}

type CardSet = Awaited<ReturnType<typeof loadSets>>[number]

function loadSets(bandId: string) {
  return prisma.setlist.findMany({
    where: {bandId},
    orderBy: [{gigDate: {sort: 'asc', nulls: 'last'}}, {updatedAt: 'desc'}],
    include: {
      items: {
        orderBy: {position: 'asc'},
        include: {song: {select: {title: true, seconds: true}}},
      },
      updatedBy: {select: {name: true, displayName: true, email: true}},
    },
  })
}

/** One gig: when and where, the shape of the night, and the buttons. */
function SetlistCard({
  set,
  next,
  past,
}: {
  set: CardSet
  next: boolean
  past: boolean
}) {
  const songs = set.items.filter((i) => i.kind === 'SONG').length
  const order = runningOrder(set.startTime, set.items)
  const start = parseClock(set.startTime)
  return (
    <section
      aria-labelledby={`set-${set.id}`}
      className={`rounded-2xl border bg-panel p-5 ${next ? 'border-amber' : 'border-line-2'} ${past ? 'opacity-75' : ''}`}
    >
      <p
        className={`text-xs font-bold uppercase tracking-widest ${next ? 'text-amber' : 'text-muted'}`}
      >
        {next
          ? 'Next up'
          : past
            ? 'Played'
            : set.gigDate
              ? 'Coming up'
              : 'No date'}
      </p>
      <h2 id={`set-${set.id}`} className="mt-1 text-2xl font-extrabold">
        <Link
          href={`/setlists/${set.id}`}
          className="no-underline hover:underline"
        >
          {set.name}
        </Link>
      </h2>
      <p className="mt-1 text-sm text-muted">
        {[
          set.gigDate && gigFmt.format(set.gigDate),
          start != null && formatClock(start, true),
          set.venue,
          `${songs} songs`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {order.divided ? (
        // Divided into sets: the shape of the night, songs on demand
        <>
          <ul className="mt-3 space-y-1 text-[15px]">
            {order.entries.map((e) =>
              e.kind === 'SET' ? (
                <li key={e.item.id} className="flex flex-wrap gap-x-3">
                  <strong>{e.info.label}</strong>
                  <span className="font-mono">
                    {timeRange(e.info.start, e.info.end)}
                  </span>
                  <span className="text-sm text-muted">
                    {setSummary(e.info)}
                  </span>
                </li>
              ) : e.kind === 'BREAK' ? (
                <li key={e.item.id} className="text-sm text-faint">
                  Break{e.info.minutes ? ` · ${e.info.minutes} min` : ''}
                </li>
              ) : null,
            )}
          </ul>
          <details className="group mt-1 text-[15px]">
            <summary className="flex min-h-11 cursor-pointer list-none items-center text-faint group-open:hidden">
              + Show the songs
            </summary>
            <div className="pt-2">
              <RunningOrder entries={order.entries} />
            </div>
          </details>
        </>
      ) : (
        <>
          <ol className="mt-3 space-y-1 text-[15px]">
            {order.entries.slice(0, 5).map((e, n) => (
              <li key={e.item.id} className="flex gap-3">
                <span className="w-5 font-mono text-faint">{n + 1}</span>
                {e.item.song?.title}
              </li>
            ))}
          </ol>
          {set.items.length > 5 && (
            // Expands in place: no need to open the setlist to see it all
            <details className="group mt-1 text-[15px]">
              <summary className="flex min-h-11 cursor-pointer list-none items-center pl-8 text-faint group-open:hidden">
                + {set.items.length - 5} more
              </summary>
              <ol start={6} className="space-y-1">
                {order.entries.slice(5).map((e, n) => (
                  <li key={e.item.id} className="flex gap-3">
                    <span className="w-5 font-mono text-faint">{n + 6}</span>
                    {e.item.song?.title}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </>
      )}
      <p className="mt-2 text-[13px] text-faint">
        Edited by {displayName(set.updatedBy)} · {shortDate(set.updatedAt)}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Link
          href={`/setlists/${set.id}`}
          className="flex min-h-12 items-center justify-center rounded-xl border border-line-2 font-semibold no-underline"
        >
          View
        </Link>
        <Link
          href={`/setlists/${set.id}/edit`}
          className="flex min-h-12 items-center justify-center rounded-xl border border-line-2 font-semibold no-underline"
        >
          Edit
        </Link>
        <Link
          href={`/perform/${set.id}`}
          aria-label={`Perform ${set.name}`}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent font-extrabold text-on-accent no-underline"
        >
          <PlayIcon /> Perform
        </Link>
      </div>
    </section>
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
