import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {render, screen, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Proposals from '@/components/Proposals'
import type {Board} from '@/lib/proposals'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({useRouter: () => ({refresh})}))

const board: Board = {
  threshold: 3,
  pending: [
    {
      id: 'p1',
      title: 'Monkey Man',
      artist: 'Stones',
      youtubeUrl: 'https://youtu.be/x',
      lyricsUrl: null,
      proposer: 'Ed',
      proposedAt: '2026-10-01T00:00:00Z',
      voters: ['Ed', 'Ken'],
      mine: false,
    },
  ],
  approved: [
    {
      id: 'p2',
      title: 'Ape Man',
      artist: 'Kinks',
      approvedAt: '2026-10-02T00:00:00Z',
      songId: 's2',
    },
  ],
  archived: [],
}

describe('Proposals', () => {
  beforeEach(() => {
    refresh.mockReset()
    globalThis.fetch = vi.fn(
      async () => new Response(null, {status: 204}),
    ) as any
  })

  it('shows who voted and how many more are needed', () => {
    render(<Proposals board={board} isAdmin={false} />)
    expect(screen.getByText(/Ed, Ken · 1 more to add it/)).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Chart ›'})).toHaveAttribute(
      'href',
      '/songs/s2',
    )
  })

  it('votes with one tap and refreshes', async () => {
    render(<Proposals board={board} isAdmin={false} />)
    await userEvent.click(screen.getByRole('button', {name: 'Vote'}))
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/proposals/p1/vote', {
      method: 'POST',
    })
    expect(refresh).toHaveBeenCalled()
  })

  it('gives admins "add to the book now"', async () => {
    const {rerender} = render(<Proposals board={board} isAdmin={false} />)
    expect(screen.queryByText('Add to the book now')).not.toBeInTheDocument()
    rerender(<Proposals board={board} isAdmin />)
    const item = screen.getAllByRole('listitem')[0]
    await userEvent.click(
      within(item).getByRole('button', {name: 'More for Monkey Man'}),
    )
    await userEvent.click(within(item).getByText('Add to the book now'))
    expect((globalThis.fetch as any).mock.calls[0][0]).toBe('/api/proposals/p1')
    expect(JSON.parse((globalThis.fetch as any).mock.calls[0][1].body)).toEqual(
      {status: 'APPROVED'},
    )
  })

  it('keeps the vote button on the title row after voting', () => {
    const voted = {
      ...board,
      pending: [{...board.pending[0], mine: true, voters: ['Ed', 'Ken', 'Me']}],
    }
    render(<Proposals board={voted} isAdmin />)
    const vote = screen.getByRole('button', {name: 'Voted ✓'})
    // The actions never wrap under the title: the row does not wrap at all
    expect(vote.parentElement?.className).toContain('shrink-0')
    expect(vote.parentElement?.parentElement?.className).not.toContain(
      'flex-wrap',
    )
  })
})
