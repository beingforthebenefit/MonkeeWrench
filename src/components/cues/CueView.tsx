'use client'

import type {Cue} from '@/lib/cues'
import AbcNotation from '@/components/cues/AbcNotation'

/**
 * One personal cue as it reads on the chart. Sized in em, so it follows the
 * chart's text size (and performance mode's fitting). Only its owner ever
 * sees it.
 */
export default function CueView({
  cue,
  songKey,
  steps = 0,
  where,
}: {
  cue: Cue
  songKey?: string | null
  /** Semitones the chart is shown transposed by (notation follows) */
  steps?: number
  /** For a cue whose section is gone: "was on Chorus 2" */
  where?: string
}) {
  return (
    <div className="chart-cue mb-[0.5em] rounded-r-md border-l-[0.22em] border-amber bg-panel px-[0.6em] py-[0.35em] text-[0.82em]">
      {where && (
        <span className="mb-[0.2em] block text-[0.8em] text-faint">
          {where}
        </span>
      )}
      {cue.kind === 'TEXT' && <p className="whitespace-pre-wrap">{cue.text}</p>}
      {cue.kind === 'IMAGE' && cue.image && (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cue.image.url}
            alt={cue.text ?? 'Your picture'}
            width={cue.image.width}
            height={cue.image.height}
            // Its own aspect ratio, so fitting the chart to the screen can
            // measure it before it has loaded
            style={{aspectRatio: `${cue.image.width} / ${cue.image.height}`}}
            className="h-auto w-full max-w-full rounded bg-white"
          />
          {cue.text && (
            <figcaption className="mt-[0.2em] text-[0.85em] text-muted">
              {cue.text}
            </figcaption>
          )}
        </figure>
      )}
      {cue.kind === 'ABC' && cue.text && (
        <AbcNotation abc={cue.text} songKey={songKey} steps={steps} />
      )}
    </div>
  )
}
