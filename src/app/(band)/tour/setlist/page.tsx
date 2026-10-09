import Link from 'next/link'
import DemoBanner from '@/components/tour/DemoBanner'
import {pageSession} from '@/lib/guard'
import {
  formatClock,
  parseClock,
  runningOrder,
  setSummary,
  timeRange,
} from '@/lib/gig'
import {DEMO_SETLIST as set} from '@/lib/tour-demo'

export const metadata = {title: 'Sample setlist'}

const inert = 'pointer-events-none'

/**
 * The tour's setlist: laid out like a real one (setlists/[id]), the same
 * for every band, saved nowhere. Its buttons are for show.
 */
export default async function TourSetlist() {
  await pageSession()
  const order = runningOrder(set.startTime, set.items)
  const songs = order.entries.filter((e) => e.kind === 'SONG').length
  const start = parseClock(set.startTime)
  return (
    <>
      <DemoBanner what="setlist" />
      <main className="mx-auto max-w-3xl px-4 pb-12 pt-4">
        <Link
          href="/setlists"
          className="text-sm text-muted no-underline hover:text-text"
        >
          ‹ Setlists
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold">{set.name}</h1>
        <p className="mt-1 text-muted">
          {[
            set.date,
            start != null && formatClock(start, true),
            set.venue,
            `${songs} songs`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span
            data-tour="perform"
            className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 font-extrabold text-on-accent"
          >
            ▶ Perform
          </span>
          <span
            className={`${inert} inline-flex min-h-11 items-center rounded-lg border border-line-2 px-4`}
          >
            PDF
          </span>
          <span
            className={`${inert} inline-flex min-h-11 items-center rounded-lg border border-line-2 px-4`}
          >
            Save for offline
          </span>
        </div>

        <p className="mt-5 whitespace-pre-wrap rounded-xl bg-panel px-4 py-3 text-[15px]">
          {set.notes}
        </p>

        <ol className="mt-5">
          {order.entries.map((e) => {
            if (e.kind === 'SET')
              return (
                <li
                  key={e.item.id}
                  className="mt-6 flex flex-wrap items-baseline gap-x-3 border-b-2 border-amber pb-1 first:mt-0"
                >
                  <h2 className="text-lg font-extrabold">{e.info.label}</h2>
                  <span className="font-mono">
                    {timeRange(e.info.start, e.info.end)}
                  </span>
                  <span className="text-sm text-muted">
                    {setSummary(e.info)}
                  </span>
                </li>
              )
            if (e.kind === 'BREAK')
              return (
                <li
                  key={e.item.id}
                  className="my-4 flex items-center gap-3 text-sm text-muted"
                >
                  <span className="h-px flex-1 bg-line-2" />
                  Break · {e.info.minutes} min ·{' '}
                  {timeRange(e.info.start, e.info.end)}
                  <span className="h-px flex-1 bg-line-2" />
                </li>
              )
            const i = e.item
            return (
              <li key={i.id} className="border-t border-line py-3">
                <div className="flex items-baseline gap-3">
                  <span className="w-6 shrink-0 font-mono text-sm text-faint">
                    {e.n}
                  </span>
                  <span className="min-w-0 flex-1 text-lg font-semibold">
                    {i.song?.title}
                  </span>
                  <span className="shrink-0 font-mono font-bold text-amber">
                    {i.key}
                  </span>
                </div>
                {i.note && (
                  <p className="mt-1 pl-9 text-[15px] text-warn-fg">{i.note}</p>
                )}
              </li>
            )
          })}
        </ol>
      </main>
    </>
  )
}
