import React from 'react'
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SetlistDeleteButton from '@/components/SetlistDeleteButton'
import {renderWithProviders} from '../utils'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({refresh}),
}))

describe('SetlistDeleteButton', () => {
  const originalFetch = global.fetch
  const originalConfirm = global.confirm

  beforeEach(() => {
    global.fetch = vi.fn(
      async () => new Response(null, {status: 204}),
    ) as unknown as typeof fetch
    // @ts-expect-error jsdom
    global.confirm = vi.fn(() => true)
  })
  afterEach(() => {
    global.fetch = originalFetch
    // @ts-expect-error jsdom
    global.confirm = originalConfirm
  })

  it('confirms, deletes and refreshes router', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SetlistDeleteButton id="abc" />)
    const btn = screen.getByRole('button', {name: 'Delete song'})
    await user.click(btn)

    expect(global.confirm).toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledWith('/api/proposals/abc', {
      method: 'DELETE',
    })
    // ensure refresh called
    expect(refresh).toHaveBeenCalled()
  })
})
