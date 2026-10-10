import {describe, expect, it} from 'vitest'
import {readSetlistText} from '@/lib/import/setlist-text'
import {parseCsv, readLength} from '@/lib/import/song-list'

describe('a pasted setlist', () => {
  const titles = [
    'Proud Mary',
    'The Weight',
    'Mustang Sally',
    "Ain't No Sunshine",
  ]
  it('reads sets, breaks, keys and numbering; matches titles loosely', () => {
    const r = readSetlistText(
      'Riverside',
      'Set 1\n1. proud mary [D]\n2) Weight\n- aint no sunshine (in Am)\n\nBreak 15\nSet 2 (45 min)\nMustang Sally\nFree Bird\nEncore\n',
      titles,
    )
    expect(r.setlist).toEqual({
      name: 'Riverside',
      items: [
        {set: 'Set 1', minutes: null},
        {song: 'Proud Mary', key: 'D'},
        {song: 'The Weight', key: null},
        {song: "Ain't No Sunshine", key: 'Am'},
        {break: 15},
        {set: 'Set 2', minutes: 45},
        {song: 'Mustang Sally', key: null},
        {set: 'Encore', minutes: null},
      ],
    })
    expect(r.unknown).toEqual(['Free Bird'])
  })
})

describe('CSV', () => {
  it('handles quotes, commas, escaped quotes and tabs', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ])
    expect(parseCsv('a\tb\nc\td')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })
  it('reads lengths as m:ss or minutes', () => {
    expect(readLength('3:45')).toBe(225)
    expect(readLength('4')).toBe(240)
    expect(readLength('long')).toBeNull()
  })
})
