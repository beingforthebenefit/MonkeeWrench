import React from 'react'
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {screen} from '@testing-library/react'
import SetlistPage from '@/app/setlist/page'
import {renderWithProviders} from '../utils'

describe('Setlist page empty state', () => {
  const originalFetch = global.fetch
  beforeEach(() => {
    global.fetch = vi.fn(async (url: string) => {
      if (url === '/api/proposals/approved') {
        return new Response(JSON.stringify([]), {
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

  it('shows friendly message when setlist is empty', async () => {
    renderWithProviders(<SetlistPage />)
    expect(
      await screen.findByText('No songs in the setlist'),
    ).toBeInTheDocument()
  })
})
