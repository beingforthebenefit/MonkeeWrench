import {describe, it, expect} from 'vitest'
import {convertOnSong} from '@/lib/onsong'
import {parseChordPro} from '@/lib/chordpro'

// Invented words: real songs' lyrics don't belong in a test file
const song = (content: string) =>
  convertOnSong({title: 'Test Song', byline: 'Test Band', key: 'G', content})

describe('OnSong import', () => {
  it('drops the header and keeps the part notes for the player', () => {
    const r = song(
      [
        'Test Song',
        'Test Band',
        'Key: G',
        '',
        'Piano - Light and airy',
        '',
        '[G]Walking the [C]dog to[D]day',
      ].join('\n'),
    )
    expect(r.partNotes).toEqual(['Piano - Light and airy'])
    expect(r.source).toBe(
      '{title: Test Song}\n{key: G}\n\n[G]Walking the [C]dog to[D]day\n',
    )
  })

  it('merges chords written above the words', () => {
    const r = song('G       C\nWalking the dog\n')
    expect(r.source).toContain('[G]Walking [C]the dog')
  })

  it('names a section by its label or by an instruction above its chords', () => {
    const r = song(
      [
        'CHORUS:',
        '[G]la la [C]la',
        '',
        'intro- sax solo',
        'G   C   D   G',
        '',
        'piano solo',
        '[G] [C] [D]',
      ].join('\n'),
    )
    const c = parseChordPro(r.source)
    expect(c.sections.map((s) => [s.type, s.label, s.note])).toEqual([
      ['chorus', 'Chorus', ''],
      ['intro', 'Intro', 'sax solo'],
      ['solo', 'Piano solo', ''],
    ])
  })

  it('keeps unlabelled paragraphs apart', () => {
    const c = parseChordPro(song('[G]one\n[C]two\n\n[D]three\n').source)
    expect(c.sections).toHaveLength(2)
    expect(c.sections.every((s) => s.type === 'part' && !s.label)).toBe(true)
  })

  it('turns a lone remark into a comment and keeps band notes', () => {
    const r = song('note- intro made longer\n\n[G]la\n\n(softer, hold it)\n')
    expect(r.source).toContain('{comment: note- intro made longer}')
    expect(r.source).toContain('{comment: softer, hold it}')
    expect(r.partNotes).toEqual([])
  })

  it('lifts tab out into its own block', () => {
    const r = song('riff\ne|--0--3--|\nB|--1--1--|\n')
    expect(r.source).toContain(
      '{start_of_tab}\ne|--0--3--|\nB|--1--1--|\n{end_of_tab}',
    )
  })

  it('finds part notes after other header lines, even ones naming chords', () => {
    const r = song(
      'Test Song\nby somebody else\nPiano - Hit the [G] [Em7] swing-y\n\n[G]la\n\norgan\n[C]la\n',
    )
    expect(r.partNotes).toEqual(['Piano - Hit the [G] [Em7] swing-y'])
    expect(r.source).toContain('{comment: by somebody else}')
    // Mid-song it's the band's chart, not a part note
    expect(r.source).toContain('organ')
  })

  it('plays the chords on a label line, and reads {chorus} as a heading', () => {
    const c = parseChordPro(
      song('Intro: [A] [Bm] [A] [Bm]\n[A]la la\n\n{chorus}\n[D]la la\n').source,
    )
    expect(c.sections[0].label).toBe('Intro')
    expect(c.sections[0].note).toBe('')
    expect(c.sections[0].lines[0]).toMatchObject({kind: 'lyrics'})
    expect(c.sections[1]).toMatchObject({type: 'chorus', label: 'Chorus'})
  })

  it('turns written-out horn lines into notation and guitar riffs into tab', () => {
    const r = song(
      [
        'horn line is',
        'B B D# B C# A. B B B B A C#',
        '[B]la la',
        '',
        'guitar plays this 2x',
        '(B B B DD F# E   B A F# B A B)',
        '',
        'D D   C C   G G G G',
      ].join('\n'),
    )
    const c = parseChordPro(r.source)
    expect(c.sections[0]).toMatchObject({type: 'abc', label: 'Horn line is'})
    expect(c.sections[0].abc).toContain('B2 B2 ^d2 B2 ^c2 A2 |')
    expect(c.sections[2]).toMatchObject({
      type: 'tab',
      label: 'Guitar plays this 2x',
    })
    // Four bars of chords with no note-ish label stay chords
    expect(r.source).toContain('[D]')
  })

  it('starts the music at a riff at the very top', () => {
    const r = song('Test Song\nmain riff\n(G G G FF F# G) x4\n\n[G]la\n')
    expect(parseChordPro(r.source).sections[0]).toMatchObject({
      type: 'tab',
      label: 'Main riff',
    })
  })

  it('reads a rule of dashes as a divider, not tab', () => {
    const c = parseChordPro(song('[G]one\n-------\n[C]two\n').source)
    expect(c.sections.map((s) => s.type)).toEqual(['part', 'part'])
  })

  it('keeps a bar-by-bar chord line under an instrument as chords', () => {
    const r = song('solo- guitar\nC  C  C  C  F  F  C  C  F  F  C  C\n')
    expect(r.source).not.toContain('start_of_tab')
    expect(r.source).toContain('[C]')
  })

  it('names a horn line under a guitar solo, and writes it for horns', () => {
    const c = parseChordPro(
      song(
        'solo- guitar\nC  C  C  C  F  F  C  C\nhorn line thru this on these notes\nG C C Eb Eb C C A G.  C C\n',
      ).source,
    )
    const notes = c.sections.find((s) => s.type === 'abc' || s.type === 'tab')
    expect(notes).toMatchObject({
      type: 'abc',
      label: 'Horn line thru this on these notes',
    })
  })

  it('writes a repeated line the way it was written the first time', () => {
    const c = parseChordPro(
      song(
        'horn line is\nB B D# B C# A. B B\n\nRIFF x2 with the riff\nB B D# B C# A. B B\n',
      ).source,
    )
    expect(c.sections.map((s) => s.type)).toEqual(['abc', 'abc'])
  })

  it('follows the instrument a block names over how the line was first written', () => {
    const c = parseChordPro(
      song(
        'guitar plays this 2x\n(B B B DD F# E)\n\nsax comes in, plays this 2x\n(B B B DD F# E)\n\nguitar again x2\n(B B B DD F# E)\n',
      ).source,
    )
    expect(c.sections.map((s) => s.type)).toEqual(['tab', 'abc', 'tab'])
  })
})
