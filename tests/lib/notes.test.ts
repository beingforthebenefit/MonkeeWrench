import {describe, it, expect} from 'vitest'
import {linesToAbc, lineToTab, readNoteLine} from '@/lib/notes'

describe('written-out notes', () => {
  it('reads letters, quick pairs, phrase ends and repeats', () => {
    const w = readNoteLine('(G G G FF F# G) x4')!
    expect(w.repeats).toBe('x4')
    expect(
      w.notes.map((n) => n.letter + n.acc + (n.eighth ? '8' : '')),
    ).toEqual(['G', 'G', 'G', 'F8', 'F8', 'F#', 'G'])
    expect(readNoteLine('B B D# B C# A. B B')!.notes[5].phraseEnd).toBe(true)
  })

  it('is not fooled by words or chord names', () => {
    expect(readNoteLine('horn line is')).toBeNull()
    expect(readNoteLine('Bm A G#m E')).toBeNull()
    expect(readNoteLine('G C')).toBeNull() // too short to be a line
  })

  it('writes ABC in the key, spelling accidentals as written', () => {
    const abc = linesToAbc([readNoteLine('B B D# B C# A. B B B B A C#')!], 'B')
    expect(abc).toContain('K:B')
    // D# and C# come from the key; A natural needs its sign
    expect(abc).toContain('B2 B2 d2 B2 c2 =A2 | B2')
  })

  it('writes a bass part in bass clef, around B2', () => {
    const abc = linesToAbc([readNoteLine('B B D E F# A')!], 'B', 'bass')
    expect(abc).toContain('% instrument: bass')
    expect(abc).toContain('K:B clef=bass')
    expect(abc).toContain('B,,2 B,,2 =D,2 E,2 F,2 =A,2')
  })

  it('cancels an accidental later in the same bar', () => {
    const abc = linesToAbc([readNoteLine('(c# c c# c c# b a)')!], 'C')
    expect(abc).toMatch(/\^c2 =c2 \^c2 =c2 \^c2/)
  })

  it('writes guitar tab in one hand position', () => {
    const tab = lineToTab(readNoteLine('(G G G FF F# G)')!)
    expect(tab).toHaveLength(6)
    expect(tab[5]).toBe('E|-3--3--3--1-1-2--3--|')
  })
})
