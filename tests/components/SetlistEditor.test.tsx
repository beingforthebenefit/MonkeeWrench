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
  initial: {
    name: 'New setlist',
    gigDate: '',
    startTime: '',
    venue: '',
    notes: '',
    items: [],
  },
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

  it('divides the gig into sets and breaks, timed from the start', async () => {
    const library = [
      {
        id: 'a',
        title: 'Song A',
        ready: true,
        leadSinger: null,
        key: 'G',
        seconds: 180,
      },
      {
        id: 'b',
        title: 'Song B',
        ready: true,
        leadSinger: null,
        key: 'C',
        seconds: 240,
      },
    ]
    const song = (uid: string, songId: string) => ({
      uid,
      kind: 'SONG' as const,
      songId,
      note: '',
      key: '',
    })
    render(
      <SetlistEditor
        {...props}
        library={library}
        initial={{
          ...props.initial,
          startTime: '20:00',
          items: [song('1', 'a'), song('2', 'b')],
        }}
      />,
    )
    // The first set goes on top, around the songs already there
    await userEvent.click(screen.getByRole('button', {name: '+ Set'}))
    expect(screen.getByDisplayValue('Set 1')).toBeInTheDocument()
    expect(screen.getByText('8:00–8:45')).toBeInTheDocument()
    expect(screen.getByText('2 songs · ~7 min')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', {name: '+ Break'}))
    expect(screen.getByText('8:45–9:00')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', {name: 'Save'}))
    const body = JSON.parse(
      (globalThis.fetch as any).mock.calls[0][1].body as string,
    )
    expect(body.startTime).toBe('20:00')
    expect(body.items.map((i: any) => i.kind)).toEqual([
      'SET',
      'SONG',
      'SONG',
      'BREAK',
    ])
    expect(body.items[0]).toMatchObject({label: 'Set 1', minutes: 45})
    expect(body.items[3]).toMatchObject({minutes: 15})
  })
})
