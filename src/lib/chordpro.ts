/**
 * A small ChordPro reader, transposer and importer.
 *
 * Charts are stored as ChordPro text: `Oh, I could [G]hide 'neath the [Am]wings`
 * with `{start_of_verse: Verse 1}` … `{end_of_verse}` around each section.
 * Everything the app shows (chart view, performance mode, PDFs, history diffs)
 * is derived from that one source, so there is nothing to keep in sync.
 *
 * Only the subset of ChordPro the band uses is understood; unknown directives
 * are kept in `meta` and otherwise ignored rather than rejected.
 */

export type Segment = {chord: string | null; lyric: string}

export type ChartLine =
  | {kind: 'lyrics'; segments: Segment[]}
  | {kind: 'comment'; text: string}

export type Section = {
  /** verse | chorus | bridge | intro | interlude | outro | solo | part … */
  type: string
  label: string
  /** Parenthesised remark after the label, e.g. "x2, 2nd time fade out" */
  note: string
  lines: ChartLine[]
  /** Index of an earlier section with identical content, if any */
  repeatOf: number | null
}

export type Chart = {
  title: string
  key: string | null
  meta: Record<string, string>
  sections: Section[]
}

const DIRECTIVE = /^\{\s*([\w-]+)\s*(?::\s*(.*?))?\s*\}$/
// Root, quality, optional slash bass. The quality is restricted to chord
// vocabulary so that words like "Chorus" or "Bridge" are not read as chords.
const CHORD =
  /^([A-G](?:#|b)?)((?:maj|min|dim|aug|sus|add|m|M|[0-9]|[#b+\-°ø()])*)(?:\/([A-G](?:#|b)?))?$/

const ALIASES: Record<string, string> = {
  t: 'title',
  st: 'subtitle',
  c: 'comment',
  ci: 'comment',
  comment_italic: 'comment',
  soc: 'start_of_chorus',
  eoc: 'end_of_chorus',
  sov: 'start_of_verse',
  eov: 'end_of_verse',
  sob: 'start_of_bridge',
  eob: 'end_of_bridge',
}

export function isChord(token: string): boolean {
  return CHORD.test(token)
}

/** Split "Chorus (x2, fade)" into label "Chorus" and note "x2, fade". */
export function splitLabel(raw: string): {label: string; note: string} {
  const text = raw.replace(/^label="(.*)"$/, '$1').trim()
  const m = text.match(/^(.*?)\s*\((.*)\)\s*$/)
  if (m && m[1]) return {label: m[1].trim(), note: m[2].trim()}
  return {label: text, note: ''}
}

function parseLyricLine(line: string): ChartLine {
  const segments: Segment[] = []
  const re = /\[([^\]]*)\]/g
  let last = 0
  let pending: string | null = null
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) {
    const before = line.slice(last, m.index)
    if (before || pending !== null)
      segments.push({chord: pending, lyric: before})
    pending = m[1]
    last = m.index + m[0].length
  }
  const rest = line.slice(last)
  if (rest || pending !== null) segments.push({chord: pending, lyric: rest})
  return {kind: 'lyrics', segments}
}

function lineKey(line: ChartLine): string {
  if (line.kind === 'comment') return `#${line.text}`
  return line.segments.map((s) => `[${s.chord ?? ''}]${s.lyric}`).join('')
}

function markRepeats(sections: Section[]) {
  sections.forEach((s, i) => {
    if (s.repeatOf !== null || s.lines.length === 0) return
    const body = s.lines.map(lineKey).join('\n')
    for (let j = 0; j < i; j++) {
      const prev = sections[j]
      if (prev.repeatOf !== null || prev.type !== s.type) continue
      if (prev.lines.map(lineKey).join('\n') === body) {
        s.repeatOf = j
        return
      }
    }
  })
}

