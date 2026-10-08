/**
 * Melodies written out as letters, the way players jot down a horn line or
 * a riff: "(G G G FF F# G) x4", "B B D# B C# A. B B B B A C#". Turned into
 * notation (ABC) for horns, keys and strings, or guitar tab for guitar and
 * bass parts.
 *
 * Letters carry pitch only. Octaves follow the line's shape (each note goes
 * to the octave nearest the one before), and rhythm is what the spacing
 * suggests: a letter alone is a quarter, doubled letters ("FF") are two
 * eighths, and a period or a wide gap ends a phrase (a bar line).
 */

export type WrittenNote = {
  letter: string // A-G
  acc: '' | '#' | 'b'
  eighth: boolean
  /** A phrase ends after this note */
  phraseEnd: boolean
}

export type WrittenLine = {notes: WrittenNote[]; repeats: string | null}

const ONE = /^([A-Ga-g])([#b]?)$/

/** The notes in a written-out line, or null if it isn't one. */
export function readNoteLine(line: string): WrittenLine | null {
  let text = line.trim()
  let repeats: string | null = null
  const rep = text.match(/\s+(x\s?\d+)\s*$/i)
  if (rep) {
    repeats = rep[1].replace(/\s/g, '')
    text = text.slice(0, rep.index).trim()
  }
  text = text.replace(/^\(|\)$/g, '').trim()
  if (!text) return null
  const notes: WrittenNote[] = []
  // Each token with the gap after it: a wide gap ends a phrase
  for (const m of text.matchAll(/(\S+)(\s*)/g)) {
    let tok = m[1]
    const end = tok.endsWith('.') || m[2].length >= 3
    tok = tok.replace(/[.,]$/, '')
    const one = tok.match(ONE)
    if (one) {
      notes.push({
        letter: one[1].toUpperCase(),
        acc: one[2] as WrittenNote['acc'],
        eighth: false,
        phraseEnd: end,
      })
      continue
    }
    // "FF", "GG", "BbBb": the same note twice, quick
    const twice = tok.match(/^(([A-Ga-g])([#b]?))\1$/)
    if (!twice) return null
    for (const k of [0, 1])
      notes.push({
        letter: twice[2].toUpperCase(),
        acc: twice[3] as WrittenNote['acc'],
        eighth: true,
        phraseEnd: k === 1 && end,
      })
  }
  return notes.length >= 4 ? {notes, repeats} : null
}

const BASE: Record<string, number> = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11}
const semitone = (n: WrittenNote) =>
  BASE[n.letter] + (n.acc === '#' ? 1 : n.acc === 'b' ? -1 : 0)

/** MIDI numbers: each note in the octave nearest the previous one. */
function pitches(notes: WrittenNote[], start: number) {
  let prev = start
  return notes.map((n) => {
    const s = semitone(n)
    let best = 0
    for (let o = 0; o < 9; o++) {
      const midi = 12 * (o + 1) + s
      if (!best || Math.abs(midi - prev) < Math.abs(best - prev)) best = midi
    }
    prev = best
    return best
  })
}

// Sharps (+) or flats (-) in each key's signature
const SIGNATURE: Record<string, number> = {
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  'F#': 6,
  'C#': 7,
  F: -1,
  Bb: -2,
  Eb: -3,
  Ab: -4,
  Db: -5,
  Gb: -6,
  Cb: -7,
  Am: 0,
  Em: 1,
  Bm: 2,
  'F#m': 3,
  'C#m': 4,
  'G#m': 5,
  'D#m': 6,
  Dm: -1,
  Gm: -2,
  Cm: -3,
  Fm: -4,
  Bbm: -5,
  Ebm: -6,
}

/** What the key signature does to each letter: '#', 'b' or ''. */
function keyAccidentals(key: string | null) {
  const k = key?.match(/^([A-G][#b]?m?)/)?.[1] ?? 'C'
  const n = SIGNATURE[k] ?? 0
  const out: Record<string, string> = {}
  for (const l of 'FCGDAEB'.slice(0, Math.max(n, 0))) out[l] = '#'
  for (const l of 'BEADGCF'.slice(0, Math.max(-n, 0))) out[l] = 'b'
  return out
}

/**
 * ABC for one or more written lines, in the song's key (so it transposes
 * with the chart). Accidentals are spelled exactly as written.
 */
export function linesToAbc(
  lines: WrittenLine[],
  key: string | null,
  /** A guitar or bass part: written where guitarists read it, and the
   * tab view uses that instrument's strings */
  instrument: 'guitar' | 'bass' | null = null,
) {
  const sig = keyAccidentals(key)
  const body = lines.map((line) => {
    // Horns and keys sit around A4; a riff around B3 (guitar is written an
    // octave above where it sounds)
    const midi = pitches(line.notes, instrument ? 59 : 69)
    let bar: Record<string, string> = {}
    let out = line.repeats ? `"^${line.repeats}"` : ''
    line.notes.forEach((n, i) => {
      const octave = Math.floor((midi[i] - semitone(n) - 12) / 12)
      const id = `${n.letter}${octave}`
      // Accidental needed if the bar so far (or the key) says otherwise
      const now = bar[id] ?? sig[n.letter] ?? ''
      const mark =
        n.acc === now ? '' : n.acc === '#' ? '^' : n.acc === 'b' ? '_' : '='
      bar[id] = n.acc
      const letter =
        octave >= 5
          ? n.letter.toLowerCase() + "'".repeat(octave - 5)
          : n.letter + ','.repeat(Math.max(4 - octave, 0))
      out += `${mark}${letter}${n.eighth ? '' : '2'}`
      const next = line.notes[i + 1]
      if (n.phraseEnd && next) {
        out += ' | '
        bar = {}
      } else if (next && !(n.eighth && next.eighth && !n.phraseEnd)) out += ' '
    })
    return out + ' |]'
  })
  return [
    ...(instrument ? [`% instrument: ${instrument}`] : []),
    `M:none`,
    `L:1/8`,
    `K:${key ?? 'C'}`,
    ...body,
  ].join('\n')
}

// Standard tuning, low to high (MIDI)
const STRINGS = [
  {name: 'E', midi: 40},
  {name: 'A', midi: 45},
  {name: 'D', midi: 50},
  {name: 'G', midi: 55},
  {name: 'B', midi: 59},
  {name: 'e', midi: 64},
]

/**
 * Guitar tab for one written line (a bass player reads the bottom four
 * strings an octave down). Notes stay in one hand position where they can.
 */
export function lineToTab(line: WrittenLine) {
  const midi = pitches(line.notes, 47) // around B2: riff territory
  const rows = STRINGS.map(() => [] as string[])
  let fret = 3
  line.notes.forEach((n, i) => {
    let pick: {s: number; f: number} | null = null
    STRINGS.forEach((st, s) => {
      const f = midi[i] - st.midi
      if (f < 0 || f > 15) return
      if (!pick || Math.abs(f - fret) < Math.abs(pick.f - fret)) pick = {s, f}
    })
    const p = pick ?? {s: 0, f: Math.max(midi[i] - 40, 0)}
    fret = p.f
    const cell = String(p.f)
    // Quick notes sit closer together, so the tab hints at the rhythm
    const width = Math.max(cell.length + 1, n.eighth ? 2 : 3)
    rows.forEach((r, s) =>
      r.push(s === p.s ? cell.padEnd(width, '-') : '-'.repeat(width)),
    )
    if (n.phraseEnd && line.notes[i + 1]) rows.forEach((r) => r.push('|-'))
  })
  return STRINGS.map((st, s) => ({st, s}))
    .reverse()
    .map(({st, s}) => `${st.name}|-${rows[s].join('')}|`)
}
