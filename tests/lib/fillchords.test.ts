import {describe, it, expect} from 'vitest'
import {fillMissingChords} from '@/lib/fillchords'

describe('fillMissingChords', () => {
  const verse1 = [
    "[Cm7]Please baby, [F]let's get it [Cm7]right",
    "I don't [Cm7]think, I can take it, [F]one more [Cm7]night",
    'Though the stars are [Cm7]mine',
  ]
  it('gives a bare verse the chords of the verse it parallels', () => {
    const src = [
      ...verse1,
      '',
      "[Cm7]Please baby, [F]let's not fight",
      "I don't think, I can take it, one more night",
      'Though the stars are mine',
    ].join('\n')
    const {source, filled} = fillMissingChords(src)
    expect(source.split('\n').slice(4)).toEqual([
      "[Cm7]Please baby, [F]let's not fight",
      "I don't [Cm7]think, I can take it, [F]one more [Cm7]night",
      'Though the stars are [Cm7]mine',
    ])
    expect(filled.length).toBeGreaterThan(0)
  })

  it('leaves a stanza alone when it does not parallel a charted one', () => {
    const src = [
      ...verse1,
      '',
      'Hi-de-hi',
      'Ho-de-ho-de-ho-de-ho, ho-de-ho',
      'Whoa',
      'Another line here',
    ].join('\n')
    expect(fillMissingChords(src).source).toBe(src)
  })

  it('never touches notation', () => {
    const src = [
      ...verse1,
      '',
      '{start_of_abc}',
      'Though the stars are mine',
      '{end_of_abc}',
    ].join('\n')
    expect(fillMissingChords(src).source).toBe(src)
  })

  it('puts chords after the last word at the end of the line', () => {
    const src = ['Hey now [G]baby [C] [D]', 'x', '', 'Hey now baby'].join('\n')
    expect(fillMissingChords(src).source.split('\n')[3]).toBe(
      'Hey now [G]baby [C] [D]',
    )
  })
})
