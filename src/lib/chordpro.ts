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
  /** Guitar tablature: shown verbatim in a monospace font */
  | {kind: 'tab'; text: string}

export type Section = {
  /** verse | chorus | bridge | intro | interlude | outro | solo | part … */
  type: string
  label: string
  /** Parenthesised remark after the label, e.g. "x2, 2nd time fade out" */
  note: string
  lines: ChartLine[]
  /**
   * Music notation, for a {start_of_abc} section: ABC text, drawn as a
   * staff. It is written in the chart's original key; `abcSteps` is how far
   * the chart has been transposed since, which the notation follows.
   */
  abc?: string
  abcSteps?: number
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

/**
 * Peel wrapping off a chord token: "(B)", "(C" and "G)," are chords inside
 * a parenthesised group or followed by punctuation.
 */
function unwrap(token: string) {
  const m = token.match(/^(\(?)(.*?)([),.]*)$/)!
  return {pre: m[1], core: m[2], post: m[3]}
}

const BASS_ONLY = /^\/([A-G](?:#|b)?)$/

/** A chord, possibly parenthesised, or a bass-only change like "/G". */
export function isChord(token: string): boolean {
  const {core} = unwrap(token)
  return CHORD.test(core) || BASS_ONLY.test(core)
}

/** Repeat counts, no-chord and bar lines: chord-row markings, not chords. */
export function isChordMarking(token: string): boolean {
  return /^\(?x\d+\)?$/i.test(token) || /^(N\.?C\.?|\|+|%|-)$/i.test(token)
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

export function parseChordPro(source: string): Chart {
  const chart: Chart = {title: '', key: null, meta: {}, sections: []}
  let current: Section | null = null
  let implicit = false

  const open = (type: string, rawLabel: string, isImplicit = false) => {
    const {label, note} = splitLabel(rawLabel)
    current = {type, label, note, lines: []}
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
        // Notation and tab have no heading unless given one ("Horn riff")
        open(
          start[1],
          value || (['abc', 'tab'].includes(start[1]) ? '' : cap(start[1])),
        )
        continue
      }
      if (/^end_of_\w+$/.test(name)) {
        current = null
        continue
      }
      if (name === 'chorus') {
        // A bare {chorus} repeats the most recent chorus. It is written out
        // in full: charts are read mid-song, so never "same as above".
        const prev = [...chart.sections]
          .reverse()
          .find((s) => s.type === 'chorus')
        const {label, note} = splitLabel(value || prev?.label || 'Chorus')
        chart.sections.push({
          type: 'chorus',
          label,
          note,
          lines: structuredClone(prev?.lines ?? []),
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

    // (TS narrows `current` to null here because it is assigned in a closure)
    const cur = current as Section | null
    if (cur?.type === 'abc') {
      // Kept verbatim, blank lines and all: it's another language
      cur.abc = cur.abc === undefined ? rawLine : `${cur.abc}\n${rawLine}`
      continue
    }
    if (cur?.type === 'tab') {
      if (line.trim()) cur.lines.push({kind: 'tab', text: line})
      continue
    }
    if (!line.trim()) {
      if (implicit) current = null
      continue
    }
    if (!current) open('part', '', true)
    current!.lines.push(parseLyricLine(line))
  }

  for (const s of chart.sections) if (s.abc !== undefined) s.abc = s.abc.trim()
  chart.sections = chart.sections.filter(
    (s) => s.lines.length > 0 || s.label || s.abc,
  )
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
  if (semitones % 12 === 0) return chord
  const {pre, core, post} = unwrap(chord)
  const b = core.match(BASS_ONLY)
  if (b) return pre + '/' + shift(b[1], semitones, flats) + post
  const m = core.match(CHORD)
  if (!m) return chord
  const [, root, quality, bass] = m
  return (
    pre +
    shift(root, semitones, flats) +
    quality +
    (bass ? '/' + shift(bass, semitones, flats) : '') +
    post
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
          const m = seg.chord ? unwrap(seg.chord).core.match(CHORD) : null
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
      ...(s.abc ? {abcSteps: (s.abcSteps ?? 0) + steps} : {}),
      lines: s.lines.map((l) =>
        l.kind !== 'lyrics'
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
  if (line.kind === 'tab') return [line.text]
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
    const head = s.label || (s.abc ? 'Notation' : cap(s.type))
    out.push(`[${head}]${s.note ? ` (${s.note})` : ''}`)
    for (const l of s.lines) out.push(...lineToChordsOverWords(l))
    // Notation shows as its ABC text, so a history diff shows what changed
    if (s.abc) out.push(...s.abc.split('\n'))
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

/** "(x2)", "x4", "F(x2)" → the repeat part, if the token is one */
const REPEAT = /^\(?x\d+\)?$/i

/**
 * A remark written into a chord line: "[hold 4 bars]" or "(organ fill)" --
 * anything bracketed or parenthesised that is not itself a chord group.
 */
const REMARK =
  /\[[^\]]*\]|\((?![A-G][#b]?[^\s)]*(?:\)|\s))(?!x\d)(?:[^()]|\([^()]*\))*\)/g

export function isChordLine(line: string): boolean {
  // Remarks don't disqualify a chord line; they are kept as notes
  const tokens = line.replace(REMARK, ' ').trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return false
  let chords = 0
  for (const t of tokens) {
    const bare = t.replace(/^\(|\)$/g, '')
    const glued = t.match(/^(.+?)(\(x\d+\))$/i)
    if (isChord(bare) || (glued && isChord(glued[1]))) chords++
    else if (!NON_CHORD_TOKENS.has(t) && !REPEAT.test(t)) return false
  }
  return chords > 0
}

/** "C F Bb F (x4)" → "[C] [F] [Bb] [F] (x4)": chords become chords, the rest stays text. */
function inlineChords(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map((t) => {
      const glued = t.match(/^(.+?)(\(x\d+\))$/i)
      if (glued && isChord(glued[1])) return `[${glued[1]}]${glued[2]}`
      return isChord(t) ? `[${t}]` : t
    })
    .join(' ')
}

/** A tablature string line: `e|---7---5p4p0---|` */
// "e|---7---5p4p0---|", or a bare tab staff line "-9-7---4-2----|"
export const TAB_LINE =
  /^\s*(?:[A-Ga-g]\|[-0-9a-z|~/\\^().*\s]*|[-0-9hpbr/\\~x|.]*-{6,}[-0-9hpbr/\\~x|.]*)$/

const SECTION_WORDS =
  /^(intro|verse|pre-?chorus|chorus|bridge|interlude|instrumental|solo|outro|coda|ending|tag|refrain|break)\b/i

/** Recognise a section header line and split it into label, note and any chords that follow. */
export function parseHeader(
  line: string,
): {label: string; note: string; chords: string} | null {
  let label: string
  let rest: string
  const bracket = line.match(/^\[([^\]]+)\]\s*(.*)$/)
  const numbered = line.match(/^#\s*(\d+)\.?\s*$/)
  const colon = line.match(/^([A-Za-z][A-Za-z0-9 '&/.-]{0,30}?)\s*:\s*(.*)$/)
  if (bracket && !isChord(bracket[1])) {
    ;[label, rest] = [bracket[1], bracket[2]]
  } else if (numbered) {
    return {label: `Verse ${numbered[1]}`, note: '', chords: ''}
  } else if (
    colon &&
    (colon[1] === colon[1].toUpperCase() || SECTION_WORDS.test(colon[1]))
  ) {
    ;[label, rest] = [colon[1], colon[2]]
  } else {
    return null
  }

  const notes: string[] = []
  const dash = label.match(/^(.*?)\s+-\s+(.*)$/)
  if (dash) {
    label = dash[1]
    notes.push(dash[2])
  }
  rest = rest.trim()
  let chords = ''
  if (rest && isChordLine(rest)) chords = inlineChords(rest)
  else if (rest) notes.push(rest.replace(/^[-–]\s*|:$|^\(|\)$/g, '').trim())
  return {
    label: titleCase(label),
    note: notes.filter(Boolean).map(titleCase).join('; '),
    chords,
  }
}

function titleCase(s: string): string {
  if (s !== s.toUpperCase()) return s.trim()
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\b(\d+)X\b/gi, '$1x')
    .trim()
}

export function sectionType(name: string): string {
  const n = name.toLowerCase()
  if (/pre-?chorus/.test(n)) return 'prechorus'
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
  if (/instrumental|break/.test(n)) return 'solo'
  if (/coda|ending/.test(n)) return 'outro'
  return 'part'
}

/** Insert `[chord]` markers from a chord line into the lyric line below it. */
export function mergeChordLine(chordLine: string, lyricLine: string): string {
  const marks: {col: number; chord: string}[] = []
  // A remark is one token, re-wrapped in parentheses so it can't nest brackets
  const re = new RegExp(`${REMARK.source}|\\S+`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(chordLine)))
    marks.push({
      col: m.index,
      chord: m[0].startsWith('[') ? `(${m[0].slice(1, -1)})` : m[0],
    })
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
 * Convert a chords-over-words chart (chord lines above lyric lines) into
 * ChordPro. Understands both header styles in the band's old Docs:
 * `[Verse 1]` / `[Intro] A` and `INTRO: C F Bb F (x4)` / `#1.` / `CHORUS:`.
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

    const h = parseHeader(trimmed)
    if (h) {
      close()
      openType = sectionType(h.label)
      if (out.length > 1) out.push('')
      out.push(
        `{start_of_${openType}: ${h.label}${h.note ? ` (${h.note})` : ''}}`,
      )
      if (h.chords) out.push(h.chords)
      continue
    }

    if (TAB_LINE.test(line)) {
      // Tablature can't live inside a lyric section in ChordPro
      close()
      out.push('{start_of_tab}')
      while (
        i < lines.length &&
        (TAB_LINE.test(lines[i]) || !lines[i].trim())
      ) {
        if (lines[i].trim()) out.push(lines[i])
        i++
      }
      out.push('{end_of_tab}')
      i--
      continue
    }

    if (isChordLine(line)) {
      const next = lines[i + 1]
      if (
        next !== undefined &&
        next.trim() &&
        !isChordLine(next) &&
        !parseHeader(next.trim())
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
