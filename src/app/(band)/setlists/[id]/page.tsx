export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {notFound} from 'next/navigation'
import {getSetlist} from '@/lib/setlists'
import {detectKey, parseChordPro} from '@/lib/chordpro'
import {displayName} from '@/lib/songs'
import {shortDate} from '@/lib/dates'
import SetlistPdfButton from '@/components/SetlistPdfButton'

export const metadata = {title: 'Setlist · Monkee Wrench'}

const gigFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

/** Read-only: the set in order, with keys and notes. Edit and Perform are buttons. */
export default async function SetlistView({params}: {params: {id: string}}) {
  const set = await getSetlist(params.id)
  if (!set) notFound()
  const rows = set.items.map((i) => {
    const v = i.song.chartVersions[0]
    const chart = v ? parseChordPro(v.source) : null
    const original = chart ? detectKey(chart) : null
    return {
      id: i.id,
      songId: i.songId,
      title: i.song.title,
      leadSinger: i.song.leadSinger,
      key: i.key || original,
      changed: Boolean(i.key && original && i.key !== original),
      original,
      hasChart: Boolean(chart?.sections.length),
      note: i.note,
    }
  })
  return (
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
          set.gigDate && gigFmt.format(set.gigDate),
          set.venue,
          `${rows.length} songs`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <p className="mt-0.5 text-[13px] text-faint">
        Edited by {displayName(set.updatedBy)} · {shortDate(set.updatedAt)}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/perform/${set.id}`}
          className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 font-extrabold text-on-accent no-underline"
        >
          ▶ Perform
        </Link>
        <SetlistPdfButton id={set.id} name={set.name} count={rows.length} />
        <Link
          href={`/setlists/${set.id}/edit`}
          className="inline-flex min-h-11 items-center rounded-lg border border-line-2 px-4 no-underline"
        >
          Edit
        </Link>
      </div>

      {set.notes && (
        <p className="mt-5 whitespace-pre-wrap rounded-xl bg-panel px-4 py-3 text-[15px]">
          {set.notes}
        </p>
      )}

      <ol className="mt-5">
        {rows.map((r, n) => (
          <li key={r.id} className="border-t border-line py-3">
            <div className="flex items-baseline gap-3">
              <span className="w-6 shrink-0 font-mono text-sm text-faint">
                {n + 1}
              </span>
              <span className="min-w-0 flex-1">
                <Link
                  href={`/songs/${r.songId}`}
                  className="text-lg font-semibold no-underline hover:underline"
                >
                  {r.title}
                </Link>
                {!r.hasChart && (
                  <span className="ml-2 text-xs font-bold uppercase tracking-wider text-bad">
                    No chart
                  </span>
                )}
              </span>
              {r.key && (
                <span className="shrink-0 text-right font-mono font-bold text-amber">
                  {r.key}
                  {r.changed && (
                    <span className="block text-[11px] font-normal text-faint">
                      orig {r.original}
                    </span>
                  )}
                </span>
              )}
            </div>
            {r.note && (
              <p className="mt-1 pl-9 text-[15px] text-warn-fg">{r.note}</p>
            )}
          </li>
        ))}
      </ol>
      {!rows.length && (
        <p className="py-8 text-muted">
          No songs yet. <Link href={`/setlists/${set.id}/edit`}>Add some</Link>.
        </p>
      )}
    </main>
  )
}
