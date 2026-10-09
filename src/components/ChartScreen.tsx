'use client'

import Link from 'next/link'
import {useMemo, useState} from 'react'
import {detectKey, parseChordPro, transposeChart} from '@/lib/chordpro'
import {shortDate} from '@/lib/dates'
import {formatLength} from '@/lib/gig'
import ChartBody from '@/components/chart/ChartBody'
import ChordPopover from '@/components/chart/ChordPopover'
import PdfDialog from '@/components/PdfDialog'
import {useStoredState} from '@/components/useStoredState'
import {useCueSlots} from '@/components/cues/useCueSlots'
import type {Cue} from '@/lib/cues'

export type ChartSong = {
  id: string
  title: string
  writer: string | null
  leadSinger: string | null
  guitars: number | null
  seconds: number | null
  keys: string | null
  percussion: string | null
  youtubeUrl: string | null
  lyricsUrl: string | null
  notes: string | null
  ready: boolean
}

export const TEXT_SIZES = [14, 16, 18, 21, 24, 28]

export default function ChartScreen({
  song,
  source,
  version,
  versions,
  editedBy,
  editedAt,
  imported = false,
  cues = [],
}: {
  song: ChartSong
  source: string
  version: number
  versions: number
  editedBy: string | null
  editedAt: string | null
  imported?: boolean
  /** Your own cues on this song */
  cues?: Cue[]
}) {
  const [steps, setSteps] = useStoredState(`mw:transpose:${song.id}`, 0)
  const [sizeIdx, setSizeIdx] = useStoredState('mw:text-size', 2)
  const [pdfOpen, setPdfOpen] = useState(false)

  const original = useMemo(() => parseChordPro(source), [source])
  const chart = useMemo(
    () => transposeChart(original, steps),
    [original, steps],
  )
  const originalKey = detectKey(original)
  const key = detectKey(chart)
  const size = TEXT_SIZES[Math.min(Math.max(sizeIdx, 0), TEXT_SIZES.length - 1)]
  const [cueMode, setCueMode] = useState(false)
  const slots = useCueSlots({
    songId: song.id,
    chart,
    songKey: originalKey,
    steps,
    initial: cues,
    editing: cueMode,
  })

  const details = [
    song.writer,
    song.leadSinger && `Lead ${song.leadSinger}`,
    [song.keys, song.percussion].filter(Boolean).join(' · '),
    song.guitars != null &&
      `${song.guitars} guitar${song.guitars === 1 ? '' : 's'}`,
    song.seconds && formatLength(song.seconds),
  ].filter(Boolean)

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-10 pt-4 md:px-7">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-72">
          <Link
            href="/songs"
            className="text-sm text-muted no-underline hover:text-text"
          >
            ‹ All songs
          </Link>
          <h1 className="mt-1 text-3xl font-extrabold leading-tight md:text-4xl">
            {song.title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Key"
            className="flex items-center rounded-lg border border-line-2"
          >
            <button
              type="button"
              aria-label="Transpose down a semitone"
              onClick={() => setSteps(steps - 1)}
              className="h-11 w-11 text-xl"
            >
              −
            </button>
            <span className="min-w-12 text-center font-mono text-lg font-bold text-amber">
              {key ?? '—'}
            </span>
            <button
              type="button"
              aria-label="Transpose up a semitone"
              onClick={() => setSteps(steps + 1)}
              className="h-11 w-11 text-xl"
            >
              +
            </button>
          </div>
          {steps % 12 !== 0 && (
            <button
              type="button"
              onClick={() => setSteps(0)}
              className="min-h-11 rounded-lg px-3 text-sm text-muted underline"
            >
              Back to {originalKey}
            </button>
          )}
          <div
            role="group"
            aria-label="Text size"
            className="flex items-center rounded-lg border border-line-2"
          >
            <button
              type="button"
              aria-label="Smaller text"
              onClick={() => setSizeIdx(Math.max(0, sizeIdx - 1))}
              className="h-11 w-11 text-sm font-semibold"
            >
              A
            </button>
            <button
              type="button"
              aria-label="Larger text"
              onClick={() =>
                setSizeIdx(Math.min(TEXT_SIZES.length - 1, sizeIdx + 1))
              }
              className="h-11 w-11 text-xl font-semibold"
            >
              A
            </button>
          </div>
          <button
            type="button"
            aria-pressed={cueMode}
            onClick={() => setCueMode(!cueMode)}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-4 ${cueMode ? 'bg-accent font-bold text-on-accent' : 'border border-line-2'}`}
          >
            {cueMode ? 'Done' : 'My cues'}
            {!cueMode && slots.count > 0 && (
              <span className="font-mono text-sm text-amber">
                {slots.count}
              </span>
            )}
          </button>
          <Link
            href={`/songs/${song.id}/edit`}
            className="inline-flex min-h-11 items-center rounded-lg border border-line-2 px-4 no-underline"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={() => setPdfOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 font-bold text-on-accent"
          >
            <DownloadIcon /> PDF
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line pb-3 text-sm text-muted">
        {details.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
        {song.youtubeUrl && (
          <a
            href={song.youtubeUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sky"
          >
            Recording ↗
          </a>
        )}
        <span className="flex-1" />
        {editedBy && editedAt && (
          <span>
            {imported ? (
              <>Imported · {shortDate(editedAt)}</>
            ) : (
              <>
                Edited by <strong className="text-text">{editedBy}</strong> ·{' '}
                {shortDate(editedAt)}
              </>
            )}
          </span>
        )}
        <Link
          href={`/songs/${song.id}/history`}
          className="inline-flex min-h-8 items-center rounded-full border border-line-2 px-3 text-text no-underline"
        >
          History · {versions} version{versions === 1 ? '' : 's'}
        </Link>
      </div>

      {song.notes && (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-panel px-4 py-3 text-[15px]">
          {song.notes}
        </p>
      )}

      {cueMode && (
        <p className="mt-3 rounded-lg border border-amber/60 px-4 py-2 text-sm text-muted">
          Your cues — notes, pictures of a few bars, or notation — sit on the
          chart where you put them. Only you see them; the chart itself doesn’t
          change.
        </p>
      )}
      <div className="mt-5" style={{fontSize: size}}>
        <ChartBody chart={chart} top={slots.top} extra={slots.extra} />
        <ChordPopover />
      </div>

      {pdfOpen && (
        <PdfDialog
          title={song.title}
          onClose={() => setPdfOpen(false)}
          baseUrl={`/api/songs/${song.id}/pdf`}
          shownKey={steps % 12 !== 0 ? key : null}
          originalKey={originalKey}
          hasCues={slots.count > 0}
          footnote={`Every page says version ${version}${editedBy ? `, edited by ${editedBy}` : ''}, so an old printout is easy to spot.`}
        />
      )}
    </main>
  )
}

export function DownloadIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 4v11" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  )
}
