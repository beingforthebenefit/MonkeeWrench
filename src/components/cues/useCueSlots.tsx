'use client'

import {useMemo, useState, type ReactNode} from 'react'
import type {Chart} from '@/lib/chordpro'
import {anchorLabel, placeCues, sectionAnchors, type Cue} from '@/lib/cues'
import CueView from '@/components/cues/CueView'
import CueComposer from '@/components/cues/CueComposer'

/**
 * Your cues on a chart, as the two slots ChartBody takes: before the first
 * section, and under each section's heading. While `editing`, every place
 * gets an "add" button and each cue gets change/remove; otherwise the cues
 * just read as part of the chart.
 */
export function useCueSlots({
  songId,
  chart,
  songKey,
  steps,
  initial,
  editing,
}: {
  songId: string
  chart: Chart
  songKey: string | null
  steps: number
  initial: Cue[]
  editing: boolean
}) {
  const [cues, setCues] = useState(initial)
  // Where the composer is open: an anchor to add at, or a cue id to change
  const [open, setOpen] = useState<{anchor: string; cue?: Cue} | null>(null)
  const anchors = useMemo(() => sectionAnchors(chart), [chart])
  const placed = useMemo(() => placeCues(chart, cues), [chart, cues])

  const saved = (cue: Cue) => {
    setCues((cs) => [...cs.filter((c) => c.id !== cue.id), cue])
    setOpen(null)
  }
  async function remove(cue: Cue) {
    const before = cues
    setCues(cues.filter((c) => c.id !== cue.id))
    const r = await fetch(`/api/cues/${cue.id}`, {method: 'DELETE'})
    if (!r.ok && r.status !== 404) setCues(before)
  }

  const one = (cue: Cue, where?: string) =>
    open?.cue?.id === cue.id ? (
      <CueComposer
        key={cue.id}
        songId={songId}
        anchor={cue.anchor}
        where={anchorLabel(cue.anchor, chart)}
        songKey={songKey}
        steps={steps}
        editing={cue}
        onSaved={saved}
        onCancel={() => setOpen(null)}
      />
    ) : (
      <div key={cue.id}>
        <CueView cue={cue} songKey={songKey} steps={steps} where={where} />
        {editing && (
          <div className="-mt-[0.35em] mb-[0.5em] flex gap-3 text-[0.7em]">
            <button
              type="button"
              onClick={() => setOpen({anchor: cue.anchor, cue})}
              className="text-sky underline"
            >
              {cue.kind === 'IMAGE' ? 'Caption' : 'Change'}
            </button>
            <button
              type="button"
              onClick={() => remove(cue)}
              className="text-bad underline"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    )

  const place = (anchor: string, list: Cue[], extra?: ReactNode) => {
    const adding = open && !open.cue && open.anchor === anchor
    if (!list.length && !editing && !extra) return null
    return (
      <div className="chart-cues">
        {extra}
        {list.map((c) => one(c))}
        {adding ? (
          <CueComposer
            songId={songId}
            anchor={anchor}
            where={anchorLabel(anchor, chart)}
            songKey={songKey}
            steps={steps}
            onSaved={saved}
            onCancel={() => setOpen(null)}
          />
        ) : (
          editing && (
            <button
              type="button"
              onClick={() => setOpen({anchor})}
              className="mb-[0.5em] min-h-9 rounded-md border border-dashed border-amber px-2 text-[0.7em] font-semibold text-amber"
            >
              + Cue {anchor ? 'here' : 'at the top'}
            </button>
          )
        )}
      </div>
    )
  }

  const top = place(
    '',
    placed.top,
    placed.lost.length ? (
      <>{placed.lost.map((c) => one(c, `Was on ${anchorLabel(c.anchor)}`))}</>
    ) : undefined,
  )
  const extra = (i: number) => place(anchors[i], placed.sections.get(i) ?? [])
  return {top, extra, count: cues.length}
}

/** The same slots, read-only (performance mode): nothing to click. */
export function readOnlyCueSlots(
  chart: Chart,
  cues: Cue[],
  songKey: string | null,
  steps: number,
) {
  if (!cues.length) return {top: undefined, extra: undefined}
  const placed = placeCues(chart, cues)
  const view = (c: Cue, where?: string) => (
    <CueView key={c.id} cue={c} songKey={songKey} steps={steps} where={where} />
  )
  const top =
    placed.top.length || placed.lost.length ? (
      <div className="chart-cues">
        {placed.lost.map((c) => view(c, `Was on ${anchorLabel(c.anchor)}`))}
        {placed.top.map((c) => view(c))}
      </div>
    ) : undefined
  const extra = (i: number) => {
    const list = placed.sections.get(i)
    return list?.length ? (
      <div className="chart-cues">{list.map((c) => view(c))}</div>
    ) : null
  }
  return {top, extra}
}
