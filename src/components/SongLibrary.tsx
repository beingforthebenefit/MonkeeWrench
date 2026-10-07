'use client'

import Link from 'next/link'
import {useMemo, useState} from 'react'
import {isRecent, shortDate} from '@/lib/dates'

export type LibrarySong = {
  id: string
  title: string
  leadSinger: string | null
  writer: string | null
  ready: boolean
  key: string | null
  hasChart: boolean
  editedBy: string | null
  editedAt: string | null
}

type Filter = 'all' | 'ready' | 'needs'

export default function SongLibrary({songs}: {songs: LibrarySong[]}) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return songs.filter((s) => {
      if (filter === 'ready' && !s.ready) return false
      if (filter === 'needs' && s.hasChart) return false
      if (!needle) return true
      return [s.title, s.leadSinger, s.writer].some((v) =>
        v?.toLowerCase().includes(needle),
      )
    })
  }, [songs, q, filter])

  const ready = songs.filter((s) => s.ready).length
  const needs = songs.filter((s) => !s.hasChart).length

  return (
    <main className="mx-auto max-w-4xl px-4 pt-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">The book</h1>
          <p className="mt-1 text-muted">
            {songs.length} songs · {ready} gig-ready
            {needs > 0 && ` · ${needs} need charts`}
          </p>
        </div>
        <Link
          href="/songs/new"
          className="inline-flex min-h-11 items-center rounded-lg border border-line-2 px-4 font-semibold no-underline hover:border-text"
        >
          Add song
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label htmlFor="song-search" className="sr-only">
          Search songs
        </label>
        <input
          id="song-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, singer, writer"
          className="min-h-11 flex-1 basis-60 rounded-lg border border-line-2 bg-panel px-3.5 text-text placeholder:text-faint"
        />
        <div className="flex gap-2" role="group" aria-label="Filter">
          {(
            [
              ['all', 'All'],
              ['ready', 'Gig-ready'],
              ['needs', 'Needs chart'],
            ] as const
          ).map(([f, label]) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`min-h-11 rounded-full px-4 text-sm font-semibold ${filter === f ? 'bg-text text-ink' : 'border border-line-2 text-text'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-3">
        {shown.map((s) => (
          <li key={s.id} className="border-t border-line first:border-t-0">
            <Link
              href={`/songs/${s.id}`}
              className="flex min-h-16 items-center gap-3.5 py-2.5 no-underline"
            >
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.ready ? 'bg-good' : 'border-2 border-muted'}`}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[17px] font-semibold">
                  {s.title}
                  {s.ready && <span className="sr-only"> (gig-ready)</span>}
                </span>
                <span className="truncate text-[13px] text-muted">
                  {[s.leadSinger, s.writer].filter(Boolean).join(' · ')}
                  {s.editedBy && s.editedAt && (
                    <>
                      {' · '}
                      <span
                        className={
                          isRecent(s.editedAt) ? 'text-amber' : undefined
                        }
                      >
                        {s.editedBy} · {shortDate(s.editedAt)}
                      </span>
                    </>
                  )}
                </span>
              </span>
              {s.hasChart ? (
                <span className="w-10 text-center font-mono font-bold text-amber">
                  {s.key ?? ''}
                </span>
              ) : (
                <span className="text-xs font-bold uppercase tracking-wider text-bad">
                  No chart
                </span>
              )}
            </Link>
          </li>
        ))}
        {!shown.length && (
          <li className="py-10 text-center text-muted">No songs match.</li>
        )}
      </ul>
      <p className="mt-4 flex flex-wrap gap-4 border-t border-line py-4 text-[13px] text-faint">
        <span>
          <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-good" />
          Gig-ready
        </span>
        <span>
          <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full border-2 border-muted" />
          Learning
        </span>
        <span>Gold = edited in the last week</span>
      </p>
    </main>
  )
}
