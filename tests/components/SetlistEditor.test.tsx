import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SetlistEditor from '@/components/SetlistEditor'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({useRouter: () => ({push, refresh})}))

const props = {
  id: 'set1',
  library: [],
  initial: {name: 'New setlist', gigDate: '', venue: '', notes: '', items: []},
  editedBy: 'Ed',
  editedAt: '2026-10-07T00:00:00Z',
}

describe('SetlistEditor', () => {
  beforeEach(() => {
    push.mockReset()
    globalThis.fetch = vi.fn(
      async () => new Response(null, {status: 204}),
    ) as any
  })

  it('offers delete only when allowed', () => {
    const {rerender} = render(<SetlistEditor {...props} />)
    expect(
      screen.queryByRole('button', {name: 'Delete this setlist'}),
    ).not.toBeInTheDocument()
    rerender(<SetlistEditor {...props} canDelete />)
    expect(
      screen.getByRole('button', {name: 'Delete this setlist'}),
    ).toBeInTheDocument()
  })

  it('deletes after confirming and returns to the setlists', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<SetlistEditor {...props} canDelete />)
    await userEvent.click(
      screen.getByRole('button', {name: 'Delete this setlist'}),
    )
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/setlists/set1', {
      method: 'DELETE',
    })
    expect(push).toHaveBeenCalledWith('/setlists')
  })

  it('does nothing when the confirm is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<SetlistEditor {...props} canDelete />)
    await userEvent.click(
      screen.getByRole('button', {name: 'Delete this setlist'}),
    )
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
