import {describe, it, expect} from 'vitest'
import {chordInfo, guitarPositions} from '@/lib/chordtones'

describe('chordInfo', () => {
  it('reads a chord name into its notes', () => {
    expect(chordInfo('C')?.notes).toEqual(['C', 'E', 'G'])
    expect(chordInfo('Cm7')?.notes).toEqual(['C', 'Eb', 'G', 'Bb'])
    expect(chordInfo('F#m7b5')?.notes).toEqual(['F#', 'A', 'C', 'E'])
    expect(chordInfo('Bb13')?.notes).toEqual(['Bb', 'D', 'F', 'Ab', 'C', 'G'])
    expect(chordInfo('Emaj7')?.notes).toEqual(['E', 'G#', 'B', 'D#'])
    expect(chordInfo('B9sus4')?.notes).toEqual(['B', 'E', 'F#', 'A', 'C#'])
  })

  it('keeps the bass of a slash chord', () => {
    const c = chordInfo('C7/G')!
    expect(c.bassName).toBe('G')
    expect(c.dbSuffix).toBe('7')
    expect(chordInfo('D/F#')?.dbSuffix).toBe('/F#')
  })

  it('is not fooled by things that are not chords', () => {
    expect(chordInfo('BREAK')).toBeNull()
    expect(chordInfo('C-Bb-G')).toBeNull()
    expect(chordInfo('/')).toBeNull()
  })

  it('finds guitar fingerings, sharps and flats alike', async () => {
    const [c] = await guitarPositions(chordInfo('C')!)
    expect(c.frets).toEqual([-1, 3, 2, 0, 1, 0])
    expect((await guitarPositions(chordInfo('Db7')!)).length).toBeGreaterThan(0)
    expect((await guitarPositions(chordInfo('A7/G')!)).length).toBeGreaterThan(
      0,
    )
  })
})
