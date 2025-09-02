import React from 'react'
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Vote from '@/app/vote/page'
import {renderWithProviders, setMockSession} from '../utils'

describe('Vote page editing', () => {
  const originalFetch = global.fetch
  beforeEach(() => {
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/proposals/pending' && (!init || !init.method)) {
        return new Response(
          JSON.stringify([
            {
              id: 'p3',
              title: 'Edit Me',
              artist: 'Anon',
              votes: 0,
              mine: false,
              threshold: 2,
            },
          ]),
          {status: 200, headers: {'Content-Type': 'application/json'}},
        )
      }
      if (url === '/api/proposals/p3' && (!init || !init.method)) {
        // Details fetch for admin edit
        return new Response(
          JSON.stringify({
            id: 'p3',
            title: 'Edit Me',
            artist: 'Anon',
            chartUrl: null,
            lyricsUrl: 'https://lyrics.example.com',
            youtubeUrl: null,
            status: 'PENDING',
          }),
          {status: 200, headers: {'Content-Type': 'application/json'}},
        )
      }
      if (url === '/api/proposals/p3' && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body || '{}'))
        expect(body).toMatchObject({
          title: 'Edited Title',
          artist: 'Anon',
          lyricsUrl: 'https://lyrics.example.com',
        })
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

  it('admin can edit pending request and updates list', async () => {
    const user = userEvent.setup()
    setMockSession({data: {user: {isAdmin: true}}, status: 'authenticated'})
    renderWithProviders(<Vote />)
    await screen.findByText(/Edit Me — Anon/)
    await user.click(screen.getByRole('button', {name: 'Edit'}))
    // Change title only; lyrics came from details fetch
    const titleInput = screen.getByRole('textbox', {name: 'Title'})
    await user.clear(titleInput)
    await user.type(titleInput, 'Edited Title')
    await user.click(screen.getByRole('button', {name: 'Save'}))
    expect(await screen.findByText(/Edited Title — Anon/)).toBeInTheDocument()
  })
})
