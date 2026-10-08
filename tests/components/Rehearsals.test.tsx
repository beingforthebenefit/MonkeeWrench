import React from 'react'
import {describe, it, expect, vi} from 'vitest'
import {render, screen} from '@testing-library/react'
import Rehearsals from '@/components/Rehearsals'

vi.mock('next/navigation', () => ({useRouter: () => ({refresh: vi.fn()})}))
vi.mock('next/link', () => ({
  default: ({children, ...p}: any) => <a {...p}>{children}</a>,
}))

const props = {
  me: 'u1',
  isAdmin: false,
  horizon: ['2026-10-12', '2026-10-13'],
  members: [{id: 'u1', name: 'Gerald', answered: true, avatar: null}],
  entries: [],
  blocks: [],
  rehearsals: [
    {
      id: 'r1',
      date: '2026-10-12',
      time: '6:30 PM',
      place: "Tad's Place, 632 W. Grand Ave, Oakland, CA 94612",
      note: null,
      by: 'Gerald',
      mine: true,
    },
  ],
  bandName: "Satchmo's Ghost",
  timezone: 'America/Los_Angeles',
  blocksOn: false,
}

describe('Rehearsals', () => {
  it('with the scheduling tool off, still shows the rehearsals', () => {
    render(<Rehearsals {...props} scheduling={false} />)
    expect(screen.getByText(/Tad's Place/)).toBeInTheDocument()
    expect(screen.getByText('6:30 PM')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: '+ Add a rehearsal'}),
    ).toBeInTheDocument()
    expect(screen.queryByText('Next days everyone can make')).toBeNull()
    expect(screen.queryByText('Your days')).toBeNull()
  })

  it('with it on, has the scheduling tool', () => {
    render(<Rehearsals {...props} />)
    expect(screen.getByText('Next days everyone can make')).toBeInTheDocument()
    expect(screen.getByText('Your days')).toBeInTheDocument()
  })
})
