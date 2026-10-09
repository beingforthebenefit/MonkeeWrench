/**
 * What a chord name means: its notes, and the name the guitar fingering
 * database (chords-db) files it under. "C#m7b5/G" → root C#, the notes
 * C# E G B, over G.
 */

const LETTER: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

/** chords-db's own name for each root (its file keys). */
const DB_ROOT = [
  'C',
  'Csharp',
  'D',
  'Eb',
  'E',
  'F',
  'Fsharp',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
]

/**
 * Each chord type: its intervals in semitones above the root, and the
 * suffix chords-db uses. Written forms that mean the same thing share an
 * entry ("m", "min", "-"; "maj7", "M7", "Δ7").
 */
const TYPES: {names: string[]; intervals: number[]; db: string}[] = [
  {names: ['', 'maj', 'M'], intervals: [0, 4, 7], db: 'major'},
  {names: ['m', 'min', '-', 'mi'], intervals: [0, 3, 7], db: 'minor'},
  {names: ['dim', '°', 'o'], intervals: [0, 3, 6], db: 'dim'},
  {names: ['dim7', '°7', 'o7'], intervals: [0, 3, 6, 9], db: 'dim7'},
  {names: ['aug', '+', '+5', '#5'], intervals: [0, 4, 8], db: 'aug'},
  {names: ['sus2'], intervals: [0, 2, 7], db: 'sus2'},
  {names: ['sus4', 'sus'], intervals: [0, 5, 7], db: 'sus4'},
  {names: ['7sus4', '7sus'], intervals: [0, 5, 7, 10], db: '7sus4'},
  {names: ['9sus4', '9sus'], intervals: [0, 5, 7, 10, 14], db: '7sus4'},
  {names: ['6'], intervals: [0, 4, 7, 9], db: '6'},
  {names: ['69', '6/9'], intervals: [0, 4, 7, 9, 14], db: '69'},
  {names: ['m6', 'min6', '-6'], intervals: [0, 3, 7, 9], db: 'm6'},
  {names: ['m69', 'm6/9'], intervals: [0, 3, 7, 9, 14], db: 'm69'},
  {names: ['7'], intervals: [0, 4, 7, 10], db: '7'},
  {names: ['7b5', '7-5'], intervals: [0, 4, 6, 10], db: '7b5'},
  {
    names: ['7#5', '7+5', 'aug7', '+7', '7+'],
    intervals: [0, 4, 8, 10],
    db: 'aug7',
  },
  {names: ['7b9', '7-9'], intervals: [0, 4, 7, 10, 13], db: '7b9'},
  {names: ['7#9', '7+9'], intervals: [0, 4, 7, 10, 15], db: '7#9'},
  {names: ['9'], intervals: [0, 4, 7, 10, 14], db: '9'},
  {names: ['11'], intervals: [0, 4, 7, 10, 14, 17], db: '11'},
  {names: ['13'], intervals: [0, 4, 7, 10, 14, 21], db: '13'},
  {
    names: ['maj7', 'M7', 'Δ7', 'Δ', 'ma7'],
    intervals: [0, 4, 7, 11],
    db: 'maj7',
  },
  {names: ['maj9', 'M9', 'Δ9'], intervals: [0, 4, 7, 11, 14], db: 'maj9'},
  {names: ['maj13', 'M13'], intervals: [0, 4, 7, 11, 14, 21], db: 'maj13'},
  {names: ['m7', 'min7', '-7', 'mi7'], intervals: [0, 3, 7, 10], db: 'm7'},
  {
    names: ['m7b5', 'ø', 'ø7', 'm7-5', '-7b5'],
    intervals: [0, 3, 6, 10],
    db: 'm7b5',
  },
  {names: ['m9', 'min9', '-9'], intervals: [0, 3, 7, 10, 14], db: 'm9'},
  {names: ['m11', 'min11', '-11'], intervals: [0, 3, 7, 10, 14, 17], db: 'm11'},
  {
    names: ['mmaj7', 'mM7', 'mΔ7', 'm(maj7)'],
    intervals: [0, 3, 7, 11],
    db: 'mmaj7',
  },
  {names: ['add9', 'add2'], intervals: [0, 4, 7, 14], db: 'add9'},
  {names: ['madd9', 'm(add9)'], intervals: [0, 3, 7, 14], db: 'madd9'},
  {names: ['5'], intervals: [0, 7], db: 'major'},
]

