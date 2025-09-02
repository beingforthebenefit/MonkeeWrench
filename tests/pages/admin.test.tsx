import React from 'react'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {renderWithProviders} from '../utils'
import {screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminPage from '@/app/(protected)/admin/page'

describe('Admin page', () => {
  const originalFetch = global.fetch
  const confirmOrig = global.confirm

  beforeEach(() => {
    // Mock confirm to auto-accept deletions
    global.confirm = () => true
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      // Settings
      if (url === '/api/settings' && (!init || !init.method)) {
        return new Response(
          JSON.stringify({voteThreshold: 2, adminAllowlist: ['adm@x']}),
          {status: 200, headers: {'Content-Type': 'application/json'}},
        )
      }
      if (url === '/api/settings' && init?.method === 'PATCH') {
        return new Response(null, {status: 204})
      }

      // Users
      if (url === '/api/admin/users' && (!init || !init.method)) {
        return new Response(
          JSON.stringify([
            {
              id: 'u1',
              name: 'User One',
              email: 'u1@x',
              image: null,
              isAdmin: false,
              createdAt: '2024-01-01T00:00:00.000Z',
              proposals: [{id: 'p1'}],
              votes: [{id: 'v1'}, {id: 'v2'}],
            },
          ]),
          {status: 200, headers: {'Content-Type': 'application/json'}},
        )
      }
      if (url === '/api/admin/users' && init?.method === 'POST') {
        return new Response(
          JSON.stringify({id: 'u2', email: 'ok@example.com', isAdmin: true}),
          {status: 201, headers: {'Content-Type': 'application/json'}},
        )
      }
      if (url === `/api/admin/users/u1` && init?.method === 'PATCH') {
        return new Response(
          JSON.stringify({id: 'u1', email: 'u1@x', isAdmin: true}),
          {status: 200, headers: {'Content-Type': 'application/json'}},
        )
      }
      if (url === `/api/admin/users/u1` && init?.method === 'DELETE') {
        return new Response(null, {status: 204})
      }

      // Admin add proposal
      if (url === '/api/admin/proposals' && init?.method === 'POST') {
        return new Response(JSON.stringify({id: 'pX'}), {
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
    global.confirm = confirmOrig
  })

  it('loads users and settings; can toggle admin, delete, save settings, add song, add user', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AdminPage />)

    // Wait for user to load
    const userRow = await screen.findByText('User One')
    expect(userRow).toBeInTheDocument()

    // Toggle admin on the loaded user
    const adminToggle = screen.getByRole('checkbox', {name: 'Toggle admin'})
    await user.click(adminToggle)
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/users/u1',
      expect.objectContaining({method: 'PATCH'}),
    )

    // Delete user via icon
    const deleteBtn = screen.getByRole('button', {name: 'Delete user'})
    await user.click(deleteBtn)
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/users/u1',
      expect.objectContaining({method: 'DELETE'}),
    )

    // Save settings
    const thresholdField = screen.getByLabelText('Vote Threshold')
    await user.clear(thresholdField)
    await user.type(thresholdField, '3')
    await user.click(screen.getByRole('button', {name: 'Save'}))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/settings',
      expect.objectContaining({method: 'PATCH'}),
    )

    // Add approved song
    await user.type(screen.getByRole('textbox', {name: /^Title$/i}), 'New Song')
    await user.click(screen.getByRole('button', {name: 'Add to Setlist'}))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/proposals',
      expect.objectContaining({method: 'POST'}),
    )

    // Add/update user via form
    const emailField = screen.getByLabelText('Email')
    const nameField = screen.getByLabelText('Name (optional)')
    // Pick the form toggle (checkbox without the aria-label used by list rows)
    const formAdminToggle = (screen
      .getAllByRole('checkbox')
      .find(
        (el) => el.getAttribute('aria-label') !== 'Toggle admin',
      ) as HTMLElement)!
    await user.type(emailField, 'ok@example.com')
    await user.type(nameField, 'Ok')
    await user.click(formAdminToggle)
    await user.click(screen.getByRole('button', {name: 'Add / Update'}))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/users',
      expect.objectContaining({method: 'POST'}),
    )
  })
})
