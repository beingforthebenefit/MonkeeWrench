import {describe, it, expect} from 'vitest'
import {describeSetChanges, SetlistBody} from '@/lib/setlists'

const s = (songId: string) => ({songId, title: songId.toUpperCase()})

describe('describeSetChanges', () => {
  it('reports additions, removals and reordering', () => {
    expect(
      describeSetChanges([s('a'), s('b'), s('c')], [s('c'), s('a'), s('d')]),
    ).toEqual(['added D', 'removed B', 'changed the order'])
  })

  it('reports nothing when the list is the same', () => {
    expect(describeSetChanges([s('a'), s('b')], [s('a'), s('b')])).toEqual([])
  })
})

describe('SetlistBody', () => {
  it('accepts an empty gig date as null and rejects a bad one', () => {
    expect(SetlistBody.parse({name: 'X', gigDate: ''}).gigDate).toBeNull()
    expect(SetlistBody.safeParse({name: 'X', gigDate: 'nope'}).success).toBe(
      false,
    )
  })
})
