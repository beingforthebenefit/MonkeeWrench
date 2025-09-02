import React from 'react'
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {screen} from '@testing-library/react'
import Vote from '@/app/vote/page'
import {renderWithProviders} from '../utils'

describe('Vote page empty state', () => {
  const originalFetch = global.fetch
  beforeEach(() => {
    global.fetch = vi.fn(async (url: string) => {
      if (url === '/api/proposals/pending') {
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

  it('shows friendly message when no pending requests', async () => {
    renderWithProviders(<Vote />)
    expect(await screen.findByText('No pending requests')).toBeInTheDocument()
  })
})
