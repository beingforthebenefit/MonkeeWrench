import React from 'react'
import {describe, it, expect} from 'vitest'
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SongLibrary, {type LibrarySong} from '@/components/SongLibrary'

const song = (p: Partial<LibrarySong>): LibrarySong => ({
  id: p.title ?? 'x',
  title: 'x',
  leadSinger: null,
  writer: null,
  ready: false,
  key: 'G',
  hasChart: true,
  editedBy: 'Alan',
  editedAt: '2026-10-05T00:00:00Z',
  ...p,
})

const songs = [
  song({title: 'Daydream Believer', leadSinger: 'Davy', ready: true}),
  song({title: 'Mary, Mary', leadSinger: 'Micky', hasChart: false, key: null}),
  song({title: 'Valleri', leadSinger: 'Davy'}),
]

describe('SongLibrary', () => {
  it('filters by search text across title and singer', async () => {
    render(<SongLibrary songs={songs} />)
    await userEvent.type(screen.getByLabelText('Search songs'), 'davy')
    expect(screen.getByText('Daydream Believer')).toBeInTheDocument()
    expect(screen.getByText('Valleri')).toBeInTheDocument()
    expect(screen.queryByText('Mary, Mary')).not.toBeInTheDocument()
  })

  it('filters to gig-ready and to songs needing a chart', async () => {
    render(<SongLibrary songs={songs} />)
    await userEvent.click(screen.getByRole('button', {name: 'Gig-ready'}))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', {name: 'Needs chart'}))
    expect(screen.getByText('Mary, Mary')).toBeInTheDocument()
    expect(screen.queryByText('Valleri')).not.toBeInTheDocument()
  })

  it('filters to songs being learned: a chart, not gig-ready', async () => {
    render(<SongLibrary songs={songs} />)
    await userEvent.click(screen.getByRole('button', {name: 'Learning'}))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('Valleri')).toBeInTheDocument()
  })

  it('shows the summary counts', () => {
    render(<SongLibrary songs={songs} />)
    expect(
      screen.getByText('3 songs · 1 gig-ready · 1 learning · 1 need charts'),
    ).toBeInTheDocument()
  })
})
