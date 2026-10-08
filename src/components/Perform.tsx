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
import {TEXT_SIZES} from '@/components/ChartScreen'
import {readOnlyCueSlots} from '@/components/cues/useCueSlots'
import type {Cue} from '@/lib/cues'

export type PerformSong = {
  id: string
  title: string
  leadSinger: string | null
  source: string
  /** Key for this set, when it differs from the chart */
  key: string | null
  note: string | null
  /** Your own cues on this song */
  cues: Cue[]
}

type PerformMode = 'auto' | 'scroll' | 'pages'

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
        const steps = s.key && from ? semitonesBetween(from, s.key) : 0
        const shown = steps ? transposeChart(chart, steps) : chart
        return {
          chart: shown,
          cues: readOnlyCueSlots(shown, s.cues, from, steps),
        }
      }),
    [songs],
  )

  const chartRef = useRef<FittedChartHandle>(null)
  const [page, setPage] = useState({page: 0, pages: 1})
  // Scroll: one tall single column (never several columns, which would mean
  // scrolling back up mid-song). Pages: fitted columns, one screen at a time.
  // Phones default to scroll, tablets and desktops to pages.
  const narrow = useNarrow()
  const [modePref, setModePref] = useStoredState<PerformMode>(
    'mw:perform-mode',
    'auto',
  )
  const scroll = modePref === 'auto' ? narrow : modePref === 'scroll'
  const [sizeIdx] = useStoredState('mw:text-size', 2)
  const scrollSize =
    TEXT_SIZES[Math.min(Math.max(sizeIdx, 0), TEXT_SIZES.length - 1)]

  const toSong = useCallback(
    (d: number) => setIndex(Math.min(Math.max(i + d, 0), songs.length - 1)),
    [i, songs.length, setIndex],
  )

  // Next/previous turns the page within a long song first, then changes song.
  // On phones "a page" is a screenful of scrolling.
  const go = useCallback(
    (d: number) => {
      if (scroll) {
        const el = document.scrollingElement ?? document.documentElement
        const atEnd =
          d > 0
            ? el.scrollTop + window.innerHeight >= el.scrollHeight - 8
            : el.scrollTop <= 8
        if (!atEnd) {
          window.scrollBy({
            top: d * window.innerHeight * 0.8,
            behavior: 'smooth',
          })
          return
        }
      } else if (chartRef.current?.turn(d)) return
      toSong(d)
    },
    [scroll, toSong],
  )

  // A new song starts at its top
  useEffect(() => {
    if (scroll) window.scrollTo({top: 0})
  }, [i, scroll])
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
    // A drag inside something that scrolls sideways (guitar tab) is that
    // thing scrolling, not a swipe to another song
    if ((e.target as Element).closest?.('[data-hscroll]')) {
      touch.current = null
      return
    }
    touch.current = {x: e.touches[0].clientX, y: e.touches[0].clientY}
  }

  // Scroll mode: a tap on the left or right quarter changes song. Read from the
  // click, which browsers don't fire after a scroll or drag, so scrolling
  // anywhere (including sideways through tab) never changes song.
  const onClick = (e: React.MouseEvent) => {
    if (!scroll) return
    if ((e.target as Element).closest('a,button,summary,input,select,textarea'))
      return
    const x = e.clientX / window.innerWidth
    if (x > 0.75) toSong(1)
    else if (x < 0.25) toSong(-1)
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return
    const dx = e.changedTouches[0].clientX - touch.current.x
    const dy = e.changedTouches[0].clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5)
      toSong(dx < 0 ? 1 : -1)
  }

  if (!song)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-stage p-6 text-center">
        <p className="text-xl">This setlist has no songs yet.</p>
        <Link href={`/setlists/${setId}/edit`} className="text-amber">
          Add songs
        </Link>
      </main>
    )

  const {chart, cues} = charts[i]
  const next = songs[i + 1]
  const nextKey = next ? detectKey(charts[i + 1].chart) : null

  return (
    <main
      className={`flex flex-col bg-stage px-4 pb-[max(env(safe-area-inset-bottom),12px)] text-text md:px-8 ${scroll ? 'min-h-dvh' : 'h-dvh overflow-hidden pt-[max(env(safe-area-inset-top),12px)]'}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
    >
      <header
        className={`flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 ${scroll ? 'sticky top-0 z-10 -mx-4 bg-stage/95 px-4 pb-2 pt-[max(env(safe-area-inset-top),12px)] backdrop-blur' : ''}`}
      >
        <span className="font-mono text-muted">
          {i + 1} / {songs.length}
        </span>
        <h1 className="order-last w-full text-2xl font-extrabold leading-tight sm:order-none sm:w-auto sm:min-w-0 sm:flex-1 sm:truncate md:text-[34px]">
          {song.title}
        </h1>
        <span className="flex-1 sm:hidden" />
        <button
          type="button"
          onClick={() => setModePref(scroll ? 'pages' : 'scroll')}
          className="flex min-h-11 items-center rounded-lg border border-line px-3 text-sm text-muted"
          aria-label={scroll ? 'Show as pages' : 'Show as one scrolling page'}
        >
          {scroll ? 'Pages' : 'Scroll'}
        </button>
        {!scroll && page.pages > 1 && (
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
        <p className="mt-2.5 shrink-0 rounded-lg bg-warn-bg px-3.5 py-2 text-[17px] text-warn-fg">
          {/* The set note carries this band's assignments ("Lead: Mark"); the
              song's own lead singer is only a fallback when there is none */}
          {song.note || `Lead (${song.leadSinger})`}
        </p>
      )}

      {scroll ? (
        <div className="mt-4 flex-1 pb-6" style={{fontSize: scrollSize}}>
          <ChartBody
            chart={chart}
            columns={false}
            top={cues.top}
            extra={cues.extra}
          />
        </div>
      ) : (
        <FittedChart
          key={i}
          ref={chartRef}
          chart={chart}
          cues={cues}
          onPage={setPage}
        />
      )}

      <footer
        className={`flex shrink-0 items-center gap-4 border-t border-line pt-3 ${scroll ? 'sticky bottom-0 z-10 -mx-4 bg-stage/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur' : ''}`}
      >
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
              className={`h-1.5 w-[18px] rounded ${n === i ? 'bg-accent' : n < i ? 'bg-line-2' : 'bg-line'}`}
            />
          ))}
        </div>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => toSong(-1)}
          disabled={i === 0}
          className="min-h-11 rounded-lg px-3 text-muted disabled:opacity-30"
          aria-label="Previous song"
        >
          ‹ Prev
        </button>
        {next ? (
          <button
            type="button"
            onClick={() => toSong(1)}
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

      {/* Pages mode: invisible tap zones on the screen edges turn the page
          (scroll mode uses onClick above so the chart can scroll freely) */}
      {!scroll && (
        <>
          <button
            type="button"
            aria-label="Previous song"
            onClick={() => go(-1)}
            className="fixed bottom-16 left-0 top-28 w-1/4 max-w-28 opacity-0 sm:w-[12vw]"
            tabIndex={-1}
          />
          <button
            type="button"
            aria-label="Next song"
            onClick={() => go(1)}
            className="fixed bottom-16 right-0 top-28 w-1/4 max-w-28 opacity-0 sm:w-[12vw]"
            tabIndex={-1}
          />
        </>
      )}
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
    cues: ReturnType<typeof readOnlyCueSlots>
    onPage: (p: {page: number; pages: number}) => void
  }
>(function FittedChart({chart, cues, onPage}, ref) {
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
        columnWidth: '21em',
        columnGap: `${GAP_EM}em`,
        columnFill: 'auto',
      }}
    >
      <ChartBody
        chart={chart}
        columns={false}
        top={cues.top}
        extra={cues.extra}
      />
    </div>
  )
})

/** True on phone-width screens (and while the window is that narrow). */
function useNarrow() {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const update = () => setNarrow(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return narrow
}

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
