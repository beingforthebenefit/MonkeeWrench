'use client'

import {useState} from 'react'
import AbcNotation from '@/components/cues/AbcNotation'

/** Tell a fitted chart (performance mode) that something changed size. */
export function chartResized() {
  window.dispatchEvent(new Event('ms:chart-size'))
}

/**
 * A notation block, folded down to its name until tapped. Notation is for
 * learning a part; on stage the chord chart is what's read, so a folded
 * block keeps the chart glanceable and the music one tap away.
 */
export default function NotationBlock({
  label,
  note,
  abc,
  songKey,
  steps = 0,
  open: startOpen = false,
}: {
  label: string
  note?: string | null
  abc: string
  songKey: string | null
  steps?: number
  /** Start unfolded (the editor's preview) */
  open?: boolean
}) {
  const [open, setOpen] = useState(startOpen)
  return (
    <div className="chart-keep" data-notation={label.toLowerCase()}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open)
          // Before and after the music draws (it loads on first open)
          requestAnimationFrame(chartResized)
        }}
        className="group flex w-full items-baseline gap-[0.6em] rounded-md py-[0.15em] text-left"
      >
        <span
          aria-hidden
          className={`inline-block w-[1em] text-center text-[0.7em] text-sky transition-transform ${open ? 'rotate-90' : ''}`}
        >
          ▶
        </span>
        <span className="text-[0.62em] font-bold uppercase tracking-[0.15em] text-sky">
          {label}
          {note && (
            <span className="ml-2 normal-case tracking-normal text-muted">
              {note}
            </span>
          )}
        </span>
        <span className="ml-auto shrink-0 rounded-full border border-line-2 px-[0.6em] text-[0.6em] font-semibold text-muted group-hover:text-text">
          {open ? 'Hide' : '♪ Show'}
        </span>
      </button>
      {open && (
        <div className="chart-abc mt-[0.3em]">
          <AbcNotation abc={abc} songKey={songKey} steps={steps} />
        </div>
      )}
    </div>
  )
}
