'use client'

import {useCallback, useEffect, useRef, useState} from 'react'
import {
  chordInfo,
  guitarPositions,
  type ChordInfo,
  type GuitarPosition,
} from '@/lib/chordtones'

/**
 * The chord under your finger (or mouse), spelled out: its notes on a
 * keyboard and how to grip it on guitar. Mounted once per chart page; it
 * listens for taps and hovers on any chord in the chart.
 */
export default function ChordPopover() {
  const [shown, setShown] = useState<{
    info: ChordInfo
    rect: DOMRect
  } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>()

  const chordAt = (target: EventTarget | null) => {
    const el = (target as Element | null)?.closest?.('.chart-chord')
    if (!el || el.classList.contains('chart-note')) return null
    const info = chordInfo(el.textContent ?? '')
    return info ? {info, rect: el.getBoundingClientRect()} : null
  }

  const hide = useCallback(() => setShown(null), [])

  useEffect(() => {
    // Tap (or click) a chord: show it; tap anything else: put it away
    const onClick = (e: MouseEvent) => {
      if (box.current?.contains(e.target as Node)) return
      const hit = chordAt(e.target)
      setShown((cur) =>
        hit &&
        !(
          cur &&
          cur.info.name === hit.info.name &&
          cur.rect.top === hit.rect.top
        )
          ? hit
          : null,
      )
    }
    // A mouse resting on a chord shows it; moving off hides it
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      clearTimeout(hoverTimer.current)
      const hit = chordAt(e.target)
      if (hit) hoverTimer.current = setTimeout(() => setShown(hit), 250)
      else if (!box.current?.contains(e.target as Node))
        hoverTimer.current = setTimeout(hide, 300)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide()
    document.addEventListener('click', onClick)
    document.addEventListener('pointerover', onOver)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
      clearTimeout(hoverTimer.current)
    }
  }, [hide])

  if (!shown) return null
  const {info, rect} = shown
  // Below the chord, or above it near the bottom of the screen
  const width = 232
  const left = Math.min(
    Math.max(8, rect.left + rect.width / 2 - width / 2),
    window.innerWidth - width - 8,
  )
  const below = rect.bottom + 230 < window.innerHeight
  return (
    <div
      ref={box}
      role="dialog"
      aria-label={`${info.name} chord`}
      className="fixed z-50 rounded-xl border border-line-2 bg-panel p-3 text-text shadow-xl"
      style={{
        width,
        left,
        ...(below
          ? {top: rect.bottom + 6}
          : {bottom: window.innerHeight - rect.top + 6}),
      }}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-lg font-bold text-amber">
          {info.name}
        </span>
        <span className="text-xs text-muted">
          {info.notes.join(' · ')}
          {info.bassName ? ` / ${info.bassName}` : ''}
        </span>
      </div>
      <Keyboard info={info} />
      <Guitar info={info} />
    </div>
  )
}

/** Two octaves from the C below the root, the chord's notes lit. */
function Keyboard({info}: {info: ChordInfo}) {
  // Each note at its place above the root, so the shape reads as played
  const lit = new Set<number>()
  let prev = info.root
  info.tones.forEach((t, i) => {
    let n = i === 0 ? info.root : t
    while (n <= prev && i > 0) n += 12
    if (n < 24) lit.add(n)
    prev = n
  })
  const bass = info.bass
  const whites = [0, 2, 4, 5, 7, 9, 11]
  const blacks = [1, 3, 6, 8, 10]
  const W = 15
  const keys = [0, 1].flatMap((o) => whites.map((w) => w + o * 12))
  return (
    <svg
      viewBox={`0 0 ${W * 14} 56`}
      className="mt-2 w-full"
      aria-label={`Keyboard: ${info.notes.join(', ')}`}
    >
      {keys.map((k, i) => (
        <rect
          key={k}
          x={i * W}
          y={0}
          width={W - 1}
          height={54}
          rx={2}
          className={lit.has(k) ? 'fill-amber' : 'fill-white'}
          stroke="currentColor"
          strokeOpacity={0.35}
        />
      ))}
      {[0, 1].flatMap((o) =>
        blacks.map((b) => {
          const k = b + o * 12
          const x = (whites.filter((w) => w < b).length + o * 7) * W - 5
          return (
            <rect
              key={k}
              x={x}
              y={0}
              width={10}
              height={33}
              rx={1.5}
              className={lit.has(k) ? 'fill-amber' : 'fill-zinc-800'}
              stroke="currentColor"
              strokeOpacity={0.35}
            />
          )
        }),
      )}
      {bass !== null && (
        <text x={2} y={52} className="fill-sky text-[8px] font-bold">
          bass {info.bassName}
        </text>
      )}
    </svg>
  )
}

