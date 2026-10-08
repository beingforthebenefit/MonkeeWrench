import {
  TAB_LINE,
  isChord,
  isChordLine,
  mergeChordLine,
  placeInlineChords,
  parseHeader,
  sectionType,
} from './chordpro'
import {linesToAbc, readNoteLine, type WrittenLine} from './notes'

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

/**
 * A line that tells the band what to do rather than what to sing: "guitar
 * intro 2 bars", "x2", "main riff 6x", "BACK TO SLOWER TEMPO". It's a note,
 * never the words a chord line above it sits on.
 */
const NOTE_WORDS =
  /\b(intro|outro|solos?|riffs?|bars?|repeats?|modulates?|guitars?|piano|keys|keyboards?|organ|sax|horns?|drums?|bass|vamp|turnaround|instrumental|double time|tempo|fills?|percussion|chords|x ?\d+|\d+ ?x|\d+ times|(two|three|four) times)\b/i
export function isNoteText(line: string) {
  const t = line.trim()
  if (!t || /[[{]/.test(t) || readNoteLine(t)) return false
  if (t.split(/\s+/).length > 14) return false
  // "/ BREAK" under a chord: beats for the chord row, not a note
  if (/(^|\s)\/+(\.|\s|$)/.test(t)) return false
  // All capitals and no lyric shape: "BACK TO SLOWER TEMPO"
  if (/^[^a-z]*[A-Z]{3}[^a-z]*$/.test(t) && !/[?!]$/.test(t)) return true
  return NOTE_WORDS.test(t)
}

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
  // Where the music starts: a chord, a section label, or written-out notes
  const hasChord = (l: string) =>
    /\[[^\]]+\]/.test(l) ||
    isChordLine(l) ||
    Boolean(parseHeader(l.trim())) ||
    (/^\s*\(/.test(l) && readNoteLine(l) !== null)
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
    // A rule of dashes is a divider, not tab: a paragraph break
    if (/^[-_=]{3,}$/.test(t)) {
      body.push('')
      continue
    }
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
  const ctx: Ctx = {key: song.key ?? null, known: new Map()}
  for (const p of paragraphs) {
    out.push('')
    out.push(...convertParagraph(p, ctx))
  }
  return {source: out.join('\n') + '\n', partNotes}
}

type Ctx = {
  key: string | null
  /** Note lines seen so far in this song: a repeat of one is one too */
  /** ...and whether each became tab: a repeat is written the same way */
  known: Map<string, boolean | null>
}

/** A line that says what the notes under it are: "horn line is" */
const DESCRIBES =
  /\b(notes?|horns?|line|riff|melody|lick|sax|keyboards?|keys|piano|organ|strings?|guitar|bass|plays?|under this|unison)\b/i
const SAYS_NOTES = /\b(notes?|horns?|line|riff|melody|lick|unison)\b/i
/** Named instruments: these decide outright */
const TAB_PART = /\b(guitar|bass)\b/i
/** "Riff" leans to tab, but only if nothing else has decided */
const RIFF = /\briff\b/i
const NOT_TAB =
  /\b(horns?|sax|keyboards?|keys|piano|organ|strings?|trumpet|trombone)\b/i

const signature = (w: WrittenLine) =>
  w.notes
    .slice(0, 6)
    .map((n) => n.letter + n.acc)
    .join(' ')

/**
 * Is this line written-out notes rather than chords? Letters alone can be
 * either ("D D C C G G G G" is four bars of chords). Notes when bracketed
 * the way players write melodies, when the line above says so ("horn line
 * is", "intro keyboard notes"), or when it repeats a line already read as
 * notes -- never when the line above says "chords".
 */
function noteLine(line: string, before: string, ctx: Ctx) {
  const w = readNoteLine(line)
  if (!w) return null
  const bracketed = /^\(/.test(line.trim())
  // Unbracketed letters need the line above to say they're notes: an
  // instrument alone ("solo- guitar") is just as likely over chords
  const said = SAYS_NOTES.test(before) && !/chord/i.test(before)
  if (
    bracketed ||
    ctx.known.has(signature(w)) ||
    (said && w.notes.length >= 5)
  ) {
    if (!ctx.known.has(signature(w))) ctx.known.set(signature(w), null)
    return w
  }
  return null
}

/** A line already written once keeps its first form (notation or tab). */
/**
 * Notation or tab for a run of note lines: an instrument named in its own
 * label decides ("sax comes in, plays this"); otherwise the way the same
 * line was written the first time; otherwise "riff", or the instrument in
 * the paragraph's label.
 */
function chooseTab(ctx: Ctx, w: WrittenLine, name: string, para: string) {
  const key = signature(w)
  const seen = ctx.known.get(key)
  let asTab: boolean
  if (NOT_TAB.test(name)) asTab = false
  else if (TAB_PART.test(name)) asTab = true
  else if (seen !== null && seen !== undefined) asTab = seen
  else
    asTab =
      RIFF.test(name) ||
      (!NOT_TAB.test(para) && (TAB_PART.test(para) || RIFF.test(para)))
  if (seen === null || seen === undefined) ctx.known.set(key, asTab)
  return asTab
}

function convertParagraph(p: string[], ctx: Ctx): string[] {
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
  // "(softer, hold each chord)" heading a paragraph: a remark about it
  if (
    !label &&
    rest.length > 1 &&
    /^\([^[\]]*\)$/.test(rest[0].trim()) &&
    !readNoteLine(rest[0])
  )
    rest = [`{comment: ${rest[0].trim().slice(1, -1)}}`, ...rest.slice(1)]

  // "[A]ev[D-D]eryo[C]ne accents this then 4 bars guitar solo": chords
  // typed into an instruction. The chords, then the instruction as a note
  rest = rest.flatMap((l) => {
    if (!/\[/.test(l) || /^\s*\{/.test(l)) return [l]
    const text = l.replace(/\[[^\]]*\]/g, '')
    if (!isNoteText(text)) return [l]
    const chords = [...l.matchAll(/\[([^\]]*)\]/g)].map((m) => `[${m[1]}]`)
    return [chords.join('   '), text.trim()]
  })

  // Chords typed inline: "[A[fine" for "[A]fine", "[G6-]" (a hold mark on
  // the chord), and each chord onto its syllable (see placeChords)
  rest = rest.map((l) =>
    /^\s*\{/.test(l) || !/\[/.test(l)
      ? l
      : placeInlineChords(
          l
            .replace(/\[([A-G][^[\]\s]*)\[/g, '[$1]')
            .replace(/\[([A-G][^\]]*?)-\]/g, (m, c) =>
              isChord(c) ? `[${c}]` : m,
            ),
        ),
  )

  // "A / Cm7 / Bm7 /E7": a beat slash typed against its chord
  rest = rest.map((l) => {
    if (/\[/.test(l)) return l
    const spaced = l.replace(/(^|\s)\/(?=[A-G])/g, '$1/ ')
    return spaced !== l && isChordLine(spaced) ? spaced : l
  })

  const lines: string[] = []
  for (let i = 0; i < rest.length; i++) {
    const line = rest[i]
    const t = line.trim()
    const before = i > 0 ? rest[i - 1].trim() : first
    const written = noteLine(line, before, ctx)
    if (written) {
      // The run of note lines, and the line above that names them
      const run: WrittenLine[] = [written]
      while (i + 1 < rest.length) {
        const w = noteLine(rest[i + 1], rest[i].trim(), ctx)
        if (!w) break
        run.push(w)
        i++
      }
      let name = ''
      const last = lines[lines.length - 1]
      if (
        last !== undefined &&
        !last.startsWith('\u0000') &&
        !/\[/.test(last) &&
        last.trim().length <= 50 &&
        DESCRIBES.test(last)
      ) {
        name = capitalise(
          lines
            .pop()!
            .trim()
            .replace(/[:>-]+$/, '')
            .replace(/^[\s:>-]+/, '')
            .trim(),
        )
      }
      // Notes straight under the paragraph's label: the label names them
      if (!name && !lines.length && label) {
        name = [label.label, label.note]
          .filter(Boolean)
          .join(' ')
          .replace(/[\s:>-]+$/, '')
        label = null
        const asTab = chooseTab(ctx, run[0], name, '')
        lines.push('\u0000written', JSON.stringify({name, asTab, run}))
        continue
      }
      const para = `${label?.label ?? ''} ${label?.note ?? ''}`
      const asTab = chooseTab(ctx, run[0], name, para)
      lines.push('\u0000written', JSON.stringify({name, asTab, run}))
      continue
    }
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
      // Not onto a line that introduces written-out notes: that line is a
      // label, not lyrics
      const introducesNotes =
        next !== undefined &&
        SAYS_NOTES.test(next) &&
        rest[i + 2] !== undefined &&
        readNoteLine(rest[i + 2]) !== null
      if (
        !introducesNotes &&
        next !== undefined &&
        // "guitar intro 2 bars" under a chord line is a note about it
        !isNoteText(next) &&
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

  // What's left of the instructions are notes, not lyrics
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '\u0000written') i++
    else if (lines[i] === '\u0000tab') while (lines[i] !== '\u0000endtab') i++
    else if (isNoteText(lines[i]))
      lines[i] = `{comment: ${lines[i]
        .trim()
        .replace(/[\s:>-]+$/, '')
        .replace(/^[\s:>-]+/, '')}}`
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
    if (lines[i] === '\u0000written') {
      const {name, asTab, run} = JSON.parse(lines[++i]) as {
        name: string
        asTab: boolean
        run: WrittenLine[]
      }
      closeSection()
      const head = name ? `: ${name}` : ''
      // Every lick is notation; guitar and bass parts carry their
      // instrument, so the tab view shows the right strings
      const instrument = asTab
        ? /\bbass\b/i.test(`${name} ${label?.label ?? ''}`)
          ? 'bass'
          : 'guitar'
        : null
      out.push(
        `{start_of_abc${head}}`,
        linesToAbc(run, ctx.key, instrument),
        '{end_of_abc}',
      )
      continue
    }
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
