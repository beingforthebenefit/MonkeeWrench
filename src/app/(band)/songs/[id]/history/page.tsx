export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {notFound} from 'next/navigation'
import {prisma} from '@/lib/db'
import {pageSession} from '@/lib/guard'
import {displayName, listVersions} from '@/lib/songs'
import {chartDiff} from '@/lib/chart-diff'
import {parseChordPro} from '@/lib/chordpro'
import {fullDate, shortDate} from '@/lib/dates'
import ChartBody from '@/components/chart/ChartBody'
import RestoreButton from '@/components/RestoreButton'
import Avatar from '@/components/Avatar'
import {avatarUrl} from '@/lib/avatars'

export const metadata = {title: 'History'}

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: {id: string}
  searchParams: {v?: string; view?: string}
}) {
  const {band, isAdmin} = await pageSession()
  const song = await prisma.song.findFirst({
    where: {id: params.id, bandId: band.id},
  })
  if (!song) notFound()
  const versions = await listVersions(song.id, band.id)
  if (!versions.length) notFound()

  const latest = versions[0]
  const selected =
    versions.find((v) => v.number === Number(searchParams.v)) ?? latest
  const previous = versions.find((v) => v.number === selected.number - 1)
  const diff = previous ? chartDiff(previous.source, selected.source) : []
  const showChart = searchParams.view === 'chart' || !previous

  const activity = await prisma.activity.findMany({
    where: {
      targetType: 'song',
      targetId: song.id,
      action: {in: ['song.update']},
    },
    orderBy: {createdAt: 'desc'},
    take: 20,
    include: {user: {select: {name: true, displayName: true, email: true}}},
  })

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-12 pt-4 md:px-7">
      <Link
        href={`/songs/${song.id}`}
        className="text-sm text-muted no-underline hover:text-text"
      >
        ‹ Chart
      </Link>
      <h1 className="mt-1 text-3xl font-extrabold">
        {song.title} <span className="font-medium text-muted">· history</span>
      </h1>

      <div className="mt-5 flex flex-wrap gap-6">
        <nav aria-label="Versions" className="w-full md:w-80 md:shrink-0">
          <ol className="flex flex-col">
            {versions.map((v) => {
              const on = v.number === selected.number
              return (
                <li key={v.id}>
                  <Link
                    href={`?v=${v.number}`}
                    aria-current={on ? 'true' : undefined}
                    className={`flex gap-3 border-l-4 px-4 py-3 no-underline ${on ? 'border-amber bg-panel' : 'border-transparent hover:bg-panel-2'}`}
                  >
                    <Avatar
                      name={displayName(v.author)}
                      src={v.author && avatarUrl(v.author)}
                      size={36}
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span>
                        <strong>{displayName(v.author)}</strong>{' '}
                        <span className="text-muted">
                          · {shortDate(v.createdAt)}
                        </span>
                      </span>
                      {v.note && (
                        <span className="text-sm text-muted">{v.note}</span>
                      )}
                      <span className="font-mono text-xs text-faint">
                        version {v.number}
                        {v.number === latest.number && ' · current'}
                        {v.restoredFrom && ` · restored from ${v.restoredFrom}`}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ol>
          {activity.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 px-4 text-xs font-bold uppercase tracking-widest text-muted">
                Song details changes
              </h2>
              <ul className="px-4 text-sm text-muted">
                {activity.map((a) => (
                  <li key={a.id} className="border-t border-line py-2">
                    <strong className="text-text">{displayName(a.user)}</strong>{' '}
                    {a.summary}
                    <span className="block text-xs text-faint">
                      {fullDate(a.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>

        <section className="min-w-0 flex-[999_1_480px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">
                {previous
                  ? `Version ${selected.number} vs version ${previous.number}`
                  : `Version ${selected.number}`}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {displayName(selected.author)} · {fullDate(selected.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {previous && (
                <Link
                  href={`?v=${selected.number}${showChart ? '' : '&view=chart'}`}
                  className="inline-flex min-h-11 items-center rounded-lg border border-line-2 px-4 no-underline"
                >
                  {showChart ? 'Show changes' : 'Show whole chart'}
                </Link>
              )}
              <a
                href={`/api/songs/${song.id}/pdf?version=${selected.number}&download=1`}
                className="inline-flex min-h-11 items-center rounded-lg border border-line-2 px-4 no-underline"
              >
                PDF of version {selected.number}
              </a>
              {isAdmin && selected.number !== latest.number && (
                <RestoreButton songId={song.id} number={selected.number} />
              )}
            </div>
          </div>

          {selected.note && (
            <blockquote className="mt-4 rounded-lg bg-panel px-4 py-3">
              “{selected.note}”{' '}
              <span className="text-muted">
                — {displayName(selected.author)}
              </span>
            </blockquote>
          )}

          {showChart ? (
            <div className="mt-4 rounded-xl border border-line p-5 text-[17px]">
              <ChartBody chart={parseChordPro(selected.source)} />
            </div>
          ) : diff.length ? (
            <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-panel-2 py-4 font-mono text-[15px]">
              {diff.map((r, i) => (
                <div
                  key={i}
                  className={`flex gap-4 px-5 py-0.5 ${r.kind === 'added' ? 'bg-good-bg text-good-fg' : r.kind === 'removed' ? 'bg-bad-bg text-bad-fg line-through' : ''}`}
                >
                  <span aria-hidden="true" className="w-3 font-bold">
                    {r.kind === 'added' ? '+' : r.kind === 'removed' ? '−' : ''}
                  </span>
                  <span className="sr-only">
                    {r.kind === 'added'
                      ? 'Added: '
                      : r.kind === 'removed'
                        ? 'Removed: '
                        : ''}
                  </span>
                  <span className="whitespace-pre">{r.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-muted">
              No changes to the chart in this version.
            </p>
          )}

          <p className="mt-4 text-[13px] text-faint">
            Every save is kept. Anyone can read the history and download an old
            version; admins can restore one, which is saved as a new version, so
            nothing is lost.
          </p>
        </section>
      </div>
    </main>
  )
}
