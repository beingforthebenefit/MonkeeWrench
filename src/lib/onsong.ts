import {
  TAB_LINE,
  isChordLine,
  mergeChordLine,
  parseHeader,
  sectionType,
} from './chordpro'

/**
 * OnSong → ChordPro. OnSong songs are plain text: the title, the artist and
 * "Key: G" lines on top, then paragraphs separated by blank lines, with
 * chords either inline ("[G]words") or on their own line above the words.
 * Sections are sometimes labelled ("Chorus:", "VERSE 2:"), sometimes by an
 * instruction ("intro- sax solo", "piano solo") and often not at all; a
 * blank line is the only boundary. So each paragraph becomes its own
 * section, labelled when it says what it is.
 *
 * A player's own part notes on top ("Piano - Light and airy", "Organ -
 * Think Doors") belong to that player, not the band's chart: they come back
 * separately as `partNotes`, for a personal cue.
 */

export type OnSongIn = {
  title: string
  /** Other names it went by, recognised (and dropped) in the header */
  aliases?: string[]
  byline?: string | null
  key?: string | null
  content: string
}

export type OnSongOut = {source: string; partNotes: string[]}

const META =
  /^(key|tempo|time|capo|duration|ccli|copyright|artist|title|author|bpm|flow|book|number)\s*:/i
const HEADER_DIRECTIVE =
  /^\{\s*(t|title|st|subtitle|artist|key|capo|tempo|time|duration|copyright|ccli)\s*(:.*)?\}$/i
/** "Piano - Light and airy", "E. Piano", "Organ - Think Doors" */
const PART_NOTE =
  /^(e\.?\s*piano|electric piano|piano|organ|synth|keys|keyboards?|clav(inet)?|rhodes|wurli(tzer)?)\b(\s*[-–:].*)?$/i
/** A line that says what follows: "intro- sax solo", "piano solo", "(softer)" */
const INSTRUCTION =
  /\b(intro|outro|solo|break|verse|chorus|bridge|instrumental|interlude|ending|end|vamp|tag|turnaround|horns?|riff|bars?|repeat|x\d+)\b/i

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

export function convertOnSong(song: OnSongIn): OnSongOut {
  const lines = song.content
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))

  // The header: title, byline, metadata, copyright, and part notes, up to
  // the first line that carries a chord
  const partNotes: string[] = []
  const body: string[] = []
  let inHeader = true
  const hasChord = (l: string) =>
    /\[[^\]]+\]/.test(l) || isChordLine(l) || Boolean(parseHeader(l.trim()))
  for (const [i, line] of lines.entries()) {
    const t = line.trim()
    if (inHeader) {
      if (!t) continue
      // Checked first: a part note can name chords ("Piano - Hit the [G]")
      if (PART_NOTE.test(t)) {
        partNotes.push(t)
        continue
      }
      // The music starts at a chord, or at a label directly above one
      const next = lines[i + 1]
      if (
        hasChord(line) ||
        (next?.trim() &&
          !PART_NOTE.test(next.trim()) &&
          (hasChord(next) || TAB_LINE.test(next)))
      )
        inHeader = false
      else {
        if (
          !(
            norm(t) === norm(song.title) ||
            (song.aliases ?? []).some((a) => norm(t) === norm(a)) ||
            (song.byline && norm(t) === norm(song.byline)) ||
            META.test(t) ||
            HEADER_DIRECTIVE.test(t) ||
            t.startsWith('©')
          )
        )
          // Anything else before the music ("note- intro made longer") is
          // for everyone: keep it as a remark, and keep looking for part
          // notes
          body.push(/^\{.*\}$/.test(t) ? t : `{comment: ${t}}`, '')
        continue
      }
    }
    if (HEADER_DIRECTIVE.test(t) || META.test(t)) continue
    body.push(line)
  }

  // Paragraphs
  const paragraphs: string[][] = []
  let cur: string[] = []
  for (const l of body) {
    if (l.trim()) cur.push(l)
    else if (cur.length) {
      paragraphs.push(cur)
      cur = []
    }
  }
  if (cur.length) paragraphs.push(cur)

  const out: string[] = [`{title: ${song.title}}`]
  if (song.key) out.push(`{key: ${song.key}}`)
  for (const p of paragraphs) {
    out.push('')
    out.push(...convertParagraph(p))
  }
  return {source: out.join('\n') + '\n', partNotes}
}

