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

describe('abcTabInstrument', () => {
  it('reads the instrument hint for the tab view', async () => {
    const {abcTabInstrument} = await import('@/lib/abc')
    expect(abcTabInstrument('% instrument: bass\nK:E\nE2 G2 |]')).toBe('bass')
    expect(abcTabInstrument('% instrument: guitar\nK:E\nE2 |]')).toBe('guitar')
    expect(abcTabInstrument('% instrument: keys\nK:E\nE2 |]')).toBe('keys')
    expect(abcTabInstrument('K:E\nE2 |]')).toBe('guitar')
    const {abcPart} = await import('@/lib/abc')
    expect(abcPart('K:E\nE2 |]')).toBeNull()
    expect(abcPart('% instrument: guitar\nK:E\nE2 |]')).toBe('guitar')
  })
})
