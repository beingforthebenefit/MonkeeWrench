import type {Chart} from './chordpro'

/**
 * Personal cues: notes, pictures and notation one person pins to a chart.
 * A cue sits at the top of the song (anchor "") or on a section, named by
 * its label and which occurrence it is ("chorus#2"), not by position, so
 * it stays put when someone else edits the chart. If its section goes away
 * it moves to the top, saying where it was.
 */

export type CueKind = 'TEXT' | 'IMAGE' | 'ABC'

export type Cue = {
  id: string
  anchor: string
  position: number
  kind: CueKind
  text: string | null
  /** IMAGE only */
  image: {url: string; width: number; height: number} | null
}

const name = (s: {label: string; type: string}) =>
  (s.label || s.type).trim().toLowerCase()

/** Each section's anchor, in order: "verse 1#1", "chorus#1", "chorus#2"… */
export function sectionAnchors(chart: Chart): string[] {
  const seen = new Map<string, number>()
  return chart.sections.map((s) => {
    const n = (seen.get(name(s)) ?? 0) + 1
    seen.set(name(s), n)
    return `${name(s)}#${n}`
  })
}

/** "chorus#2" → "Chorus 2"; "verse 1#1" → "Verse 1". */
export function anchorLabel(anchor: string, chart?: Chart) {
  if (!anchor) return 'Top of the song'
  const [label, n] = anchor.split('#')
  const nice = label.replace(/^\w/, (c) => c.toUpperCase())
  const repeats = chart
    ? chart.sections.filter((s) => name(s) === label).length > 1
    : n !== '1'
  return repeats ? `${nice} ${n}` : nice
}

type Placeable = {id: string; anchor: string; position: number}

export type PlacedCues<C extends Placeable = Cue> = {
  top: C[]
  /** By section index */
  sections: Map<number, C[]>
  /** Section cues whose section is gone: shown at the top, with where they were */
  lost: C[]
}

export function placeCues<C extends Placeable>(
  chart: Chart,
  cues: C[],
): PlacedCues<C> {
  const anchors = sectionAnchors(chart)
  const index = new Map(anchors.map((a, i) => [a, i]))
  const sorted = [...cues].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id),
  )
  const out: PlacedCues<C> = {top: [], sections: new Map(), lost: []}
  for (const c of sorted) {
    if (!c.anchor) out.top.push(c)
    else if (index.has(c.anchor)) {
      const i = index.get(c.anchor)!
      out.sections.set(i, [...(out.sections.get(i) ?? []), c])
    } else out.lost.push(c)
  }
  return out
}