function convertParagraph(p: string[]): string[] {
  const first = p[0].trim()
  // A directive on its own ({chorus}, {comment: ...}) passes through
  if (p.length === 1 && /^\{.*\}$/.test(first)) return [first]
  // "(softer, hold each chord)" alone: a remark
  if (p.length === 1 && /^\(.*\)$/.test(first) && !/\[/.test(first))
    return [`{comment: ${first.slice(1, -1)}}`]

  let label: {label: string; note: string; chords: string} | null =
    parseHeader(first)
  // "Intro: [A] [Bm] [A] [Bm]": the chords to play, not a remark
  if (label?.note && /^(\s*\[[^\]]+\]\s*)+$/.test(label.note)) {
    label = {...label, chords: label.note.trim(), note: ''}
  }
  // OnSong's "{chorus}" heading a paragraph: this paragraph is the chorus
  if (
    !label &&
    p.length > 1 &&
    /^\{\s*(chorus|soc|start_of_chorus)\s*\}$/i.test(first)
  )
    label = {label: 'Chorus', note: '', chords: ''}
  let rest = p.slice(1)
  if (
    !label &&
    p.length > 1 &&
    !/\[/.test(first) &&
    !isChordLine(first) &&
    first.length <= 40 &&
    INSTRUCTION.test(first)
  ) {
    // "intro- sax solo" over its chords: the section's name
    const [name, ...more] = first.split(/\s*[-–]\s+|\s*-(?=\s*[a-z])/i)
    label = {
      label: capitalise(name.trim()),
      note: more.join(' - ').trim(),
      chords: '',
    }
  }
  if (!label) rest = p

  const lines: string[] = []
  for (let i = 0; i < rest.length; i++) {
    const line = rest[i]
    const t = line.trim()
    if (/^\{.*\}$/.test(t)) {
      lines.push(t)
      continue
    }
    if (TAB_LINE.test(line)) {
      // Tab can't sit inside a lyric section: its own block
      const tab: string[] = []
      while (i < rest.length && TAB_LINE.test(rest[i])) tab.push(rest[i++])
      i--
      lines.push('\u0000tab', ...tab, '\u0000endtab')
      continue
    }
    if (!/\[/.test(line) && isChordLine(line)) {
      const next = rest[i + 1]
      if (
        next !== undefined &&
        next.trim() &&
        !/\[/.test(next) &&
        !isChordLine(next) &&
        !TAB_LINE.test(next)
      ) {
        lines.push(mergeChordLine(line, next))
        i++
      } else lines.push(mergeChordLine(line, ''))
      continue
    }
    lines.push(line)
  }

  // Tab blocks split the paragraph into lyric parts and tab parts
  const out: string[] = []
  const type = label ? sectionType(label.label) : null
  let open = false
  const openSection = () => {
    if (!label || open) return
    out.push(
      `{start_of_${type}: ${label.label}${label.note ? ` (${label.note})` : ''}}`,
    )
    if (label.chords) out.push(label.chords)
    open = true
  }
  const closeSection = () => {
    if (open) out.push(`{end_of_${type}}`)
    open = false
  }
  openSection()
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '\u0000tab') {
      closeSection()
      out.push('{start_of_tab}')
      while (lines[++i] !== '\u0000endtab') out.push(lines[i])
      out.push('{end_of_tab}')
      continue
    }
    out.push(lines[i])
  }
  closeSection()
  return out
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
