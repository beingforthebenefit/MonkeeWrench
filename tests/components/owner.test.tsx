import React from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {render, screen, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OwnerPeople from '@/components/owner/OwnerPeople'
import OwnerBands from '@/components/owner/OwnerBands'
import OwnerNumbers from '@/components/owner/OwnerNumbers'
import {ownerStats} from '@/lib/owner-stats'
import {mockFetch} from '../fetch-mock'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({useRouter: () => ({refresh})}))

const person = (o: any) => ({
  id: 'u2',
  name: 'Ed Glantz',
  displayName: 'Ed',
  email: 'ed@example.com',
  isOwner: false,
  hasPassword: true,
  createdAt: '2026-10-01T00:00:00Z',
  bands: ['The Hollow Reeds'],
  ...o,
})
const people = [
  person({id: 'u1', name: 'Owner One', email: 'me@example.com', isOwner: true}),
  person({}),
  person({
    id: 'u3',
    name: 'New Person',
    email: 'new@example.com',
    hasPassword: false,
    bands: [],
  }),
]
const bands = [
  {id: 'b1', name: 'The Hollow Reeds'},
  {id: 'b2', name: 'Riverside'},
]

describe('OwnerPeople', () => {
  beforeEach(() => refresh.mockReset())

  it('finds people by name, email or band', async () => {
    render(<OwnerPeople people={people} bands={bands} me="u1" emails />)
    await userEvent.type(screen.getByLabelText('Find people'), 'new@')
    expect(screen.getByText('New Person')).toBeInTheDocument()
    expect(screen.queryByText('Ed Glantz')).not.toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Find people'))
    await userEvent.type(screen.getByLabelText('Find people'), 'nobody at all')
    expect(screen.getByText('Nobody matches.')).toBeInTheDocument()
  })

  it('marks the owner and people without a password', () => {
    render(<OwnerPeople people={people} bands={bands} me="u1" emails />)
    expect(screen.getByText('owner')).toBeInTheDocument()
    expect(screen.getByText('no password yet')).toBeInTheDocument()
    expect(screen.getByText('In no band')).toBeInTheDocument()
  })

  it('edits someone and emails them an invite or a reset', async () => {
    const {calls} = mockFetch()
    render(<OwnerPeople people={people} bands={bands} me="u1" emails />)
    await userEvent.click(screen.getByRole('button', {name: /Ed Glantz/}))
    const save = screen.getByRole('button', {name: 'Save'})
    expect(save).toBeDisabled()
    await userEvent.clear(screen.getByLabelText('Shown as'))
    await userEvent.type(screen.getByLabelText('Shown as'), 'Eddie')
    await userEvent.click(save)
    expect(calls[0]).toMatchObject({
      url: '/api/owner/users/u2',
      method: 'PATCH',
      body: {displayName: 'Eddie', name: 'Ed Glantz', email: 'ed@example.com'},
    })
    expect(screen.getByRole('status')).toHaveTextContent('Saved.')
    await userEvent.click(screen.getByRole('button', {name: 'Email an invite'}))
    expect(calls[1]).toMatchObject({
      url: '/api/owner/users/u2/reset',
      body: {kind: 'invite'},
    })
    expect(screen.getByRole('status')).toHaveTextContent(
      'Emailed ed@example.com an invite to The Hollow Reeds.',
    )
    await userEvent.click(
      screen.getByRole('button', {name: 'Email a password-reset link'}),
    )
    expect(calls[2].body).toEqual({kind: 'reset'})
    expect(refresh).toHaveBeenCalled()
  })

  it('without email: no email buttons; the owner can’t be deleted', async () => {
    render(<OwnerPeople people={people} bands={bands} me="u2" emails={false} />)
    await userEvent.click(screen.getByRole('button', {name: /Owner One/}))
    expect(
      screen.queryByRole('button', {name: 'Email an invite'}),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {name: 'Delete this person…'}),
    ).not.toBeInTheDocument()
  })

  it('deletes someone after a second click, and shows a refusal', async () => {
    const {calls} = mockFetch({
      'DELETE /api/owner/users/u2': {
        status: 409,
        body: {error: 'Last admin of a band'},
      },
    })
    render(<OwnerPeople people={people} bands={bands} me="u1" emails />)
    await userEvent.click(screen.getByRole('button', {name: /Ed Glantz/}))
    await userEvent.click(
      screen.getByRole('button', {name: 'Delete this person…'}),
    )
    await userEvent.click(screen.getByRole('button', {name: 'Keep'}))
    expect(calls).toHaveLength(0)
    await userEvent.click(
      screen.getByRole('button', {name: 'Delete this person…'}),
    )
    await userEvent.click(screen.getByRole('button', {name: 'Delete'}))
    expect(calls[0].method).toBe('DELETE')
    expect(screen.getByRole('status')).toHaveTextContent('Last admin of a band')
  })

  it.each([
    [
      {invited: true},
      'Added, and emailed new@x.com a link to choose a password.',
    ],
    [{existing: true}, 'Added with their existing account.'],
    [{}, 'Added. They have no password yet.'],
  ])('adds someone to a band (%o)', async (reply, said) => {
    const {calls} = mockFetch({'POST /api/owner/members': {body: reply}})
    render(<OwnerPeople people={people} bands={bands} me="u1" emails />)
    await userEvent.click(
      screen.getByRole('button', {name: 'Add someone to a band'}),
    )
    const form = screen
      .getByRole('button', {name: 'Add and email them'})
      .closest('form')!
    await userEvent.selectOptions(within(form).getByLabelText('Band'), 'b2')
    await userEvent.type(within(form).getByLabelText('Full name'), 'New')
    await userEvent.type(within(form).getByLabelText('Email'), 'new@x.com')
    await userEvent.click(within(form).getByLabelText('Admin of the band'))
    await userEvent.click(
      within(form).getByRole('button', {name: 'Add and email them'}),
    )
    expect(calls[0].body).toEqual({
      bandId: 'b2',
      name: 'New',
      email: 'new@x.com',
      isAdmin: true,
    })
    expect(screen.getByRole('status')).toHaveTextContent(said)
  })

  it('shows why adding failed, and closes', async () => {
    mockFetch({
      'POST /api/owner/members': {status: 400, body: {error: 'Bad email'}},
    })
    render(<OwnerPeople people={people} bands={bands} me="u1" emails={false} />)
    await userEvent.click(
      screen.getByRole('button', {name: 'Add someone to a band'}),
    )
    await userEvent.type(screen.getAllByLabelText('Full name')[0], 'X')
    await userEvent.type(screen.getAllByLabelText('Email')[0], 'x@x.com')
    await userEvent.click(screen.getByRole('button', {name: 'Add'}))
    expect(screen.getByRole('status')).toHaveTextContent('Bad email')
    await userEvent.click(screen.getByRole('button', {name: 'Close'}))
    expect(
      screen.getByRole('button', {name: 'Add someone to a band'}),
    ).toBeInTheDocument()
  })
})

