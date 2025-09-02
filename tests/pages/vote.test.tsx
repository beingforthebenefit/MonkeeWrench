import React from 'react'
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Vote from '@/app/vote/page'
import {renderWithProviders} from '../utils'

import {setMockSession} from '../utils'

describe('Vote page', () => {
  const originalFetch = global.fetch
  beforeEach(() => {
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/proposals/pending' && (!init || !init.method)) {
        return new Response(
          JSON.stringify([
            {
              id: 'p1',
              title: 'Last Train to Clarksville',
              artist: 'The Monkees',
              votes: 1,
              mine: false,
              threshold: 2,
            },
          ]),
          {status: 200, headers: {'Content-Type': 'application/json'}},
        )
      }
      if (url === '/api/proposals/p1/vote' && init?.method === 'POST') {
        return new Response(null, {status: 204})
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      })
    }) as unknown as typeof fetch
  })
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('loads items and allows voting', async () => {
    const user = userEvent.setup()
    setMockSession({data: {user: {isAdmin: false}}, status: 'authenticated'})
    renderWithProviders(<Vote />)
    // Wait for item to appear
    await screen.findByText(/Last Train to Clarksville/i)
    const btn = screen.getByRole('button', {name: 'Vote'})
    await user.click(btn)
    expect(global.fetch).toHaveBeenCalledWith('/api/proposals/p1/vote', {
      method: 'POST',
    })
  })

  it('supports unvote when mine=true', async () => {
    const originalFetch = global.fetch
    const user = userEvent.setup()
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/proposals/pending' && (!init || !init.method)) {
        return new Response(
          JSON.stringify([
            {
              id: 'p1',
              title: 'Song',
              artist: 'A',
              votes: 2,
              mine: true,
              threshold: 2,
            },
          ]),
          {status: 200, headers: {'Content-Type': 'application/json'}},
        )
      }
      return new Response(null, {status: 204})
    }) as any
    setMockSession({data: {user: {isAdmin: false}}, status: 'authenticated'})
    renderWithProviders(<Vote />)
    await screen.findByText(/Song — A/)
    await user.click(screen.getByRole('button', {name: 'Unvote'}))
    expect(global.fetch).toHaveBeenCalledWith('/api/proposals/p1/vote', {
      method: 'DELETE',
    })
    global.fetch = originalFetch
  })

  it('admin can delete a request', async () => {
    const originalFetch = global.fetch
    const confirmOrig = global.confirm
    // @ts-expect-error jsdom typing
    global.confirm = () => true
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/proposals/pending' && (!init || !init.method)) {
        return new Response(
          JSON.stringify([
            {
              id: 'p2',
              title: 'To Remove',
              artist: 'B',
              votes: 0,
              mine: false,
              threshold: 2,
            },
          ]),
          {status: 200, headers: {'Content-Type': 'application/json'}},
        )
      }
      return new Response(null, {status: 204})
    }) as any
    setMockSession({data: {user: {isAdmin: true}}, status: 'authenticated'})
    const user = userEvent.setup()
    renderWithProviders(<Vote />)
    await screen.findByText(/To Remove/)
    await user.click(screen.getByRole('button', {name: 'Delete'}))
    expect(global.fetch).toHaveBeenCalledWith('/api/proposals/p2', {
      method: 'DELETE',
    })
    global.fetch = originalFetch
    // @ts-expect-error jsdom typing
    global.confirm = confirmOrig
  })
})
