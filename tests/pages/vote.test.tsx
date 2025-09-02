import React from 'react'
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Vote from '@/app/(protected)/vote/page'
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
})