/** A chord box: strings down, frets across, dots where fingers go. */
function Guitar({info}: {info: ChordInfo}) {
  const [positions, setPositions] = useState<GuitarPosition[] | null>(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    let live = true
    setN(0)
    guitarPositions(info)
      .then((p) => live && setPositions(p))
      .catch(() => live && setPositions([]))
    return () => {
      live = false
    }
  }, [info])
  if (!positions) return <p className="mt-2 text-xs text-muted">Guitar…</p>
  if (!positions.length) return null
  const p = positions[n]
  const sx = (s: number) => 16 + s * 18
  const fy = (f: number) => 18 + f * 20
  return (
    <div className="mt-2 flex items-center gap-1">
      <button
        type="button"
        aria-label="Easier fingering"
        disabled={n === 0}
        onClick={() => setN(n - 1)}
        className="min-h-9 min-w-7 rounded text-muted disabled:opacity-20"
      >
        ‹
      </button>
      <svg
        viewBox="0 0 122 122"
        className="h-28 flex-1"
        aria-label="Guitar fingering"
      >
        {/* the nut, or the fret the shape starts on */}
        {p.baseFret === 1 ? (
          <rect
            x={sx(0)}
            y={16}
            width={90}
            height={3}
            className="fill-current"
          />
        ) : (
          <text x={2} y={fy(0) + 15} className="fill-muted text-[10px]">
            {p.baseFret}
          </text>
        )}
        {[0, 1, 2, 3, 4].map((f) => (
          <line
            key={f}
            x1={sx(0)}
            x2={sx(5)}
            y1={fy(f)}
            y2={fy(f)}
            stroke="currentColor"
            strokeOpacity={0.4}
          />
        ))}
        {[0, 1, 2, 3, 4, 5].map((s) => (
          <line
            key={s}
            x1={sx(s)}
            x2={sx(s)}
            y1={fy(0)}
            y2={fy(4)}
            stroke="currentColor"
            strokeOpacity={0.6}
          />
        ))}
        {p.barres.map((b) => {
          const strings = p.frets
            .map((f, s) => (f === b ? s : -1))
            .filter((s) => s >= 0)
          return (
            <rect
              key={b}
              x={sx(strings[0]) - 6}
              y={fy(b) - 16}
              width={sx(strings[strings.length - 1]) - sx(strings[0]) + 12}
              height={12}
              rx={6}
              className="fill-amber"
            />
          )
        })}
        {p.frets.map((f, s) =>
          f < 0 ? (
            <text
              key={s}
              x={sx(s)}
              y={11}
              textAnchor="middle"
              className="fill-muted text-[10px]"
            >
              ×
            </text>
          ) : f === 0 ? (
            <circle
              key={s}
              cx={sx(s)}
              cy={7}
              r={4}
              fill="none"
              stroke="currentColor"
            />
          ) : p.barres.includes(f) ? null : (
            <circle
              key={s}
              cx={sx(s)}
              cy={fy(f) - 10}
              r={6}
              className="fill-amber"
            />
          ),
        )}
      </svg>
      <button
        type="button"
        aria-label="Another fingering"
        disabled={n >= positions.length - 1}
        onClick={() => setN(n + 1)}
        className="min-h-9 min-w-7 rounded text-muted disabled:opacity-20"
      >
        ›
      </button>
    </div>
  )
}
