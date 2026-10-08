import React from 'react'
import {describe, it, expect, vi} from 'vitest'
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Perform from '@/components/Perform'

vi.mock('next/link', () => ({
  default: ({children, ...p}: any) => <a {...p}>{children}</a>,
}))

const songs = [
  {
    id: 's1',
    title: 'Invented Song',
    leadSinger: null,
    source: '{start_of_verse: Verse 1}\n[C]la la [G]la\n{end_of_verse}\n',
    key: null,
    note: null,
    cues: [
      {
        id: 'c1',
        anchor: 'verse 1#1',
        position: 0,
        kind: 'TEXT' as const,
        text: 'Drums only first time',
        image: null,
      },
    ],
  },
]

// jsdom has no scrolling; scroll mode jumps to the top of each song
window.scrollTo = vi.fn() as any

describe('Perform', () => {
  it('switches between pages and scroll, and remembers the choice', async () => {
    localStorage.clear()
    // jsdom's matchMedia matches nothing, so this is a wide screen: pages
    render(<Perform setId="x" name="Set" songs={songs} />)
    await userEvent.click(screen.getByRole('button', {name: /one scrolling/}))
    expect(localStorage.getItem('mw:perform-mode')).toBe('"scroll"')
    await userEvent.click(screen.getByRole('button', {name: 'Show as pages'}))
    expect(localStorage.getItem('mw:perform-mode')).toBe('"pages"')
    localStorage.clear()
  })

  it('shows your cues on the chart, under their section', () => {
    localStorage.clear()
    render(<Perform setId="y" name="Set" songs={songs} />)
    expect(screen.getByText('Drums only first time')).toBeInTheDocument()
  })

  it('marks the end of a song that fits on one page', () => {
    localStorage.clear()
    render(<Perform setId="z" name="Set" songs={songs} />)
    // jsdom lays nothing out, so the song is one page: no "More"
    expect(screen.getByText('End')).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: 'More ›'})).toBeNull()
  })
})
