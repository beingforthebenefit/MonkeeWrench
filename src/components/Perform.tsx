'use client'

import Link from 'next/link'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  detectKey,
  parseChordPro,
  semitonesBetween,
  transposeChart,
} from '@/lib/chordpro'
import ChartBody from '@/components/chart/ChartBody'
import {useStoredState} from '@/components/useStoredState'

export type PerformSong = {
  id: string
  title: string
  leadSinger: string | null
  source: string
  /** Key for this set, when it differs from the chart */
  key: string | null
  note: string | null
}

// Below READABLE the song is paged instead of shrunk further
const READABLE = 16
const MAX_FIT = 34

export default function Perform({
  setId,
  name,
  songs,
}: {
  setId: string
  name: string
  songs: PerformSong[]
}) {
  const [index, setIndex] = useStoredState(`mw:perform:${setId}`, 0)
  const i = Math.min(Math.max(index, 0), Math.max(songs.length - 1, 0))
  const song = songs[i]

  const charts = useMemo(
    () =>
      songs.map((s) => {
        const chart = parseChordPro(s.source)
        const from = detectKey(chart)
        return s.key && from
          ? transposeChart(chart, semitonesBetween(from, s.key))
          : chart
      }),
    [songs],
  )

  const chartRef = useRef<FittedChartHandle>(null)
  const [page, setPage] = useState({page: 0, pages: 1})

  // Next/previous turns the page within a long song first, then changes song
  const go = useCallback(
    (d: number) => {
      if (chartRef.current?.turn(d)) return
      setIndex(Math.min(Math.max(i + d, 0), songs.length - 1))
    },
    [i, songs.length, setIndex],
  )
  const jump = (n: number) => setIndex(n)

  // Page-turn pedals and keyboards send arrow / page keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault()
        go(1)
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault()
        go(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  useWakeLock()

  // Swipe left/right
  const touch = useRef<{x: number; y: number} | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = {x: e.touches[0].clientX, y: e.touches[0].clientY}
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return
    const dx = e.changedTouches[0].clientX - touch.current.x
    const dy = e.changedTouches[0].clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5)
      go(dx < 0 ? 1 : -1)
  }

  if (!song)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-stage p-6 text-center">
        <p className="text-xl">This setlist has no songs yet.</p>
        <Link href={`/setlists/${setId}`} className="text-amber">
          Add songs
        </Link>
      </main>
    )

  const chart = charts[i]
  const next = songs[i + 1]
  const nextKey = next ? detectKey(charts[i + 1]) : null

  return (
    <main
      className="flex h-dvh flex-col overflow-hidden bg-stage px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-[max(env(safe-area-inset-top),12px)] text-[#f1eee8] md:px-8"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <header className="flex shrink-0 items-center gap-4">
        <span className="font-mono text-muted">
          {i + 1} / {songs.length}
        </span>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-extrabold md:text-[34px]">
          {song.title}
        </h1>
        {page.pages > 1 && (
          <span className="rounded-full border border-line px-2.5 py-1 font-mono text-sm text-muted">
            page {page.page + 1}/{page.pages}
          </span>
        )}
        <span className="font-mono text-2xl font-bold text-amber md:text-[28px]">
          {detectKey(chart)}
        </span>
        <Link
          href={`/setlists/${setId}`}
          className="flex min-h-11 items-center rounded-lg border border-line px-3.5 text-sm text-muted no-underline"
          aria-label={`Exit ${name}`}
        >
          Exit
        </Link>
      </header>
      {(song.note || song.leadSinger) && (
        <p className="mt-2.5 shrink-0 rounded-lg bg-[#1a1708] px-3.5 py-2 text-[17px] text-[#f2d18a]">
          {[song.leadSinger && `${song.leadSinger} sings`, song.note]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      <FittedChart key={i} ref={chartRef} chart={chart} onPage={setPage} />

      <footer className="flex shrink-0 items-center gap-4 border-t border-[#1c1f23] pt-3">
        <div
          className="hidden gap-1.5 sm:flex"
          aria-label={`Song ${i + 1} of ${songs.length}`}
        >
          {songs.map((s, n) => (
            <button
              key={n}
              type="button"
              aria-label={`Go to ${s.title}`}
              onClick={() => jump(n)}
              className={`h-1.5 w-[18px] rounded ${n === i ? 'bg-amber' : n < i ? 'bg-[#4a4f55]' : 'bg-[#1f2328]'}`}
            />
          ))}
        </div>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={i === 0}
          className="min-h-11 rounded-lg px-3 text-muted disabled:opacity-30"
          aria-label="Previous song"
        >
          ‹ Prev
        </button>
        {next ? (
          <button
            type="button"
            onClick={() => go(1)}
            className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-left"
          >
            <span className="text-muted">Next</span>
            <span className="max-w-[40vw] truncate text-lg font-bold md:text-xl">
              {next.title}
            </span>
            <span className="font-mono text-lg font-bold text-amber">
              {nextKey}
            </span>
          </button>
        ) : (
          <span className="text-muted">End of set</span>
        )}
      </footer>

      {/* Invisible tap zones on the screen edges */}
      <button
        type="button"
        aria-label="Previous song"
        onClick={() => go(-1)}
        className="fixed bottom-16 left-0 top-28 w-[12vw] max-w-28 opacity-0"
        tabIndex={-1}
      />
      <button
        type="button"
        aria-label="Next song"
        onClick={() => go(1)}
        className="fixed bottom-16 right-0 top-28 w-[12vw] max-w-28 opacity-0"
        tabIndex={-1}
      />
    </main>
  )
}

type FittedChartHandle = {
  /** Turn a page within the song; false when already at that end. */
  turn: (d: number) => boolean
}

/**
 * Lays the chart out in columns that fill the screen at the largest text size
 * that fits on one screen. If it only fits below READABLE, it stays at
 * READABLE and is split into screen-wide pages of columns instead.
 */
const FittedChart = forwardRef<
  FittedChartHandle,
  {
    chart: ReturnType<typeof parseChordPro>
    onPage: (p: {page: number; pages: number}) => void
  }
>(function FittedChart({chart, onPage}, ref) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(READABLE)
  const [pages, setPages] = useState(1)
  const [page, setPageState] = useState(0)

  const GAP_EM = 2.5

  const fit = useCallback(() => {
    const el = box.current
    if (!el) return
    const fits = (s: number) => {
      el.style.fontSize = `${s}px`
      return (
        el.scrollWidth <= el.clientWidth + 1 &&
        el.scrollHeight <= el.clientHeight + 1
      )
    }
    let best = READABLE
    if (fits(READABLE)) {
      let lo = READABLE
      let hi = MAX_FIT
      while (hi - lo > 0.5) {
        const mid = (lo + hi) / 2
        if (fits(mid)) lo = mid
        else hi = mid
      }
      best = Math.floor(lo * 2) / 2
    }
    el.style.fontSize = `${best}px`
    const gap = best * GAP_EM
    const n = Math.max(
      1,
      Math.ceil((el.scrollWidth + gap - 1) / (el.clientWidth + gap)),
    )
    el.scrollLeft = 0
    setSize(best)
    setPages(n)
    setPageState(0)
  }, [])

  useLayoutEffect(() => {
    fit()
  }, [fit, chart])
  useEffect(() => {
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [fit])
  useEffect(() => onPage({page, pages}), [page, pages, onPage])

  useImperativeHandle(
    ref,
    () => ({
      turn(d: number) {
        const el = box.current
        const target = page + d
        if (!el || target < 0 || target >= pages) return false
        el.scrollTo({
          left: target * (el.clientWidth + size * GAP_EM),
          behavior: 'instant',
        })
        setPageState(target)
        return true
      },
    }),
    [page, pages, size],
  )

  return (
    <div
      ref={box}
      className="mt-4 min-h-0 flex-1 overflow-hidden"
      style={{
        fontSize: size,
        // Columns fill top-to-bottom, then the next column, like a printed
        // page; overflow continues to the right as further "pages".
        columnWidth: '18em',
        columnGap: `${GAP_EM}em`,
        columnFill: 'auto',
      }}
    >
      <ChartBody chart={chart} columns={false} />
    </div>
  )
})

function useWakeLock() {
  useEffect(() => {
    type Sentinel = {release: () => Promise<void>}
    const nav = navigator as Navigator & {
      wakeLock?: {request: (t: 'screen') => Promise<Sentinel>}
    }
    if (!nav.wakeLock) return
    let lock: Sentinel | null = null
    const acquire = () =>
      nav.wakeLock!.request('screen').then(
        (l) => (lock = l),
        () => {},
      )
    acquire()
    // The lock is dropped whenever the page is hidden; take it back on return
    const onVis = () => document.visibilityState === 'visible' && acquire()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      lock?.release().catch(() => {})
    }
  }, [])
}
