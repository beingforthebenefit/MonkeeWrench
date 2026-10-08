'use client'

import {useEffect, useRef, useState} from 'react'
import {abcPart, abcTabInstrument, withAbcHeader} from '@/lib/abc'
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
  // Scrolls sideways when the music is wider than the column
  const frame = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [failed, setFailed] = useState(false)
  const part = abcPart(abc)
  // Guitar and bass parts open as tab; horn lines and melodies as notation
  const [view, setView] = useLickView(
    part === 'guitar' || part === 'bass' ? 'part' : 'line',
  )
  const instrument = abcTabInstrument(abc)
  const tab = view === 'tab' && instrument !== 'keys'

  useEffect(() => {
    const el = frame.current
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
        el.style.width = ''
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
          // abcjs draws tab under the staff; tabOnly() then removes the staff
          ...(tab
            ? {
                add_classes: true,
                tablature: [
                  instrument === 'bass'
                    ? {
                        // abcjs draws as many lines as the instrument's
                        // own tuning has: violin is its four-string one
                        instrument: 'violin' as const,
                        label: 'Bass',
                        // Written in bass clef, an octave above the sound
                        tuning: ['E,,', 'A,,', 'D,', 'G,'],
                      }
                    : {instrument: 'guitar' as const, label: 'Guitar'},
                ],
              }
            : {}),
        })
        const warnings = (tunes[0]?.warnings ?? []).map((w) =>
          String(w).replace(/<[^>]+>/g, ''),
        )
        if (tab) tabOnly(el, scale)
        // abcjs squeezes music into the width it's given only so far; past
        // that the drawing runs wider (and is scaled by a CSS transform,
        // which takes no room), so size the box to it and let the frame
        // scroll
        const drawn = el.querySelector('svg')?.getBoundingClientRect().width
        if (drawn && drawn > width + 1) el.style.width = `${Math.ceil(drawn)}px`
        setFailed(!tunes.length)
        onError?.(warnings)
        // Performance mode re-counts its pages around the new height
        window.dispatchEvent(new Event('ms:chart-size'))
      })
      .catch(() => setFailed(true))
    return () => {
      cancelled = true
    }
  }, [abc, songKey, steps, width, onError, tab, instrument])

  return (
    <>
      {instrument !== 'keys' && (
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
      )}
      <div
        ref={frame}
        // A sideways drag here scrolls the music, not to another song
        data-hscroll=""
        className="w-full overflow-x-auto overscroll-x-contain"
      >
        <div
          ref={box}
          className="abc-notation min-w-full overflow-hidden"
          role="img"
          aria-label="Music notation"
        />
      </div>
      {failed && (
        <pre className="whitespace-pre-wrap font-mono text-[0.8em] text-muted">
          {abc}
        </pre>
      )}
    </>
  )
}

/** What abcjs draws for tablature (everything else in a line is the staff). */
function isTab(e: Element) {
  const cls = (e.getAttribute('class') ?? '').split(' ')
  return (
    cls.includes('abcjs-tabNumber') ||
    cls.includes('abcjs-symbol') || // the TAB "clef"
    cls.includes('abcjs-instrument-name') ||
    (cls.includes('abcjs-staff') && cls.includes('abcjs-v1')) ||
    // A tab bar line carries the class twice
    cls.filter((c) => c === 'abcjs-bar').length > 1
  )
}

/**
 * abcjs has no tab-only mode: hide the staff in each line, clip off the bar
 * lines that still reach up to it, stack the lines' tabs without the gaps
 * the staves left, and shrink the drawing to fit.
 */
function tabOnly(el: HTMLElement, scale: number) {
  const svg = el.querySelector('svg')
  if (!svg) return
  const NS = 'http://www.w3.org/2000/svg'
  const defs =
    svg.querySelector('defs') ??
    svg.appendChild(document.createElementNS(NS, 'defs'))
  const lines = Array.from(
    svg.querySelectorAll(':scope > g.abcjs-staff-wrapper'),
  )
  let y = 0
  lines.forEach((line, i) => {
    let top = Infinity
    let bottom = -Infinity
    for (const part of Array.from(line.children)) {
      if (!isTab(part)) {
        ;(part as SVGElement).style.display = 'none'
        continue
      }
      // Bars run up into the staff: they don't decide the tab's height
      if ((part.getAttribute('class') ?? '').includes('abcjs-bar')) continue
      const b = (part as SVGGraphicsElement).getBBox()
      if (!b.height) continue
      top = Math.min(top, b.y)
      bottom = Math.max(bottom, b.y + b.height)
    }
    if (top === Infinity) return
    const clip = document.createElementNS(NS, 'clipPath')
    clip.id = `tab-${Math.random().toString(36).slice(2)}-${i}`
    const rect = document.createElementNS(NS, 'rect')
    rect.setAttribute('x', '-10000')
    rect.setAttribute('width', '20000')
    rect.setAttribute('y', String(top))
    rect.setAttribute('height', String(bottom - top))
    clip.appendChild(rect)
    defs.appendChild(clip)
    line.setAttribute('clip-path', `url(#${clip.id})`)
    line.setAttribute('transform', `translate(0 ${y - top})`)
    y += bottom - top + 8
  })
  if (!y) return
  // abcjs scales the drawing with a CSS transform and sizes its box to
  // match, so both shrink
  const height = y - 8
  svg.setAttribute('height', String(height))
  el.style.height = `${height * scale}px`
}
