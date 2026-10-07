import {describe, it, expect} from 'vitest'
import {SongFields, describeChanges} from '@/lib/song-fields'

describe('SongFields', () => {
  it('turns blank text into null and rejects bad links', () => {
    expect(SongFields.parse({writer: '  '}).writer).toBeNull()
    expect(SongFields.safeParse({youtubeUrl: 'not a url'}).success).toBe(false)
    expect(SongFields.parse({youtubeUrl: ''}).youtubeUrl).toBeNull()
  })
})

describe('describeChanges', () => {
  it('names only fields that changed', () => {
    const before = {title: 'A', leadSinger: 'Davy', status: 'LEARNING'}
    expect(
      describeChanges(before, {
        title: 'A',
        leadSinger: 'Micky',
        status: 'READY',
      }),
    ).toEqual(['lead singer', 'status to gig-ready'])
  })
})
