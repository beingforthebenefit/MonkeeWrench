import {describe, it, expect} from 'vitest'
import {abcPresets, withAbcHeader} from '@/lib/abc'

describe('abc', () => {
  it('adds the header ABC needs, in the song key', () => {
    expect(withAbcHeader('"G"B4 B4 |]', 'G')).toBe(
      'X:1\nM:4/4\nL:1/8\nK:G\n"G"B4 B4 |]',
    )
  })

  it('keeps what was typed', () => {
    expect(withAbcHeader('M:3/4\nK:Am style=rhythm\nB6 |]', 'C')).toBe(
      'X:1\nL:1/8\nM:3/4\nK:Am style=rhythm\nB6 |]',
    )
  })

  it('writes the starter patterns in the song key', () => {
    const p = abcPresets('G')
    expect(p[0].abc).toContain('K:G style=rhythm')
    expect(p[0].abc).toContain('"G"')
    expect(p[0].abc).toContain('"D"')
    expect(p.find((x) => x.name === 'A melody line')!.abc).toContain('"G"G2 AB')
  })
})
