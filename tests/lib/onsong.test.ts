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
})
