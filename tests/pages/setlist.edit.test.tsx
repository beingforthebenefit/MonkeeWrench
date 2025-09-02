import React from 'react'
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SetlistPage from '@/app/setlist/page'
import {renderWithProviders, setMockSession} from '../utils'

describe('Setlist page editing', () => {
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
              chartUrl: 'https://example.com/chart',
              lyricsUrl: null,
              youtubeUrl: null,
              updatedAt: new Date().toISOString(),
              setlistOrder: 1,
            },
          ]),
          {status: 200, headers: {'Content-Type': 'application/json'}},
        )
      }
      if (url === '/api/proposals/a' && init?.method === 'PATCH') {
        // Check payload includes updates
        const body = JSON.parse(String(init.body || '{}'))
        expect(body).toMatchObject({
          title: 'Believer (Edit)',
          artist: 'Monkees',
          chartUrl: 'https://chart.example.com',
        })
        return new Response(null, {status: 204})
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

  it('admin can edit song inline', async () => {
    const user = userEvent.setup()
    setMockSession({data: {user: {isAdmin: true}}, status: 'authenticated'})
    renderWithProviders(<SetlistPage />)
    await screen.findByText('I’m a Believer')
    // Click Edit (icon button)
    await user.click(screen.getByRole('button', {name: 'Edit'}))
    // Change fields
    const titleInput = screen.getByRole('textbox', {name: 'Title'})
    await user.clear(titleInput)
    await user.type(titleInput, 'Believer (Edit)')
    const artistInput = screen.getByRole('textbox', {name: 'Artist'})
    await user.clear(artistInput)
    await user.type(artistInput, 'Monkees')
    const chartInput = screen.getByRole('textbox', {name: 'Chart URL'})
    await user.clear(chartInput)
    await user.type(chartInput, 'https://chart.example.com')
    await user.click(screen.getByRole('button', {name: 'Save'}))
    // UI reflects new title/artist
    expect(await screen.findByText('Believer (Edit)')).toBeInTheDocument()
  })
})
