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

  it('keeps repeated sections written out in full', () => {
    expect(chart.sections[2].note).toBe('x2')
    expect(chart.sections[2].lines).toEqual(chart.sections[1].lines)
  })

  it('expands a bare {chorus} into the full last chorus', () => {
    expect(chart.sections[3].note).toBe('fade')
    expect(chart.sections[3].lines).toEqual(chart.sections[2].lines)
    expect(chart.sections[3].lines.length).toBe(1)
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

  it('writes a {chorus} reference out in full', () => {
    const chart = parseChordPro(
      '{start_of_chorus: Chorus}\n[C]la\n{end_of_chorus}\n{chorus}\n',
    )
    expect(chartToChordsOverWords(chart)).toBe(
      '[Chorus]\nC\nla\n\n[Chorus]\nC\nla',
    )
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

describe('importChordsOverWords — colon-style headers', () => {
  const DOC2 = `INTRO: C F Bb F (x4)

#1.
C        Bb C
Walking down the street

CHORUS:AD LIB:
F     Bb F
Hey hey hey

KEYBOARD SOLO: C Bb C Bb (x8)
INTRO: C F C F(x2) C F A7
[Intro] A
[INTRO RIFF 1X] E7
[Bridge - see tablature at bottom]
Some words
`
  const {source} = importChordsOverWords(DOC2, 'T')

  it('turns INTRO: chords into a section with a chord line', () => {
    expect(source).toContain('{start_of_intro: Intro}\n[C] [F] [Bb] [F] (x4)')
  })

  it('turns #1. into Verse 1', () => {
    expect(source).toContain('{start_of_verse: Verse 1}')
  })

  it('keeps a header remark as the note', () => {
    expect(source).toContain('{start_of_chorus: Chorus (Ad Lib)}')
  })

  it('title-cases shouted labels and keeps glued repeats', () => {
    expect(source).toContain('{start_of_solo: Keyboard Solo}')
    expect(source).toContain('[C] [F] [C] [F](x2) [C] [F] [A7]')
    expect(source).toContain('{start_of_intro: Intro Riff 1x}\n[E7]')
  })

  it('moves chords after a bracket header into the section', () => {
    expect(source).toContain('{start_of_intro: Intro}\n[A]')
  })

  it('splits "Label - remark" into label and note', () => {
    expect(source).toContain(
      '{start_of_bridge: Bridge (see tablature at bottom)}',
    )
  })

  it('does not treat ordinary lyrics with a colon as a header', () => {
    const {source: s} = importChordsOverWords(
      '[Verse]\nG\nShe said: go home\n',
      'T',
    )
    expect(s).toContain('[G]She said: go home')
  })
})

describe('tablature', () => {
  const DOC3 = `[Intro] A

e|------------|
G|------------| x2
D|---7----5p4p0|

[Verse 1]
A       G
Words here
`
  const {source} = importChordsOverWords(DOC3, 'T')

  it('wraps tab lines in a tab block, verbatim', () => {
    expect(source).toContain(
      '{start_of_tab}\ne|------------|\nG|------------| x2\nD|---7----5p4p0|\n{end_of_tab}',
    )
  })

  it('parses tab lines as tab, not lyrics', () => {
    const chart = parseChordPro(source)
    const tab = chart.sections.find((s) => s.type === 'tab')!
    expect(tab.lines[2]).toEqual({kind: 'tab', text: 'D|---7----5p4p0|'})
    expect(chart.sections.find((s) => s.label === 'Verse 1')).toBeTruthy()
  })
})

describe('parenthesised and bass-only chords', () => {
  it('counts them as chords and transposes them, keeping the wrapping', () => {
    expect(isChord('(B)')).toBe(true)
    expect(isChord('(C')).toBe(true)
    expect(isChord('/G')).toBe(true)
    expect(isChord('REPEAT')).toBe(false)
    expect(transposeChord('(B)', 2)).toBe('(C#)')
    expect(transposeChord('(C', 2)).toBe('(D')
    expect(transposeChord('/G', 2)).toBe('/A')
    expect(transposeChord('G7),', 2)).toBe('A7),')
  })

  it('reads a chord line with a bass-only change as chords, not lyrics', () => {
    const {source} = importChordsOverWords(
      '[Intro]\nA         /G     D/F#       Esus4\n',
      'T',
    )
    expect(source).toContain('[A]')
    expect(source).toContain('[/G]')
    expect(source).toContain('[D/F#]')
  })
})

describe('remarks and bare tab lines in imports', () => {
  it('keeps a bracketed remark in a chord line as one note', () => {
    const {source} = importChordsOverWords(
      '[Intro]\nA    F#   B   Bmaj7 [hold 4 bars]\n',
      'T',
    )
    expect(source).toContain('[A]')
    expect(source).toContain('[Bmaj7]')
    expect(source).toContain('[(hold 4 bars)]')
  })

  it('keeps a remark with nested parentheses whole', () => {
    const {source} = importChordsOverWords(
      '[V]\nE      (organ fill: E A/E E7(no3) A/E)\nla la\n',
      'T',
    )
    expect(source).toContain('[(organ fill: E A/E E7(no3) A/E)]')
  })

  it('treats bare tab staff lines as tablature', () => {
    const {source} = importChordsOverWords(
      '[Break]\n  -9-7---4-2-------|\n  -----------4-2-0-|\n',
      'T',
    )
    expect(source).toContain('{start_of_tab}')
  })

  it('reads a lone parenthesised chord at the end of a chord line as a chord', () => {
    const {source} = importChordsOverWords(
      '[V]\nE      B      (B)\nla la la la la la\n',
      'T',
    )
    expect(source).toContain('[(B)]')
  })

  it('still reads a parenthesised chord group as chords', () => {
    const {source} = importChordsOverWords(
      '[V]\nC  (C F G7 x2)\nla la la la la la la\n',
      'T',
    )
    expect(source).toMatch(/\[\(C\]/)
    expect(source).toContain('[G7]')
  })
})

describe('notation sections ({start_of_abc})', () => {
  const src = [
    '{key: G}',
    '{start_of_abc: Horn riff}',
    'K:G',
    '"G"g2 fe d2 BG |',
    '',
    '"D"A8 |]',
    '{end_of_abc}',
    '{start_of_verse}',
    '[G]la',
    '{end_of_verse}',
  ].join('\n')

  it('keeps the notation verbatim, blank lines and all', () => {
    const c = parseChordPro(src)
    expect(c.sections[0]).toMatchObject({
      type: 'abc',
      label: 'Horn riff',
      lines: [],
      abc: 'K:G\n"G"g2 fe d2 BG |\n\n"D"A8 |]',
    })
  })

  it('has no heading unless given one', () => {
    const c = parseChordPro('{start_of_abc}\n"C"C8 |]\n{end_of_abc}')
    expect(c.sections).toHaveLength(1)
    expect(c.sections[0].label).toBe('')
  })

  it('counts how far the chart is transposed, for the notation to follow', () => {
    const up = transposeChart(transposeChart(parseChordPro(src), 2), 3)
    expect(up.sections[0].abcSteps).toBe(5)
    expect(up.sections[0].abc).toContain('"G"g2')
  })

  it('shows the ABC text in history diffs', () => {
    expect(chartToChordsOverWords(parseChordPro(src))).toContain(
      '[Horn riff]\nK:G\n"G"g2 fe d2 BG |',
    )
  })
})
