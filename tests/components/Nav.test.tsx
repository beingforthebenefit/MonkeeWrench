import React from 'react'
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('shows a Discord link when authenticated', () => {
    setMockSession({
      data: {user: {isAdmin: false, name: 'Bob', email: 'b@example.com'}},
      status: 'authenticated',
    })

    renderWithProviders(<Nav />)
    const discord = screen.getByRole('link', {name: /discord/i})
    expect(discord).toBeInTheDocument()
    expect(discord).toHaveAttribute(
      'href',
      'https://discord.com/channels/1347070995122622545',
    )
    expect(discord).toHaveAttribute('target', '_blank')
  })

  it('shows user name inside the dropdown, not in the bar', async () => {
    setMockSession({
      data: {user: {isAdmin: false, name: 'Carol', email: 'c@example.com'}},
      status: 'authenticated',
    })

    renderWithProviders(<Nav />)
    expect(screen.queryByText('Carol')).not.toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('Account menu'))
    expect(screen.getByText('Carol')).toBeInTheDocument()
  })
})
