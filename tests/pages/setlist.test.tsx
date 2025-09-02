import React from 'react'
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {screen, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SetlistPage from '@/app/setlist/page'
import {renderWithProviders} from '../utils'

// Use global next-auth mock; default unauthenticated, but SetlistPage only uses isAdmin
import {setMockSession} from '../utils'

describe('Setlist page', () => {
  const originalFetch = global.fetch
  beforeEach(() => {
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/proposals/approved' && (!init || !init.method)) {
        return new Response(
          JSON.stringify([
            {
              id: 'a',
              title: 'I’m a Believer',
              artist: 'The Monkees',
              chartUrl: null,
              lyricsUrl: null,
              youtubeUrl: null,
              updatedAt: new Date().toISOString(),
              setlistOrder: 1,
            },
            {
              id: 'b',
              title: 'Daydream Believer',
              artist: 'The Monkees',
              chartUrl: null,
              lyricsUrl: null,
              youtubeUrl: null,
              updatedAt: new Date().toISOString(),
              setlistOrder: 2,
            },
          ]),
          {status: 200, headers: {'Content-Type': 'application/json'}},
        )
      }
      if (url === '/api/setlist/reorder' && init?.method === 'PATCH') {
        // Ensure body contains the ids
        const body = JSON.parse(String(init.body || '{}'))
        expect(body.ids).toEqual(['a', 'b'])
        return new Response(JSON.stringify({ok: true}), {
          status: 200,
          headers: {'Content-Type': 'application/json'},
        })
      }
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      })
    }) as unknown as typeof fetch
  })
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('saves order on Save', async () => {
    const user = userEvent.setup()
    setMockSession({data: {user: {isAdmin: true}}, status: 'authenticated'})
    renderWithProviders(<SetlistPage />)
    // Wait for table view to contain the item (avoid mobile duplicate)
    const table = await screen.findByRole('table')
    await within(table).findByText(/I’m a Believer/i)
    await user.click(screen.getByRole('button', {name: 'Reorder'}))
    await user.click(screen.getByRole('button', {name: 'Save order'}))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/setlist/reorder',
      expect.objectContaining({method: 'PATCH'}),
    )
  })

  it('shows error when load fails', async () => {
    const originalFetch = global.fetch
    global.fetch = vi.fn(async (url: string) => {
      if (url === '/api/proposals/approved') {
        throw new Error('boom')
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      })
    }) as any
    renderWithProviders(<SetlistPage />)
    expect(
      await screen.findByText(/Failed to load setlist/i),
    ).toBeInTheDocument()
    global.fetch = originalFetch
  })
})
