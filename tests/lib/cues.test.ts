import {describe, it, expect} from 'vitest'
import {parseChordPro} from '@/lib/chordpro'
import {anchorLabel, placeCues, sectionAnchors, type Cue} from '@/lib/cues'

const chart = parseChordPro(
  [
    '{start_of_verse: Verse 1}',
    '[C]one',
    '{end_of_verse}',
    '{start_of_chorus}',
    '[F]chorus',
    '{end_of_chorus}',
    '{start_of_verse: Verse 2}',
    '[C]two',
    '{end_of_verse}',
    '{chorus}',
  ].join('\n'),
)

const cue = (id: string, anchor: string, position = 0): Cue => ({
  id,
  anchor,
  position,
  kind: 'TEXT',
  text: id,
  image: null,
})

describe('cues', () => {
  it('names each section by label and which time it comes round', () => {
    expect(sectionAnchors(chart)).toEqual([
      'verse 1#1',
      'chorus#1',
      'verse 2#1',
      'chorus#2',
    ])
    expect(anchorLabel('chorus#2', chart)).toBe('Chorus 2')
    expect(anchorLabel('verse 1#1', chart)).toBe('Verse 1')
    expect(anchorLabel('')).toBe('Top of the song')
  })

  it('puts cues on their section, in order', () => {
    const p = placeCues(chart, [
      cue('b', 'chorus#2', 1),
      cue('a', 'chorus#2', 0),
      cue('t', ''),
    ])
    expect(p.top.map((c) => c.id)).toEqual(['t'])
    expect(p.sections.get(3)?.map((c) => c.id)).toEqual(['a', 'b'])
    expect(p.lost).toEqual([])
  })

  it("keeps a cue whose section was edited away, so it isn't lost", () => {
    const p = placeCues(chart, [cue('x', 'bridge#1')])
    expect(p.lost.map((c) => c.id)).toEqual(['x'])
  })
})
