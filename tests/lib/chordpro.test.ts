import {describe, it, expect} from 'vitest'
import {
  parseChordPro,
  transposeChord,
  transposeKey,
  transposeChart,
  detectKey,
  importChordsOverWords,
  mergeChordLine,
  chartToChordsOverWords,
  splitLabel,
  semitonesBetween,
  isChord,
} from '@/lib/chordpro'

// Lyrics here are invented: real charts are copyrighted and stay out of the repo.
const DOC = `##  Test Song

\\[Intro\\]

G    D7sus4    G    D7sus4

\\[Verse 1\\]

              G           Am
We walk along the morning road
       Bm              C
And carry all the things we owe

\\[Chorus\\] (x2, 2nd time fade out)

C        D      Bm
Sing it once again
`

describe('importChordsOverWords', () => {
  const {source, key} = importChordsOverWords(DOC, 'Test Song')

  it('turns headers into sections and keeps the note', () => {
    expect(source).toContain('{title: Test Song}')
    expect(source).toContain('{start_of_intro: Intro}')
    expect(source).toContain('{start_of_verse: Verse 1}')
    expect(source).toContain(
      '{start_of_chorus: Chorus (x2, 2nd time fade out)}',
    )
    expect(source).toContain('{end_of_chorus}')
  })

  it('places chords at their columns in the lyric', () => {
    expect(source).toContain('We walk along [G]the morning [Am]road')
  })

  it('keeps chord-only lines', () => {
    expect(source).toMatch(/\[G\]\s+\[D7sus4\]\s+\[G\]\s+\[D7sus4\]/)
  })

  it('drops the markdown title and detects the key', () => {
    expect(source).not.toContain('##')
    expect(key).toBe('G')
  })
})

describe('mergeChordLine', () => {
  it('pads a short lyric so late chords still land', () => {
    expect(mergeChordLine('A    D', 'Hi')).toBe('[A]Hi   [D]')
  })
})

describe('parseChordPro', () => {
  const src = `{title: X}
{key: G}
{start_of_verse: Verse 1}
Oh [G]hello [Am]there
{end_of_verse}
{start_of_chorus: Chorus}
[C]La la [D]la
{end_of_chorus}
{start_of_chorus: Chorus (x2)}
[C]La la [D]la
{end_of_chorus}
{chorus: Chorus (fade)}
`
  const chart = parseChordPro(src)

  it('reads title, key and sections', () => {
    expect(chart.title).toBe('X')
    expect(chart.key).toBe('G')
    expect(chart.sections.map((s) => s.label)).toEqual([
      'Verse 1',
      'Chorus',
      'Chorus',
      'Chorus',
    ])
  })

  it('splits lyric lines into chord/lyric segments', () => {
    const line = chart.sections[0].lines[0]
    expect(line).toEqual({
      kind: 'lyrics',
      segments: [
        {chord: null, lyric: 'Oh '},
        {chord: 'G', lyric: 'hello '},
        {chord: 'Am', lyric: 'there'},
      ],
    })
  })

  it('marks identical and {chorus} sections as repeats', () => {
    expect(chart.sections[2].repeatOf).toBe(1)
    expect(chart.sections[2].note).toBe('x2')
    expect(chart.sections[3].repeatOf).toBe(2)
    expect(chart.sections[3].lines).toEqual([])
  })
})

describe('transposition', () => {
  it('moves roots and slash bass', () => {
    expect(transposeChord('G', 2)).toBe('A')
    expect(transposeChord('D7sus4', 2)).toBe('E7sus4')
    expect(transposeChord('C/G', 2)).toBe('D/A')
    expect(transposeChord('Bm', 1, true)).toBe('C' + 'm')
    expect(transposeChord('A', 1, true)).toBe('Bb')
    expect(transposeChord('N.C.', 3)).toBe('N.C.')
  })

  it('spells keys conventionally', () => {
    expect(transposeKey('G', 3)).toBe('Bb')
    expect(transposeKey('G', -1)).toBe('F#')
    expect(transposeKey('Am', 1)).toBe('Bbm')
    expect(transposeKey('Am', 4)).toBe('C#m')
  })

  it('uses flats when the target key is a flat key', () => {
    const chart = parseChordPro('{key: G}\n[G]a [D]b [Em]c\n')
    const up3 = transposeChart(chart, 3)
    expect(up3.key).toBe('Bb')
    const segs = (
      up3.sections[0].lines[0] as {segments: {chord: string | null}[]}
    ).segments
    expect(segs.map((s) => s.chord)).toEqual(['Bb', 'F', 'Gm'])
  })

  it('detects the key from the first chord when there is no directive', () => {
    expect(detectKey(parseChordPro('[Em]x [G]y'))).toBe('Em')
  })

  it('counts semitones between keys', () => {
    expect(semitonesBetween('G', 'A')).toBe(2)
    expect(semitonesBetween('A', 'G')).toBe(10)
  })
})

describe('chartToChordsOverWords', () => {
  it('round-trips a line back to aligned text', () => {
    const chart = parseChordPro(
      '{start_of_verse: Verse}\nWe walk [G]along the [Am]road\n{end_of_verse}\n',
    )
    expect(chartToChordsOverWords(chart)).toBe(
      '[Verse]\n        G         Am\nWe walk along the road',
    )
  })

  it('writes a repeat reference as "as above"', () => {
    const chart = parseChordPro(
      '{start_of_chorus: Chorus}\n[C]la\n{end_of_chorus}\n{chorus}\n',
    )
    expect(chartToChordsOverWords(chart)).toContain('[Chorus]\n(as above)')
  })
})

describe('splitLabel', () => {
  it('handles label="…" and parenthesised notes', () => {
    expect(splitLabel('label="Verse 2"')).toEqual({label: 'Verse 2', note: ''})
    expect(splitLabel('Outro (fade)')).toEqual({label: 'Outro', note: 'fade'})
  })
})

describe('isChord', () => {
  it('accepts chord vocabulary and rejects words', () => {
    for (const c of [
      'G',
      'Am7',
      'D7sus4',
      'Cmaj7',
      'F#m7b5',
      'Bb/D',
      'E(add9)',
    ])
      expect(isChord(c)).toBe(true)
    for (const w of ['Chorus', 'Bridge', 'Ah', 'Got', 'Elec'])
      expect(isChord(w)).toBe(false)
  })
})
