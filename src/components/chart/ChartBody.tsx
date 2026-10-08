import type {ReactNode} from 'react'
import {detectKey, isChord, transposeKey} from '@/lib/chordpro'
import AbcNotation from '@/components/cues/AbcNotation'
import type {Chart, ChartLine, Section, Segment} from '@/lib/chordpro'

/**
 * Renders a parsed chart: chords above lyrics, every section written out in
 * full. Pure markup (no hooks) so it works in server components, the editor
 * preview and performance mode alike. Size it by setting font-size on a parent.
 */
export default function ChartBody({
  chart,
  columns = true,
  className = '',
  top,
  extra,
}: {
  chart: Chart
  columns?: boolean
  className?: string
  /** Shown before the first section, flowing with the chart (personal cues) */
  top?: ReactNode
  /** Shown under a section's heading, by section index (personal cues) */
  extra?: (index: number) => ReactNode
}) {
  if (!chart.sections.length)
    return (
      <>
        {top}
        <p className="text-muted">No chart yet.</p>
      </>
    )
  return (
    <div className={`${columns ? 'chart-columns' : ''} ${className}`}>
      {top}
      {chart.sections.map((s, i) => (
        <ChartSection
          key={i}
          section={s}
          extra={extra?.(i)}
          songKey={s.abc ? originalKey(chart, s.abcSteps ?? 0) : null}
        />
      ))}
    </div>
  )
}

/** The key the chart was written in, before transposing by `steps`. */
function originalKey(chart: Chart, steps: number) {
  const key = detectKey(chart)
  return key && steps ? transposeKey(key, -steps) : key
}

function ChartSection({
  section,
  extra,
  songKey,
}: {
  section: Section
  extra?: ReactNode
  /** The chart's original key, for notation without a K: line */
  songKey: string | null
}) {
  const label =
    section.label ||
    (section.type === 'tab' || section.type === 'abc' ? '' : section.type)
  const notation = section.abc ? (
    <div className="chart-abc">
      <AbcNotation
        abc={section.abc}
        songKey={songKey}
        steps={section.abcSteps ?? 0}
      />
    </div>
  ) : null
  const blocks = runs(section.lines).map((run, i) =>
    run[0].kind === 'tab' ? (
      // One scroll area per tab block, so the strings move together
      <div key={i} className="chart-tab-block" data-hscroll="">
        {run.map((l, j) => (
          <div key={j} className="chart-tab">
            {l.kind === 'tab' ? l.text : ''}
          </div>
        ))}
      </div>
    ) : (
      run.map((l, j) => <Line key={`${i}-${j}`} line={l} />)
    ),
  )
  const heading = (label || section.note) && (
    <h3 className="mb-[0.4em] text-[0.62em] font-bold uppercase tracking-[0.15em] text-sky">
      {label}
      {section.note && (
        <span className="ml-2 normal-case tracking-normal text-muted">
          {section.note}
        </span>
      )}
    </h3>
  )
  // The heading and the section's first line are one unbreakable block, so
  // a column or page never ends on a bare "Chorus". (break-after: avoid on
  // the heading alone is ignored by Safari in multi-column layout.)
  return (
    <section className="mb-[1.1em]">
      {heading && (
        <div className="chart-keep">
          {heading}
          {extra}
          {notation ?? blocks[0]}
        </div>
      )}
      {!heading && extra}
      {!heading && notation}
      {blocks.length > (heading ? 1 : 0) && (
        <div
          className={`flex flex-col gap-[0.35em] ${heading ? 'mt-[0.35em]' : ''}`}
        >
          {heading ? blocks.slice(1) : blocks}
        </div>
      )}
    </section>
  )
}

/** Consecutive tab lines form one block; every other line stands alone. */
function runs(lines: ChartLine[]): ChartLine[][] {
  const out: ChartLine[][] = []
  for (const l of lines) {
    const last = out[out.length - 1]
    if (l.kind === 'tab' && last?.[0].kind === 'tab') last.push(l)
    else out.push([l])
  }
  return out
}

/**
 * Group segments into words so a line only ever wraps between words. A
 * segment's lyric is first split at its spaces ("A home" → "A ", "home"), the
 * chord staying with the first piece; pieces are then joined across chord
 * boundaries until a piece ends in a space.
 */
export function words(segments: Segment[]): Segment[][] {
  const pieces: Segment[] = []
  for (const seg of segments) {
    const parts = seg.lyric.split(/(?<=\s)(?=\S)/)
    parts.forEach((lyric, i) =>
      pieces.push({chord: i === 0 ? seg.chord : null, lyric}),
    )
  }
  // Chords after the last word (a turnaround) stay with that word, so a
  // wrapped line never leaves a chord alone on a row with no lyric under it
  let lastWord = -1
  pieces.forEach((p, i) => p.lyric.trim() && (lastWord = i))
  const groups: Segment[][] = []
  let cur: Segment[] = []
  for (const [i, seg] of pieces.entries()) {
    const prev = cur[cur.length - 1]
    const trailing = lastWord >= 0 && i > lastWord
    if (prev && !trailing && (prev.lyric === '' || /\s$/.test(prev.lyric))) {
      groups.push(cur)
      cur = []
    }
    cur.push(seg)
  }
  if (cur.length) groups.push(cur)
  return groups
}

function Line({line}: {line: ChartLine}) {
  if (line.kind === 'tab') return <div className="chart-tab">{line.text}</div>
  if (line.kind === 'comment')
    return <div className="italic text-muted">{line.text}</div>
  const hasChords = line.segments.some((s) => s.chord)
  const hasWords = line.segments.some((s) => s.lyric.trim())
  return (
    <div className="chart-line">
      {words(line.segments).map((group, g) => (
        <span key={g} className="chart-word">
          {group.map((seg, i) => (
            <span key={i} className="chart-seg">
              {hasChords && (
                <span
                  className={`chart-chord${seg.chord && !isChord(seg.chord) ? ' chart-note' : ''}`}
                >
                  {seg.chord ?? ''}
                  {!hasWords && seg.chord ? ' ' : ''}
                </span>
              )}
              {hasWords && <span className="chart-lyric">{seg.lyric}</span>}
            </span>
          ))}
        </span>
      ))}
    </div>
  )
}