export function parseChordPro(source: string): Chart {
  const chart: Chart = {title: '', key: null, meta: {}, sections: []}
  let current: Section | null = null
  let implicit = false

  const open = (type: string, rawLabel: string, isImplicit = false) => {
    const {label, note} = splitLabel(rawLabel)
    current = {type, label, note, lines: [], repeatOf: null}
    chart.sections.push(current)
    implicit = isImplicit
  }

  for (const rawLine of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.replace(/\s+$/, '')
    const d = line.trim().match(DIRECTIVE)
    if (d) {
      const name = ALIASES[d[1].toLowerCase()] ?? d[1].toLowerCase()
      const value = d[2] ?? ''
      const start = name.match(/^start_of_(\w+)$/)
      if (start) {
        open(start[1], value || cap(start[1]))
        continue
      }
      if (/^end_of_\w+$/.test(name)) {
        current = null
        continue
      }
      if (name === 'chorus') {
        // A bare {chorus} repeats the most recent chorus
        const idx = chart.sections.map((s) => s.type).lastIndexOf('chorus')
        const {label, note} = splitLabel(value || 'Chorus')
        chart.sections.push({
          type: 'chorus',
          label,
          note,
          lines: [],
          repeatOf: idx >= 0 ? idx : null,
        })
        current = null
        continue
      }
      if (name === 'comment') {
        if (!current) open('part', '', true)
        current!.lines.push({kind: 'comment', text: value})
        continue
      }
      if (name === 'title') chart.title = value
      else if (name === 'key') chart.key = value || null
      else chart.meta[name] = value
      continue
    }

    if (!line.trim()) {
      if (implicit) current = null
      continue
    }
    if (!current) open('part', '', true)
    current!.lines.push(parseLyricLine(line))
  }

  chart.sections = chart.sections.filter(
    (s) => s.lines.length > 0 || s.repeatOf !== null || s.label,
  )
  markRepeats(chart.sections)
  return chart
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ---------------------------------------------------------------------------
// Transposition
// ---------------------------------------------------------------------------

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
// How each key is conventionally spelled; also decides sharps vs flats.
const MAJOR_KEYS = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
]
const MINOR_KEYS = [
  'Cm',
  'C#m',
  'Dm',
  'Ebm',
  'Em',
  'Fm',
  'F#m',
  'Gm',
  'G#m',
  'Am',
  'Bbm',
  'Bm',
]
const FLAT_KEYS = new Set([
  'F',
  'Bb',
  'Eb',
  'Ab',
  'Db',
  'Gb',
  'Dm',
  'Gm',
  'Cm',
  'Fm',
  'Bbm',
  'Ebm',
])

function noteIndex(note: string): number {
  const i = SHARPS.indexOf(note)
  return i >= 0 ? i : FLATS.indexOf(note)
}

function shift(note: string, semitones: number, flats: boolean): string {
  const i = noteIndex(note)
  if (i < 0) return note
  const j = (((i + semitones) % 12) + 12) % 12
  return (flats ? FLATS : SHARPS)[j]
}

export function transposeChord(
  chord: string,
  semitones: number,
  flats = false,
): string {
  const m = chord.match(CHORD)
  if (!m || semitones % 12 === 0) return chord
  const [, root, quality, bass] = m
  return (
    shift(root, semitones, flats) +
    quality +
    (bass ? '/' + shift(bass, semitones, flats) : '')
  )
}

function isMinorQuality(quality: string) {
  return /^m(?!aj)/.test(quality)
}

export function transposeKey(key: string, semitones: number): string {
  const m = key.match(CHORD)
  if (!m) return key
  const minor = isMinorQuality(m[2])
  const i = noteIndex(m[1])
  if (i < 0) return key
  const j = (((i + semitones) % 12) + 12) % 12
  return (minor ? MINOR_KEYS : MAJOR_KEYS)[j]
}

/** The key: the {key} directive if set, else the first chord of the song. */
export function detectKey(chart: Chart): string | null {
  if (chart.key) return chart.key
  for (const s of chart.sections)
    for (const l of s.lines)
      if (l.kind === 'lyrics')
        for (const seg of l.segments) {
          const m = seg.chord?.match(CHORD)
          if (m) return m[1] + (isMinorQuality(m[2]) ? 'm' : '')
        }
  return null
}

export function semitonesBetween(from: string, to: string): number {
  const a = noteIndex(from.match(CHORD)?.[1] ?? '')
  const b = noteIndex(to.match(CHORD)?.[1] ?? '')
  if (a < 0 || b < 0) return 0
  return (((b - a) % 12) + 12) % 12
}

export function transposeChart(chart: Chart, semitones: number): Chart {
  const steps = ((semitones % 12) + 12) % 12
  if (steps === 0) return chart
  const fromKey = detectKey(chart)
  const toKey = fromKey ? transposeKey(fromKey, steps) : null
  const flats = toKey ? FLAT_KEYS.has(toKey) : false
  return {
    ...chart,
    key: chart.key ? toKey : chart.key,
    sections: chart.sections.map((s) => ({
      ...s,
      lines: s.lines.map((l) =>
        l.kind === 'comment'
          ? l
          : {
              kind: 'lyrics',
              segments: l.segments.map((seg) => ({
                ...seg,
                chord: seg.chord
                  ? transposeChord(seg.chord, steps, flats)
                  : null,
              })),
            },
      ),
    })),
  }
}

