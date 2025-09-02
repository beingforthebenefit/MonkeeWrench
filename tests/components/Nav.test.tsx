import React from 'react'
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {screen} from '@testing-library/react'
import {renderWithProviders, setMockSession} from '../utils'
import Nav from '@/components/Nav'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

// use global mock from setup; set session via helper

describe('Nav', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify([]), {
          status: 200,
          headers: {'Content-Type': 'application/json'},
        }),
    ) as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('shows Admin link when user is admin', () => {
    setMockSession({
      data: {user: {isAdmin: true, name: 'Alice', email: 'a@example.com'}},
      status: 'authenticated',
    })

    renderWithProviders(<Nav />)
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.queryByText('Sign in')).not.toBeInTheDocument()
  })

  it('shows Sign in when no session', () => {
    setMockSession({data: null, status: 'unauthenticated'})

    renderWithProviders(<Nav />)
    expect(screen.getByText('Sign in')).toBeInTheDocument()
  })
})
