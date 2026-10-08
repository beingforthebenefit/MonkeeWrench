import {formatClock, setSummary, timeRange, type OrderEntry} from '@/lib/gig'

type Row = {
  id: string
  kind: 'SONG' | 'SET' | 'BREAK'
  label: string | null
  minutes: number | null
  song: {title: string} | null
}

/**
 * A gig's running order at a glance: each set as a small heading with its
 * times, songs numbered within it, breaks as a quiet line between. Pure
 * markup (server-safe).
 */
export default function RunningOrder<T extends Row>({
  entries,
  song,
}: {
  entries: OrderEntry<T>[]
  /** How a song row reads; defaults to its title */
  song?: (item: T, n: number) => React.ReactNode
}) {
  return (
    <ol className="space-y-1">
      {entries.map((e) => {
        if (e.kind === 'SET')
          return (
            <li
              key={e.item.id}
              className="flex flex-wrap items-baseline gap-x-3 pb-1 pt-3 first:pt-0"
            >
              <span className="text-xs font-bold uppercase tracking-widest text-amber">
                {e.info.label}
              </span>
              <span className="font-mono text-sm">
                {timeRange(e.info.start, e.info.end)}
              </span>
              <span className="text-xs text-faint">{setSummary(e.info)}</span>
            </li>
          )
        if (e.kind === 'BREAK')
          return (
            <li
              key={e.item.id}
              className="my-2 flex items-center gap-3 text-sm text-faint"
            >
              <span className="h-px flex-1 bg-line" />
              Break
              {e.info.minutes ? ` · ${e.info.minutes} min` : ''}
              {e.info.end != null && ` · back ${formatClock(e.info.end)}`}
              <span className="h-px flex-1 bg-line" />
            </li>
          )
        return (
          <li key={e.item.id} className="flex gap-3">
            <span className="w-5 shrink-0 text-right font-mono text-faint">
              {e.n}
            </span>
            {song ? song(e.item, e.n) : e.item.song?.title}
          </li>
        )
      })}
    </ol>
  )
}
