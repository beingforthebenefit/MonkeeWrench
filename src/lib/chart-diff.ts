import {diffLines} from 'diff'
import {chartToChordsOverWords, parseChordPro} from './chordpro'

export type DiffRow = {kind: 'same' | 'added' | 'removed'; text: string}

/**
 * Line diff between two chart versions, compared as chords-over-lyrics text
 * (what musicians read) rather than raw ChordPro. Long unchanged stretches are
 * folded to a few lines of context either side of each change.
 */
export function chartDiff(
  before: string,
  after: string,
  context = 2,
): DiffRow[] {
  const a = chartToChordsOverWords(parseChordPro(before))
  const b = chartToChordsOverWords(parseChordPro(after))
  const rows: DiffRow[] = []
  for (const part of diffLines(a ? a + '\n' : '', b ? b + '\n' : '')) {
    const kind = part.added ? 'added' : part.removed ? 'removed' : 'same'
    for (const text of part.value.replace(/\n$/, '').split('\n'))
      rows.push({kind, text})
  }
  if (!rows.some((r) => r.kind !== 'same')) return []
  const keep = rows.map(() => false)
  rows.forEach((r, i) => {
    if (r.kind === 'same') return
    for (
      let j = Math.max(0, i - context);
      j <= Math.min(rows.length - 1, i + context);
      j++
    )
      keep[j] = true
  })
  const out: DiffRow[] = []
  rows.forEach((r, i) => {
    if (keep[i]) out.push(r)
    else if (keep[i - 1] || (i === 0 && !keep[0]))
      out.push({kind: 'same', text: '…'})
  })
  return out
}
