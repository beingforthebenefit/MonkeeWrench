import React from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {render, screen, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Members from '@/components/Members'
import {mockFetch} from '../fetch-mock'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({refresh, push: vi.fn()}),
}))
vi.mock('@/components/AvatarEditor', () => ({default: () => null}))

const member = (o: any) => ({
  id: 'u2',
  name: 'Ana Ruiz',
  displayName: 'Ana',
  email: 'ana@example.com',
  isAdmin: false,
  hasPassword: false,
  avatar: null,
  managed: true,
  ...o,
})
const props = {
  me: 'u1',
  bandName: 'The Hollow Reeds',
  site: 'https://app.test',
  initial: [
    member({
      id: 'u1',
      name: 'Me Myself',
      displayName: 'Me',
      isAdmin: true,
      hasPassword: true,
    }),
    member({}),
    member({
      id: 'u3',
      name: 'Bo Elsewhere',
      displayName: 'Bo',
      managed: false,
      hasPassword: true,
    }),
  ],
}

describe('Members', () => {
  beforeEach(() => refresh.mockReset())

  it('lists people, who’s admin, who can’t sign in yet, and whose sign-in isn’t ours', () => {
    render(<Members {...props} />)
    expect(screen.getByText('admin')).toBeInTheDocument()
    expect(
      screen.getByText('No password yet: can’t sign in.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/their own admins manage their sign-in/),
    ).toBeInTheDocument()
    // Nobody can demote or remove themselves here
    expect(screen.getAllByRole('button', {name: 'Remove'})).toHaveLength(2)
  })

  it('makes a password, shows it once with a message to send, and copies it', async () => {
    const {calls} = mockFetch({
      'POST /api/members/u2/password': {body: {password: 'abcd-efgh'}},
    })
    const writeText = vi.fn(async (..._a: any[]) => {})
    Object.assign(navigator, {clipboard: {writeText}})
    render(<Members {...props} />)
    await userEvent.click(screen.getByRole('button', {name: 'Create password'}))
    expect(calls[0].method).toBe('POST')
    expect(screen.getByText('abcd-efgh')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', {name: 'Copy message to send'}),
    )
    expect(writeText.mock.calls[0][0]).toContain('Password: abcd-efgh')
    expect(writeText.mock.calls[0][0]).toContain('https://app.test')
    expect(screen.getByRole('button', {name: 'Copied ✓'})).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', {name: 'Copy password'}))
    expect(writeText).toHaveBeenLastCalledWith('abcd-efgh')
    await userEvent.click(screen.getByRole('button', {name: 'Done'}))
    expect(screen.queryByText('abcd-efgh')).not.toBeInTheDocument()
    // Now they have one
    expect(
      screen.getAllByRole('button', {name: 'Reset password'}),
    ).toHaveLength(2)
  })

  it('says why a password couldn’t be made', async () => {
    mockFetch({
      'POST /api/members/u2/password': {
        status: 403,
        body: {error: 'Not yours'},
      },
    })
    render(<Members {...props} />)
    await userEvent.click(screen.getByRole('button', {name: 'Create password'}))
    expect(screen.getByRole('alert')).toHaveTextContent('Not yours')
  })

  it('makes and unmakes admins', async () => {
    const {calls} = mockFetch()
    render(<Members {...props} />)
    await userEvent.click(
      screen.getAllByRole('button', {name: 'Make admin'})[0],
    )
    expect(calls[0]).toMatchObject({
      url: '/api/members/u2',
      method: 'PATCH',
      body: {isAdmin: true},
    })
    expect(screen.getAllByRole('button', {name: 'Remove admin'})).toHaveLength(
      1,
    )
  })

  it('shows an admin change that was refused', async () => {
    mockFetch({
      'PATCH /api/members/u2': {status: 409, body: {error: 'Last admin'}},
    })
    render(<Members {...props} />)
    await userEvent.click(
      screen.getAllByRole('button', {name: 'Make admin'})[0],
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Last admin')
  })

  it('renames on leaving the field, only when it changed', async () => {
    const {calls} = mockFetch()
    render(<Members {...props} />)
    const field = screen.getByLabelText('Name shown in the app for Ana Ruiz')
    await userEvent.click(field)
    await userEvent.tab()
    expect(calls).toHaveLength(0)
    await userEvent.clear(field)
    await userEvent.type(field, 'Annie')
    await userEvent.tab()
    expect(calls[0]).toMatchObject({
      method: 'PATCH',
      body: {displayName: 'Annie'},
    })
  })

  it('removes someone after asking', async () => {
    const {calls} = mockFetch()
    const confirm = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
    render(<Members {...props} />)
    await userEvent.click(screen.getAllByRole('button', {name: 'Remove'})[0])
    expect(calls).toHaveLength(0)
    await userEvent.click(screen.getAllByRole('button', {name: 'Remove'})[0])
    expect(confirm.mock.calls[1][0]).toContain('The Hollow Reeds')
    expect(calls[0]).toMatchObject({url: '/api/members/u2', method: 'DELETE'})
    expect(screen.queryByText('Ana Ruiz')).not.toBeInTheDocument()
  })

  it.each([
    [{invited: true}, /emailed a link/],
    [{existing: true}, /already had an account/],
    [{}, /Use “Create password”/],
  ])('adds someone and says what happened (%o)', async (reply, said) => {
    const {calls} = mockFetch({'POST /api/members': {body: reply}})
    render(<Members {...props} invites />)
    await userEvent.click(screen.getByRole('button', {name: 'Add member'}))
    await userEvent.type(screen.getByLabelText('Full name'), 'Cy Young')
    await userEvent.type(screen.getByLabelText('Email'), 'cy@example.com')
    await userEvent.click(screen.getByRole('button', {name: 'Add'}))
    expect(calls[0].body).toEqual({
      name: 'Cy Young',
      displayName: '',
      email: 'cy@example.com',
    })
    expect(screen.getByRole('status')).toHaveTextContent(said)
    expect(refresh).toHaveBeenCalled()
    await userEvent.click(
      within(screen.getByRole('status')).getByRole('button', {name: 'Dismiss'}),
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('says why someone couldn’t be added', async () => {
    mockFetch({
      'POST /api/members': {status: 409, body: {error: 'Already in the band'}},
    })
    render(<Members {...props} />)
    await userEvent.click(screen.getByRole('button', {name: 'Add member'}))
    await userEvent.type(screen.getByLabelText('Full name'), 'Cy')
    await userEvent.type(screen.getByLabelText('Email'), 'cy@example.com')
    await userEvent.click(screen.getByRole('button', {name: 'Add'}))
    expect(screen.getByRole('alert')).toHaveTextContent('Already in the band')
  })
})