// ---------------------------------------------------------------------------
// Plain text (chords over words) — used for history diffs and imports
// ---------------------------------------------------------------------------

/** Render one lyric line as a chord line above a lyric line, column-aligned. */
export function lineToChordsOverWords(line: ChartLine): string[] {
  if (line.kind === 'comment') return [`(${line.text})`]
  let chords = ''
  let words = ''
  for (const seg of line.segments) {
    if (seg.chord !== null) {
      if (chords.length > words.length) words = words.padEnd(chords.length)
      chords = chords.padEnd(words.length) + seg.chord + ' '
    }
    words += seg.lyric
  }
  const out: string[] = []
  if (chords.trim()) out.push(chords.trimEnd())
  if (words.trim()) out.push(words.trimEnd())
  return out
}

export function chartToChordsOverWords(chart: Chart): string {
  const out: string[] = []
  chart.sections.forEach((s, i) => {
    if (i > 0) out.push('')
    const head = s.label || cap(s.type)
    out.push(`[${head}]${s.note ? ` (${s.note})` : ''}`)
    if (s.repeatOf !== null && s.lines.length === 0) {
      out.push('(as above)')
      return
    }
    for (const l of s.lines) out.push(...lineToChordsOverWords(l))
  })
  return out.join('\n')
}

// ---------------------------------------------------------------------------
// Import: chords-over-words text (the old Google Docs) → ChordPro
// ---------------------------------------------------------------------------

const NON_CHORD_TOKENS = new Set([
  '|',
  '||',
  '-',
  '/',
  '%',
  'N.C.',
  'NC',
  '(',
  ')',
])

function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return false
  let chords = 0
  for (const t of tokens) {
    const bare = t.replace(/^\(|\)$/g, '')
    if (isChord(bare)) chords++
    else if (!NON_CHORD_TOKENS.has(t) && !/^x\d+$/i.test(t)) return false
  }
  return chords > 0
}

const HEADER = /^\[([^\]]+)\]\s*(.*)$/

function sectionType(name: string): string {
  const n = name.toLowerCase()
  for (const t of [
    'chorus',
    'verse',
    'bridge',
    'intro',
    'interlude',
    'outro',
    'solo',
  ])
    if (n.includes(t)) return t
  if (n.includes('instrumental')) return 'solo'
  return 'part'
}

/** Insert `[chord]` markers from a chord line into the lyric line below it. */
export function mergeChordLine(chordLine: string, lyricLine: string): string {
  const marks: {col: number; chord: string}[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(chordLine))) marks.push({col: m.index, chord: m[0]})
  let lyric = lyricLine
  const width = marks.length ? marks[marks.length - 1].col : 0
  if (lyric.length < width) lyric = lyric.padEnd(width)
  for (let i = marks.length - 1; i >= 0; i--) {
    const {col, chord} = marks[i]
    lyric = lyric.slice(0, col) + `[${chord}]` + lyric.slice(col)
  }
  return lyric.replace(/\s+$/, '')
}

export type ImportResult = {source: string; key: string | null}

/**
 * Convert an Ultimate-Guitar style chart (chord lines above lyric lines,
 * `[Verse 1]` headers) into ChordPro.
 */
export function importChordsOverWords(
  text: string,
  title: string,
): ImportResult {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/\\([[\]])/g, '$1')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    // Markdown headings (the song title in a Docs export) are not chart content
    .filter((l) => !/^#{1,6}\s/.test(l.trim()))

  const out: string[] = [`{title: ${title}}`]
  let openType: string | null = null
  const close = () => {
    if (openType) out.push(`{end_of_${openType}}`)
    openType = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) continue

    const h = trimmed.match(HEADER)
    if (h && !isChord(h[1])) {
      close()
      openType = sectionType(h[1])
      const label = h[2] ? `${h[1]} ${h[2]}` : h[1]
      if (out.length > 1) out.push('')
      out.push(`{start_of_${openType}: ${label}}`)
      continue
    }

    if (isChordLine(line)) {
      const next = lines[i + 1]
      if (
        next !== undefined &&
        next.trim() &&
        !isChordLine(next) &&
        !HEADER.test(next.trim())
      ) {
        out.push(mergeChordLine(line, next))
        i++
      } else {
        out.push(mergeChordLine(line, ''))
      }
      continue
    }
    out.push(line)
  }
  close()

  const source = out.join('\n') + '\n'
  return {source, key: detectKey(parseChordPro(source))}
}
