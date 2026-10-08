/**
 * Charts written by hand often give the chords for the first verse only
 * and leave the later verses bare ("same as verse 1"). This puts them back:
 *
 * - a line sung again word for word gets the chords it had the first time;
 * - a bare stanza that parallels an earlier charted one (same number of
 *   lines, each about as long) gets that stanza's chords, word for word.
 *
 * Only lines with no chords are touched. Returns what it filled, so a
 * person can check it.
 */

const CHORD = /\[([^\]]+)\]/g
const hasChord = (l: string) => /\[[^\]]+\]/.test(l)
const plain = (l: string) => l.replace(CHORD, '')
const isLyric = (l: string) => !/^\s*\{/.test(l) && /[A-Za-z]/.test(plain(l))
const key = (l: string) =>
  plain(l)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

type Placed = {word: number; chord: string}

/** A charted line's chords by the word they sit on (Infinity: after it). */
function chordsByWord(line: string): Placed[] {
  const out: Placed[] = []
  let text = ''
  let m: RegExpExecArray | null
  let at = 0
  const re = new RegExp(CHORD.source, 'g')
  while ((m = re.exec(line))) {
    text += line.slice(at, m.index)
    at = m.index + m[0].length
    const rest = plain(line.slice(at))
    // Words that start before this point
    const before = (text.match(/\S+/g) ?? []).length
    const midWord = /\S$/.test(text) && /^\S/.test(rest)
    const word = midWord ? before - 1 : before
    out.push({
      word: /\S/.test(rest) ? word : Infinity,
      chord: m[1],
    })
  }
  return out
}

/** Put chords onto a bare line, word for word. */
function apply(line: string, placed: Placed[]) {
  const words = [...line.matchAll(/\S+/g)]
  let out = line
  // Right to left, so earlier positions don't move
  const at = placed.map((p) => ({
    pos:
      p.word === Infinity || p.word >= words.length ? -1 : words[p.word].index!,
    chord: p.chord,
  }))
  const tail = at.filter((a) => a.pos < 0).map((a) => `[${a.chord}]`)
  for (const a of [...at].filter((a) => a.pos >= 0).reverse())
    out = out.slice(0, a.pos) + `[${a.chord}]` + out.slice(a.pos)
  return tail.length ? `${out.replace(/\s+$/, '')} ${tail.join(' ')}` : out
}

export function fillMissingChords(source: string): {
  source: string
  filled: string[]
} {
  const lines = source.split('\n')
  const filled: string[] = []
  // Inside notation or tab nothing is a lyric
  let inBlock = false
  const lyricAt = lines.map((l) => {
    if (/^\{start_of_(abc|tab)/.test(l)) inBlock = true
    const ok = !inBlock && isLyric(l)
    if (/^\{end_of_(abc|tab)/.test(l)) inBlock = false
    return ok
  })

  // 1. A line sung again: the chords it had before
  const seen = new Map<string, Placed[]>()
  lines.forEach((l, i) => {
    if (!lyricAt[i]) return
    const k = key(l)
    if (hasChord(l)) {
      if (k && !seen.has(k)) seen.set(k, chordsByWord(l))
    } else if (k.split(' ').length >= 3 && seen.has(k)) {
      lines[i] = apply(l, seen.get(k)!)
      filled.push(`repeat: ${plain(lines[i]).trim()}`)
    }
  })

  // 2. Stanzas: runs of lyric lines between blank lines and directives
  const stanzas: number[][] = []
  let cur: number[] = []
  lines.forEach((l, i) => {
    if (lyricAt[i]) cur.push(i)
    else if (!l.trim() || /^\s*\{/.test(l)) {
      if (cur.length) stanzas.push(cur)
      cur = []
    }
  })
  if (cur.length) stanzas.push(cur)

  const words = (i: number) => key(lines[i]).split(' ').length
  const charted = (s: number[]) => s.every((i) => hasChord(lines[i]))
  stanzas.forEach((s, n) => {
    if (s.length < 3) return
    const bare = s.filter((i) => !hasChord(lines[i]))
    // Bare, or chords only on its first line
    if (
      !(
        bare.length === s.length ||
        (bare.length === s.length - 1 && hasChord(lines[s[0]]))
      )
    )
      return
    // The nearest earlier charted stanza it parallels
    for (let t = n - 1; t >= 0; t--) {
      const tpl = stanzas[t]
      if (tpl.length !== s.length || !charted(tpl)) continue
      if (!s.every((i, k) => Math.abs(words(i) - words(tpl[k])) <= 3)) continue
      s.forEach((i, k) => {
        if (hasChord(lines[i])) return
        lines[i] = apply(lines[i], chordsByWord(lines[tpl[k]]))
      })
      filled.push(
        `verse like "${plain(lines[tpl[0]]).trim()}": ${plain(lines[s[0]]).trim()}`,
      )
      return
    }
  })
  return {source: lines.join('\n'), filled}
}
