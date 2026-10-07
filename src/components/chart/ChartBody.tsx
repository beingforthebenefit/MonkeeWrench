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
}: {
  chart: Chart
  columns?: boolean
  className?: string
}) {
  if (!chart.sections.length) return <p className="text-muted">No chart yet.</p>
  return (
    <div className={`${columns ? 'chart-columns' : ''} ${className}`}>
      {chart.sections.map((s, i) => (
        <ChartSection key={i} section={s} />
      ))}
    </div>
  )
}

function ChartSection({section}: {section: Section}) {
  const label = section.label || (section.type === 'tab' ? '' : section.type)
  return (
    <section className="mb-[1.1em]">
      {(label || section.note) && (
        <h3 className="mb-[0.4em] text-[0.62em] font-bold uppercase tracking-[0.15em] text-sky break-after-avoid">
          {label}
          {section.note && (
            <span className="ml-2 normal-case tracking-normal text-muted">
              {section.note}
            </span>
          )}
        </h3>
      )}
      <div className="flex flex-col gap-[0.35em]">
        {section.lines.map((l, i) => (
          <Line key={i} line={l} />
        ))}
      </div>
    </section>
  )
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
  const groups: Segment[][] = []
  let cur: Segment[] = []
  for (const seg of pieces) {
    const prev = cur[cur.length - 1]
    if (prev && (prev.lyric === '' || /\s$/.test(prev.lyric))) {
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
                <span className="chart-chord">
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
