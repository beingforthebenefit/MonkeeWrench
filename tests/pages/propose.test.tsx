import React from 'react'
import {describe, it, expect} from 'vitest'
import userEvent from '@testing-library/user-event'
import {renderWithProviders, setMockSession} from '../utils'
import {screen} from '@testing-library/react'
import Propose from '@/app/propose/page'

describe('Propose page', () => {
  it('validates URLs and shows helper text', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Propose />)

    const chartField = screen.getByLabelText('Chart URL')
    await user.type(chartField, 'example')
    // It should show a helper text indicating bad URL
    expect(
      screen.getByText(/must start with http\(s\):\/\//i),
    ).toBeInTheDocument()
  })

  it('submits valid form and resets fields', async () => {
    setMockSession({data: {user: {email: 'u@x'}}, status: 'authenticated'})
    const originalFetch = global.fetch
    const user = userEvent.setup()
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/proposals' && init?.method === 'POST') {
        return new Response(JSON.stringify({id: 'p1'}), {
          status: 200,
          headers: {'Content-Type': 'application/json'},
        })
      }
      return new Response(JSON.stringify({}), {status: 200})
    }) as unknown as typeof fetch

    renderWithProviders(<Propose />)
    await user.type(screen.getByRole('textbox', {name: /Title/i}), 'Song')
    await user.clear(screen.getByRole('textbox', {name: /Artist/i}))
    await user.type(screen.getByRole('textbox', {name: /Artist/i}), 'A')
    await user.click(screen.getByRole('button', {name: 'Propose'}))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/proposals',
      expect.objectContaining({method: 'POST'}),
    )
    expect(await screen.findByText('Submitted')).toBeInTheDocument()
    global.fetch = originalFetch
  })

  it('shows error when backend fails', async () => {
    setMockSession({data: {user: {email: 'u@x'}}, status: 'authenticated'})
    const originalFetch = global.fetch
    const user = userEvent.setup()
    global.fetch = vi.fn(async () => new Response('nope', {status: 500})) as any
    renderWithProviders(<Propose />)
    await user.type(screen.getByRole('textbox', {name: /Title/i}), 'Song')
    await user.click(screen.getByRole('button', {name: 'Propose'}))
    // Error alert should display the backend text body ("nope")
    expect(await screen.findByRole('alert')).toHaveTextContent('nope')
    global.fetch = originalFetch
  })
})
