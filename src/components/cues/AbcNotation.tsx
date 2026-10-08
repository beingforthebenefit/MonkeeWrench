'use client'

import {useEffect, useRef, useState} from 'react'
import {abcTabInstrument, withAbcHeader} from '@/lib/abc'
import {useLickView} from '@/components/cues/useLickView'

/**
 * ABC music notation drawn as a staff, in the text colour (so it follows the
 * theme) and transposed by `steps` semitones along with the chart — notes
 * and chord symbols both. Sized from the surrounding font size, so it grows
 * and shrinks with the chart text.
 */
export default function AbcNotation({
  abc,
  songKey,
  steps = 0,
  onError,
}: {
  abc: string
  /** The chart's original key: notation without a K: line is in it */
  songKey?: string | null
  steps?: number
  /** Parse warnings (for the editor's live preview) */
  onError?: (warnings: string[]) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [failed, setFailed] = useState(false)
  const [view, setView] = useLickView()
  const instrument = abcTabInstrument(abc)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = box.current
    if (!el || !width) return
    let cancelled = false
    // abcjs only runs in the browser; load it on first use
    import('abcjs')
      .then((ABCJS) => {
        if (cancelled || !box.current) return
        const fontPx = parseFloat(getComputedStyle(el).fontSize) || 16
        const scale = Math.min(1.6, Math.max(0.6, fontPx / 17))
        const tunes = ABCJS.renderAbc(el, withAbcHeader(abc, songKey ?? 'C'), {
          visualTranspose: steps,
          foregroundColor: 'currentColor',
          scale,
          staffwidth: Math.max(160, width / scale - 12),
          paddingtop: 0,
          paddingbottom: 0,
          paddingleft: 0,
          paddingright: 0,
          // Tab under the staff: the staff keeps the rhythm, the tab the frets
          ...(view === 'tab'
            ? {
                tablature: [
                  instrument === 'bass'
                    ? {
                        instrument: 'guitar' as const,
                        label: 'Bass',
                        tuning: ['E,', 'A,', 'D', 'G'],
                      }
                    : {instrument: 'guitar' as const, label: 'Guitar'},
                ],
              }
            : {}),
        })
        const warnings = (tunes[0]?.warnings ?? []).map((w) =>
          String(w).replace(/<[^>]+>/g, ''),
        )
        setFailed(!tunes.length)
        onError?.(warnings)
      })
      .catch(() => setFailed(true))
    return () => {
      cancelled = true
    }
  }, [abc, songKey, steps, width, onError, view, instrument])

  return (
    <>
      <div className="flex justify-end">
        <div
          role="group"
          aria-label="Show as"
          className="flex overflow-hidden rounded-md border border-line-2 text-[11px] font-semibold"
        >
          {(['notation', 'tab'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`min-h-7 px-2 ${view === v ? 'bg-text text-ink' : 'text-muted'}`}
            >
              {v === 'notation' ? '♪ Notes' : 'Tab'}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={box}
        className="abc-notation w-full overflow-hidden"
        role="img"
        aria-label="Music notation"
      />
      {failed && (
        <pre className="whitespace-pre-wrap font-mono text-[0.8em] text-muted">
          {abc}
        </pre>
      )}
    </>
  )
}
