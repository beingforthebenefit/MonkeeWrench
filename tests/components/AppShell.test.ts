import {describe, expect, it} from 'vitest'
import {isActive} from '@/components/AppShell'

describe('the menu tab for a page', () => {
  it('is the section the page is in', () => {
    expect(isActive('/songs', '/songs')).toBe(true)
    expect(isActive('/songs/s1/edit', '/songs')).toBe(true)
    expect(isActive('/setlists/x', '/songs')).toBe(false)
  })

  it('is the one each of the tour’s sample pages stands in for', () => {
    expect(isActive('/tour/song', '/songs')).toBe(true)
    expect(isActive('/tour/edit', '/songs')).toBe(true)
    expect(isActive('/tour/setlist', '/setlists')).toBe(true)
    expect(isActive('/tour/setlist', '/songs')).toBe(false)
  })
})
