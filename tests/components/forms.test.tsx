import React from 'react'
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {mockFetch} from '../fetch-mock'
import {setMockSession} from '../utils'
import DangerDelete from '@/components/DangerDelete'
import ChangePassword from '@/components/ChangePassword'
import ForgotForm from '@/components/ForgotForm'
import VoteThreshold from '@/components/VoteThreshold'
import NewSongForm from '@/components/NewSongForm'
import RestoreButton from '@/components/RestoreButton'
import BandPicker from '@/components/BandPicker'
import InviteNudge from '@/components/InviteNudge'
import BillingPanel from '@/components/BillingPanel'
import StartBand from '@/components/StartBand'
import SetPasswordForm from '@/components/SetPasswordForm'
import SetupForm from '@/components/SetupForm'

const push = vi.fn()
const refresh = vi.fn()
let pathname = '/songs'
vi.mock('next/navigation', () => ({
  useRouter: () => ({push, refresh}),
  usePathname: () => pathname,
}))
const clearSaved = vi.fn(async () => {})
vi.mock('@/components/pwa/pwa', () => ({clearSaved: () => clearSaved()}))

// Pages that leave with a full load: record where they went
const assign = vi.fn()
const realLocation = window.location
beforeAll(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {...realLocation, assign, href: realLocation.href},
  })
})
afterAll(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: realLocation,
  })
})
beforeEach(() => {
  assign.mockReset()
  push.mockReset()
  refresh.mockReset()
  clearSaved.mockClear()
})

const nextAuth = async () => (await import('next-auth/react')) as any

describe('DangerDelete', () => {
  const props = {
    what: 'this band',
    confirmText: 'The Hollow Reeds',
    confirmLabel: 'Type the band’s name',
    endpoint: '/api/band',
    explain: 'Everything goes.',
  }
  it('needs the name typed, then deletes, clears this device and leaves', async () => {
    const {calls} = mockFetch()
    render(<DangerDelete {...props} />)
    await userEvent.click(
      screen.getByRole('button', {name: 'Delete this band…'}),
    )
    const go = screen.getByRole('button', {name: 'Delete this band for good'})
    expect(go).toBeDisabled()
    await userEvent.type(
      screen.getByLabelText('Type the band’s name'),
      'the hollow reeds ',
    )
    await userEvent.click(go)
    expect(calls[0]).toMatchObject({
      url: '/api/band',
      method: 'DELETE',
      body: {confirm: 'the hollow reeds '},
    })
    expect(clearSaved).toHaveBeenCalled()
    expect(assign).toHaveBeenCalledWith('/')
  })
  it('signs out after deleting an account', async () => {
    mockFetch()
    const {signOut} = await nextAuth()
    render(
      <DangerDelete
        {...props}
        what="your account"
        confirmText="me@x.com"
        signOutAfter
      />,
    )
    await userEvent.click(
      screen.getByRole('button', {name: 'Delete your account…'}),
    )
    await userEvent.type(
      screen.getByLabelText('Type the band’s name'),
      'me@x.com',
    )
    await userEvent.click(
      screen.getByRole('button', {name: 'Delete your account for good'}),
    )
    expect(signOut).toHaveBeenCalledWith({callbackUrl: '/login'})
  })
  it('shows a refusal and can be closed', async () => {
    mockFetch({
      'DELETE /api/band': {
        status: 409,
        body: {error: 'Cancel the subscription first.'},
      },
    })
    render(<DangerDelete {...props} />)
    await userEvent.click(
      screen.getByRole('button', {name: 'Delete this band…'}),
    )
    await userEvent.type(
      screen.getByLabelText('Type the band’s name'),
      'The Hollow Reeds',
    )
    await userEvent.click(
      screen.getByRole('button', {name: 'Delete this band for good'}),
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Cancel the subscription first.',
    )
    await userEvent.click(screen.getByRole('button', {name: 'Keep it'}))
    expect(
      screen.getByRole('button', {name: 'Delete this band…'}),
    ).toBeInTheDocument()
  })
})