export type ChordInfo = {
  /** As written, tidied: "C#m7" */
  name: string
  root: number
  /** Pitch classes, root first */
  tones: number[]
  /** Note names, spelled to suit the root: "C# E G# B" */
  notes: string[]
  /** The bass note under a slash ("/G"), if any */
  bass: number | null
  bassName: string | null
  /** For the fingering lookup */
  dbKey: string
  dbSuffix: string
  /** The chord without its bass note, if the slash chord isn't filed */
  dbFallback: string
}

const pc = (letter: string, acc: string) =>
  (LETTER[letter] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0) + 12) % 12

/** Letter steps above the root for each interval: a third is an E-something over C. */
const STEP: Record<number, number> = {
  0: 0,
  1: 1,
  2: 1,
  3: 2,
  4: 2,
  5: 3,
  6: 4,
  7: 4,
  8: 4,
  9: 5,
  10: 6,
  11: 6,
  13: 1,
  14: 1,
  15: 1,
  17: 3,
  21: 5,
}
const LETTERS = 'CDEFGAB'

/** A note named the way the chord spells it: Cm7's third is Eb, not D#. */
function spellInterval(rootLetter: string, rootPc: number, interval: number) {
  const letter =
    LETTERS[(LETTERS.indexOf(rootLetter) + (STEP[interval] ?? 0)) % 7]
  const target = (rootPc + interval) % 12
  let diff = (target - LETTER[letter] + 12) % 12
  if (diff > 6) diff -= 12
  return letter + (diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff))
}

/** A bass note: flats in flat keys, sharps otherwise. */
function speller(rootName: string) {
  return /b/.test(rootName) || rootName === 'F' ? FLATS : SHARPS
}

export function chordInfo(raw: string): ChordInfo | null {
  const name = raw.trim().replace(/[.,]+$/, '')
  const m = name.match(/^([A-G])([#b]?)(.*?)(?:\/([A-G])([#b]?))?$/)
  if (!m) return null
  const [, letter, acc, rest, bassLetter, bassAcc] = m
  const type =
    TYPES.find((t) => t.names.includes(rest)) ??
    TYPES.find((t) => t.names.includes(rest.replace(/[()]/g, '')))
  if (!type) return null
  const root = pc(letter, acc)
  const spell = speller(letter + acc)
  const tones = [...new Set(type.intervals.map((i) => (root + i) % 12))]
  const bass = bassLetter ? pc(bassLetter, bassAcc) : null
  // chords-db files slash chords only for major triads ("C/G"), naming
  // the bass with sharps except Bb
  const slashDb =
    bass !== null && type.db === 'major'
      ? `/${SHARPS[bass].replace('A#', 'Bb')}`
      : null
  return {
    name,
    root,
    tones,
    notes: [...new Set(type.intervals.map((i) => i % 24))]
      .filter((i, k, all) => all.findIndex((j) => j % 12 === i % 12) === k)
      .map((i) => spellInterval(letter, root, i)),
    bass,
    bassName: bass !== null ? spell[bass] : null,
    dbKey: DB_ROOT[root],
    dbSuffix: slashDb ?? type.db,
    dbFallback: type.db,
  }
}

export type GuitarPosition = {
  frets: number[]
  fingers: number[]
  baseFret: number
  barres: number[]
}

type GuitarDb = {
  chords: Record<string, {suffix: string; positions: GuitarPosition[]}[]>
}

let db: Promise<GuitarDb> | null = null

/** Guitar fingerings for a chord, easiest first; loaded on first use. */
export async function guitarPositions(
  info: ChordInfo,
): Promise<GuitarPosition[]> {
  db ??= import('@tombatossals/chords-db/lib/guitar.json').then(
    (m) => (m.default ?? m) as unknown as GuitarDb,
  )
  const all = (await db).chords[info.dbKey] ?? []
  const exact = all.find((c) => c.suffix === info.dbSuffix)
  if (exact) return exact.positions
  // A slash chord chords-db doesn't have: the chord itself
  return all.find((c) => c.suffix === info.dbFallback)?.positions ?? []
}