const band = (o: any) => ({
  id: 'b1',
  name: 'The Hollow Reeds',
  standing: 'trial',
  paidUntil: '2026-11-08T00:00:00Z',
  members: 4,
  songs: 12,
  lastActivity: '2026-10-08T00:00:00Z',
  createdAt: '2026-10-01T00:00:00Z',
  ...o,
})

describe('OwnerBands', () => {
  it('shows standing and dates in UTC, and hides billing on a self-hosted install', () => {
    const {rerender} = render(
      <OwnerBands
        hosted
        bands={[
          band({}),
          band({
            id: 'b2',
            name: 'Free band',
            standing: 'free',
            paidUntil: null,
            lastActivity: null,
          }),
        ]}
      />,
    )
    expect(screen.getByText('Trial')).toBeInTheDocument()
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('Nov 8, 2026')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    rerender(<OwnerBands hosted={false} bands={[band({})]} />)
    expect(screen.queryByText('Standing')).not.toBeInTheDocument()
  })

  it('renames, sets a paid-until date, makes a band free, and deletes it by name', async () => {
    const {calls} = mockFetch()
    render(<OwnerBands hosted bands={[band({})]} />)
    await userEvent.click(
      screen.getByRole('button', {name: 'The Hollow Reeds'}),
    )
    const rename = screen.getByRole('button', {name: 'Rename'})
    expect(rename).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Name'), ' II')
    await userEvent.click(rename)
    expect(calls[0]).toMatchObject({
      url: '/api/owner/bands/b1',
      method: 'PATCH',
      body: {name: 'The Hollow Reeds II'},
    })
    expect(screen.getByRole('status')).toHaveTextContent('Renamed.')
    await userEvent.click(screen.getByRole('button', {name: 'Set date'}))
    expect(calls[1].body).toEqual({paidUntil: '2026-11-08'})
    await userEvent.click(screen.getByRole('button', {name: 'Make free'}))
    expect(calls[2].body).toEqual({paidUntil: null})
    const del = screen.getByRole('button', {name: 'Delete The Hollow Reeds'})
    expect(del).toBeDisabled()
    await userEvent.type(
      screen.getByPlaceholderText('The Hollow Reeds'),
      'The Hollow Reeds',
    )
    await userEvent.click(del)
    expect(calls[3]).toMatchObject({
      method: 'DELETE',
      body: {confirm: 'The Hollow Reeds'},
    })
  })

  it('opens from the row too, and shows a refusal', async () => {
    mockFetch({
      'PATCH /api/owner/bands/b1': {status: 400, body: {error: 'Nope'}},
    })
    render(<OwnerBands hosted={false} bands={[band({})]} />)
    await userEvent.click(screen.getByText('12'))
    await userEvent.type(screen.getByLabelText('Name'), 'x')
    await userEvent.click(screen.getByRole('button', {name: 'Rename'}))
    expect(screen.getByRole('status')).toHaveTextContent('Nope')
    expect(
      screen.queryByRole('button', {name: 'Set date'}),
    ).not.toBeInTheDocument()
  })
})

describe('OwnerNumbers', () => {
  it('shows the service’s numbers and the sign-up chart', () => {
    const now = new Date('2026-10-09T00:00:00Z')
    const day = 86400000
    const stats = ownerStats(
      [
        {
          id: 'a',
          createdAt: now,
          paidUntil: new Date(now.getTime() + 200 * day),
          polarSubscriptionId: 's1',
          subscriptionStatus: 'active',
          trialStartedAt: new Date(now.getTime() - 40 * day),
          lastActivity: now,
        },
        {
          id: 'b',
          createdAt: now,
          paidUntil: new Date(now.getTime() + 10 * day),
          polarSubscriptionId: null,
          subscriptionStatus: null,
          trialStartedAt: new Date(now.getTime() - 3 * day),
          lastActivity: null,
        },
      ],
      now,
    )
    render(<OwnerNumbers stats={stats} />)
    expect(screen.getByText('Paying bands')).toBeInTheDocument()
    expect(
      screen.getByRole('img', {name: /of the way to covering costs/}),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/convert \(1 of 1 decided; 2 ever\)/),
    ).toBeInTheDocument()
    expect(
      screen.getByText('New bands a week, the last 12'),
    ).toBeInTheDocument()
  })
})