describe('ChangePassword', () => {
  it('checks the two match and the length before asking the server', async () => {
    const {calls} = mockFetch()
    render(<ChangePassword />)
    await userEvent.type(
      screen.getByLabelText('Current password'),
      'old-password',
    )
    await userEvent.type(
      screen.getByLabelText(/New password \(at least/),
      'short',
    )
    await userEvent.type(screen.getByLabelText('New password again'), 'shorter')
    await userEvent.click(screen.getByRole('button', {name: 'Change password'}))
    expect(screen.getByRole('alert')).toHaveTextContent('don’t match')
    await userEvent.clear(screen.getByLabelText('New password again'))
    await userEvent.type(screen.getByLabelText('New password again'), 'short')
    await userEvent.click(screen.getByRole('button', {name: 'Change password'}))
    expect(screen.getByRole('alert')).toHaveTextContent('Use at least')
    expect(calls).toHaveLength(0)
  })
  it('changes it and signs this device back in', async () => {
    const {calls} = mockFetch()
    setMockSession({data: {user: {email: 'me@x.com'}}, status: 'authenticated'})
    const {signIn} = await nextAuth()
    signIn.mockResolvedValue({ok: true})
    render(<ChangePassword />)
    await userEvent.type(
      screen.getByLabelText('Current password'),
      'old-password',
    )
    await userEvent.type(
      screen.getByLabelText(/New password \(at least/),
      'a new long password',
    )
    await userEvent.type(
      screen.getByLabelText('New password again'),
      'a new long password',
    )
    await userEvent.click(screen.getByRole('button', {name: 'Change password'}))
    expect(calls[0].body).toEqual({
      current: 'old-password',
      next: 'a new long password',
    })
    expect(signIn).toHaveBeenCalledWith('credentials', {
      email: 'me@x.com',
      password: 'a new long password',
      redirect: false,
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('Changed.')
    setMockSession({data: null, status: 'unauthenticated'})
  })
  it('sets a first password for a Google-only account, and shows a refusal', async () => {
    const {calls} = mockFetch({
      'POST /api/account/password': {status: 400, body: {error: 'Too common'}},
    })
    render(<ChangePassword hasPassword={false} />)
    expect(screen.getByText('Set a password')).toBeInTheDocument()
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument()
    await userEvent.type(
      screen.getByLabelText(/New password \(at least/),
      'password1234',
    )
    await userEvent.type(
      screen.getByLabelText('New password again'),
      'password1234',
    )
    await userEvent.click(screen.getByRole('button', {name: 'Change password'}))
    expect(calls[0].body).toEqual({next: 'password1234'})
    expect(await screen.findByRole('alert')).toHaveTextContent('Too common')
  })
})

describe('ForgotForm', () => {
  it('sends the link and says so without saying whether the account exists', async () => {
    const {calls} = mockFetch()
    render(<ForgotForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'me@x.com')
    await userEvent.click(screen.getByRole('button', {name: 'Email me a link'}))
    expect(calls[0].body).toEqual({email: 'me@x.com'})
    expect(screen.getByRole('status')).toHaveTextContent(
      'If me@x.com has an account',
    )
  })
  it('shows a refusal', async () => {
    mockFetch({
      'POST /api/password/forgot': {
        status: 429,
        body: {error: 'Too many tries.'},
      },
    })
    render(<ForgotForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'me@x.com')
    await userEvent.click(screen.getByRole('button', {name: 'Email me a link'}))
    expect(screen.getByRole('alert')).toHaveTextContent('Too many tries.')
  })
})

describe('VoteThreshold', () => {
  it('saves a new threshold, and goes back on failure', async () => {
    let fail = false
    const {calls} = mockFetch({
      'PATCH /api/band': () => (fail ? {status: 500} : {body: {}}),
    })
    render(<VoteThreshold initial={2} max={4} />)
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    await userEvent.click(screen.getByRole('radio', {name: '3'}))
    expect(calls[0].body).toEqual({voteThreshold: 3})
    expect(screen.getByText(/Saved: 3/)).toBeInTheDocument()
    fail = true
    await userEvent.click(screen.getByRole('radio', {name: '4'}))
    expect(screen.getByText('Couldn’t save — try again.')).toBeInTheDocument()
    expect(screen.getByRole('radio', {name: '3'})).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
})

describe('NewSongForm', () => {
  it('adds the song and opens its editor', async () => {
    const {calls} = mockFetch({'POST /api/songs': {body: {id: 's9'}}})
    render(<NewSongForm />)
    expect(
      screen.getByRole('button', {name: 'Add and write the chart'}),
    ).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Title'), 'Sway')
    await userEvent.type(screen.getByLabelText('Written by'), 'Ruiz')
    await userEvent.click(
      screen.getByRole('button', {name: 'Add and write the chart'}),
    )
    expect(calls[0].body).toEqual({
      title: 'Sway',
      writer: 'Ruiz',
      leadSinger: '',
    })
    expect(push).toHaveBeenCalledWith('/songs/s9/edit')
  })
  it('says when it couldn’t', async () => {
    mockFetch({'POST /api/songs': {status: 500}})
    render(<NewSongForm />)
    await userEvent.type(screen.getByLabelText('Title'), 'Sway')
    await userEvent.click(
      screen.getByRole('button', {name: 'Add and write the chart'}),
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not add the song.',
    )
  })
})

describe('RestoreButton', () => {
  it('asks, restores as a new version and shows it', async () => {
    const {calls} = mockFetch({
      'POST /api/songs/s1/versions/3/restore': {body: {number: 7}},
    })
    render(<RestoreButton songId="s1" number={3} />)
    await userEvent.click(screen.getByRole('button'))
    expect(
      screen.getByText('Save version 3 as the current chart?'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}))
    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByRole('button', {name: 'Restore'}))
    expect(calls).toHaveLength(1)
    expect(push).toHaveBeenCalledWith('?v=7')
  })
  it('says when it failed', async () => {
    mockFetch({'POST /api/songs/s1/versions/3/restore': {status: 500}})
    render(<RestoreButton songId="s1" number={3} />)
    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByRole('button', {name: 'Restore'}))
    expect(
      screen.getByRole('button', {name: 'Restore failed — try again'}),
    ).toBeInTheDocument()
  })
})

describe('BandPicker', () => {
  it('picks a band and goes where they were headed', async () => {
    const {calls} = mockFetch()
    render(
      <BandPicker
        next="/setlists"
        isOwner
        bands={
          [
            {id: 'b1', name: 'The Hollow Reeds', iconAt: null},
            {id: 'b2', name: 'Riverside', iconAt: '2026-10-01'},
          ] as any
        }
      />,
    )
    await userEvent.click(screen.getByRole('button', {name: /Riverside/}))
    expect(calls[0].body).toEqual({bandId: 'b2'})
    expect(assign).toHaveBeenCalledWith('/setlists')
    expect(
      screen.getByText('Manage all bands on this site ›'),
    ).toBeInTheDocument()
  })
  it('explains being in no band', () => {
    render(<BandPicker next="/songs" isOwner={false} bands={[]} />)
    expect(
      screen.getByText(/You’re not in a band here yet/),
    ).toBeInTheDocument()
  })
})

describe('InviteNudge', () => {
  beforeEach(() => localStorage.clear())
  it('nudges until dismissed, per band, and not on Band members', async () => {
    pathname = '/songs'
    const {unmount} = render(<InviteNudge bandId="b1" emails />)
    expect(screen.getByRole('status')).toHaveTextContent('each gets an email')
    await userEvent.click(screen.getByRole('button', {name: 'Dismiss'}))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    unmount()
    render(<InviteNudge bandId="b1" emails />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
  it('stays off the members page', () => {
    pathname = '/members'
    render(<InviteNudge bandId="b2" emails={false} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    pathname = '/songs'
  })
})

describe('BillingPanel', () => {
  const billing = (o: any) => ({
    kind: 'trial',
    until: '2026-11-08T00:00:00Z',
    daysLeft: 1,
    status: null,
    hasCustomer: false,
    ready: true,
    ...o,
  })
  it('on a trial: days left, and Subscribe goes to checkout', async () => {
    const {calls} = mockFetch({
      'POST /api/billing/checkout': {body: {url: 'https://polar.test/c'}},
    })
    render(<BillingPanel billing={billing({})} price="$12 a year" thanks />)
    expect(screen.getByText(/Free trial: 1 day left/)).toBeInTheDocument()
    expect(screen.getByText(/Thanks!/)).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', {name: /Subscribe — \$12 a year/}),
    )
    expect(calls[0].url).toBe('/api/billing/checkout')
    expect(assign).toHaveBeenCalledWith('https://polar.test/c')
  })
  it.each([
    [
      {kind: 'lapsed', until: '2026-09-01T00:00:00Z'},
      /read-only/,
      'Renew — $12',
    ],
    [
      {kind: 'paid', status: 'past_due', hasCustomer: true},
      /didn’t go through/,
      null,
    ],
    [
      {kind: 'paid', status: 'canceling', hasCustomer: true},
      /Cancelled: paid until/,
      'Subscribe — $12',
    ],
    [
      {kind: 'paid', status: 'active', hasCustomer: true},
      /Subscribed: \$12/,
      null,
    ],
  ])('says where the band stands (%o)', (o, line, button) => {
    render(<BillingPanel billing={billing(o)} price="$12" />)
    expect(screen.getByText(line)).toBeInTheDocument()
    if (button)
      expect(screen.getByRole('button', {name: button})).toBeInTheDocument()
  })
  it('opens the portal, and shows when the payment service is down', async () => {
    mockFetch({'POST /api/billing/portal': {status: 502}})
    render(
      <BillingPanel
        billing={billing({kind: 'paid', status: 'active', hasCustomer: true})}
        price="$12"
      />,
    )
    await userEvent.click(
      screen.getByRole('button', {name: 'Card, receipts and cancelling'}),
    )
    expect(
      await screen.findByText('Couldn’t reach the payment service. Try again.'),
    ).toBeInTheDocument()
  })
  it('free bands see no buttons', () => {
    render(
      <BillingPanel
        billing={billing({kind: 'free', until: null})}
        price="$12"
      />,
    )
    expect(screen.getByText('Free.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('StartBand', () => {
  it('signed out: sends the details and says to check email', async () => {
    const {calls} = mockFetch()
    render(<StartBand signedIn={false} />)
    await userEvent.type(screen.getByLabelText('Band name'), 'Riverside')
    await userEvent.type(screen.getByLabelText('Your name'), 'Ana Ruiz')
    await userEvent.type(screen.getByLabelText('Your email'), 'ana@x.com')
    await userEvent.click(screen.getByRole('button', {name: 'Start the band'}))
    expect(calls[0].body).toEqual({
      bandName: 'Riverside',
      name: 'Ana Ruiz',
      email: 'ana@x.com',
      website: '',
    })
    expect(screen.getByRole('status')).toHaveTextContent('Check your email')
  })
  it('signed in: starts it, switches to it and opens Band members', async () => {
    const {calls} = mockFetch({
      'POST /api/signup': {status: 201, body: {bandId: 'b7'}},
    })
    render(<StartBand signedIn />)
    expect(screen.queryByLabelText('Your name')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Band name'), 'Riverside')
    await userEvent.click(screen.getByRole('button', {name: 'Start the band'}))
    expect(calls[1]).toMatchObject({
      url: '/api/bands/current',
      body: {bandId: 'b7'},
    })
    expect(assign).toHaveBeenCalledWith('/members')
  })
  it('offers Google to start, coming back here for the band’s name', async () => {
    const {signIn} = await nextAuth()
    render(<StartBand signedIn={false} google />)
    await userEvent.click(
      screen.getByRole('button', {name: 'Start with Google'}),
    )
    expect(signIn).toHaveBeenCalledWith('google', {callbackUrl: '/start'})
  })
  it('no Google button when it isn’t set up, or once signed in', () => {
    const {rerender} = render(<StartBand signedIn={false} />)
    expect(
      screen.queryByRole('button', {name: 'Start with Google'}),
    ).not.toBeInTheDocument()
    rerender(<StartBand signedIn google />)
    expect(
      screen.queryByRole('button', {name: 'Start with Google'}),
    ).not.toBeInTheDocument()
  })
  it('a new account with no band: says how to join one instead', async () => {
    const {signOut} = await nextAuth()
    render(<StartBand signedIn newAccount="rosa@example.com" />)
    expect(screen.getByText(/Signed in as/)).toHaveTextContent(
      'rosa@example.com',
    )
    await userEvent.click(
      screen.getByRole('button', {name: 'sign in with another account'}),
    )
    expect(signOut).toHaveBeenCalledWith({callbackUrl: '/login'})
  })
  it('shows a refusal', async () => {
    mockFetch({
      'POST /api/signup': {status: 429, body: {error: 'Try tomorrow.'}},
    })
    render(<StartBand signedIn />)
    await userEvent.type(screen.getByLabelText('Band name'), 'X')
    await userEvent.click(screen.getByRole('button', {name: 'Start the band'}))
    expect(screen.getByRole('alert')).toHaveTextContent('Try tomorrow.')
  })
})

describe('SetPasswordForm and SetupForm', () => {
  it('sets the password from the link and signs straight in', async () => {
    const {calls} = mockFetch()
    const {signIn} = await nextAuth()
    signIn.mockResolvedValue({ok: true, error: null})
    render(<SetPasswordForm token="t1" email="me@x.com" minLength={10} />)
    await userEvent.type(
      screen.getByLabelText('New password'),
      'long enough one',
    )
    await userEvent.type(screen.getByLabelText('Once more'), 'long enough one')
    await userEvent.click(
      screen.getByRole('button', {name: 'Save and sign in'}),
    )
    expect(calls[0].body).toEqual({token: 't1', password: 'long enough one'})
    expect(assign).toHaveBeenCalledWith('/songs')
  })
  it('an expired link says so; different passwords are caught first', async () => {
    const {calls} = mockFetch({
      'POST /api/password/set': {
        status: 410,
        body: {error: 'This link has expired.'},
      },
    })
    render(<SetPasswordForm token="t1" email="me@x.com" minLength={10} />)
    await userEvent.type(
      screen.getByLabelText('New password'),
      'long enough one',
    )
    await userEvent.type(screen.getByLabelText('Once more'), 'long enough two')
    await userEvent.click(
      screen.getByRole('button', {name: 'Save and sign in'}),
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The two passwords differ.',
    )
    expect(calls).toHaveLength(0)
    await userEvent.clear(screen.getByLabelText('Once more'))
    await userEvent.type(screen.getByLabelText('Once more'), 'long enough one')
    await userEvent.click(
      screen.getByRole('button', {name: 'Save and sign in'}),
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This link has expired.',
    )
  })
  it('sets up a fresh install and signs in; falls back to the sign-in page', async () => {
    const {calls} = mockFetch({
      'POST /api/setup': {status: 201, body: {bandId: 'b1'}},
    })
    const {signIn} = await nextAuth()
    signIn.mockResolvedValue({ok: false, error: 'x'})
    render(<SetupForm minLength={10} />)
    await userEvent.type(screen.getByLabelText('Band name'), 'Riverside')
    await userEvent.type(screen.getByLabelText('Your name'), 'Ana')
    await userEvent.type(screen.getByLabelText('Your email'), 'ana@x.com')
    await userEvent.type(screen.getByLabelText('Password'), 'long enough one')
    await userEvent.type(screen.getByLabelText('Once more'), 'long enough one')
    await userEvent.click(
      screen.getByRole('button', {name: 'Set up and sign in'}),
    )
    expect(calls[0].body).toEqual({
      bandName: 'Riverside',
      name: 'Ana',
      email: 'ana@x.com',
      password: 'long enough one',
    })
    expect(assign).toHaveBeenCalledWith('/login')
  })
  it('setup: catches different passwords and shows a refusal', async () => {
    mockFetch({
      'POST /api/setup': {status: 409, body: {error: 'Already set up.'}},
    })
    render(<SetupForm minLength={10} />)
    await userEvent.type(screen.getByLabelText('Band name'), 'R')
    await userEvent.type(screen.getByLabelText('Your name'), 'A')
    await userEvent.type(screen.getByLabelText('Your email'), 'a@x.com')
    await userEvent.type(screen.getByLabelText('Password'), 'long enough one')
    await userEvent.type(screen.getByLabelText('Once more'), 'different one!!')
    await userEvent.click(
      screen.getByRole('button', {name: 'Set up and sign in'}),
    )
    expect(screen.getByRole('alert')).toHaveTextContent('differ')
    await userEvent.clear(screen.getByLabelText('Once more'))
    await userEvent.type(screen.getByLabelText('Once more'), 'long enough one')
    await userEvent.click(
      screen.getByRole('button', {name: 'Set up and sign in'}),
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Already set up.')
  })
})
