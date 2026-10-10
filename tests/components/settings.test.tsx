import React from 'react'
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {mockFetch} from '../fetch-mock'
import BandSettings from '@/components/BandSettings'
import ManageBands from '@/components/ManageBands'
import BandSettingsToggles from '@/components/BandSettingsToggles'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({refresh, push: vi.fn()}),
}))
const squareIcon = vi.fn(async () => new Blob(['png']))
vi.mock('@/lib/resize-image', () => ({
  squareIcon: (...a: any[]) => squareIcon(...(a as [])),
}))

const assign = vi.fn()
const realLocation = window.location
beforeAll(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {...realLocation, assign},
  })
  URL.createObjectURL = vi.fn(() => 'blob:preview')
})
afterAll(() =>
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: realLocation,
  }),
)
beforeEach(() => {
  refresh.mockReset()
  assign.mockReset()
  squareIcon.mockClear()
})

const initial = {
  scheduling: true,
  name: 'The Hollow Reeds',
  appName: 'Bandstand',
  timezone: 'America/Los_Angeles',
  chatUrl: '',
  tributeTo: '',
}

describe('BandSettings', () => {
  it('saves only when something changed', async () => {
    const {calls} = mockFetch()
    render(
      <BandSettings
        initial={initial}
        iconSrc="/icons/default-512.png"
        hasIcon={false}
      />,
    )
    const save = screen.getByRole('button', {name: 'Save'})
    expect(save).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/^Tribute to/), 'The Band')
    await userEvent.click(
      screen.getByRole('checkbox', {name: /Rehearsal scheduling|days off/i}),
    )
    await userEvent.click(save)
    expect(calls[0].body).toMatchObject({
      tributeTo: 'The Band',
      scheduling: false,
    })
    expect(screen.getByText('Saved.')).toBeInTheDocument()
    expect(save).toBeDisabled()
    expect(refresh).toHaveBeenCalled()
  })

  it('shows why it couldn’t save', async () => {
    mockFetch({
      'PATCH /api/band': {status: 400, body: {error: 'Not a time zone'}},
    })
    render(<BandSettings initial={initial} iconSrc="/i.png" hasIcon={false} />)
    await userEvent.clear(screen.getByLabelText(/^Time zone/))
    await userEvent.type(screen.getByLabelText(/^Time zone/), 'Mars')
    await userEvent.click(screen.getByRole('button', {name: 'Save'}))
    expect(screen.getByText('Not a time zone')).toBeInTheDocument()
  })

  it('a new icon: previewed with a background, uploaded; or back to the default', async () => {
    const {calls} = mockFetch()
    const {container} = render(
      <BandSettings initial={initial} iconSrc="/brand/b1/icon.png" hasIcon />,
    )
    await userEvent.click(screen.getByRole('button', {name: 'Use the default'}))
    expect(calls[0]).toMatchObject({url: '/api/band/icon', method: 'DELETE'})
    expect(screen.getByAltText('Icon preview')).toHaveAttribute(
      'src',
      '/icons/default-512.png',
    )
    const input = container.querySelector(
      'input[type=file]',
    ) as HTMLInputElement
    await userEvent.upload(
      input,
      new File(['x'], 'logo.png', {type: 'image/png'}),
    )
    expect(screen.getByAltText('Icon preview')).toHaveAttribute(
      'src',
      'blob:preview',
    )
    await userEvent.click(screen.getByLabelText(/Fill the square/))
    expect(squareIcon).toHaveBeenLastCalledWith(expect.anything(), {
      background: '#f2b134',
      scale: 1,
    })
    await userEvent.click(screen.getByRole('button', {name: 'Use this icon'}))
    expect(calls[1]).toMatchObject({url: '/api/band/icon', method: 'PUT'})
    expect(
      screen.queryByRole('button', {name: 'Use this icon'}),
    ).not.toBeInTheDocument()
  })

  it('says when the icon wasn’t saved', async () => {
    mockFetch({'PUT /api/band/icon': {status: 415}})
    const {container} = render(
      <BandSettings initial={initial} iconSrc="/i.png" hasIcon={false} />,
    )
    await userEvent.upload(
      container.querySelector('input[type=file]') as HTMLInputElement,
      new File(['x'], 'l.png', {type: 'image/png'}),
    )
    await userEvent.click(screen.getByRole('button', {name: 'Use this icon'}))
    expect(screen.getByText('Couldn’t save that image.')).toBeInTheDocument()
  })
})

describe('ManageBands', () => {
  const bands = [
    {
      id: 'b1',
      name: 'The Hollow Reeds',
      appName: 'Reeds',
      domains: ['reeds.example.com'],
      members: 4,
      songs: 30,
      mine: true,
    },
    {
      id: 'b2',
      name: 'Riverside',
      appName: 'Riverside',
      domains: [],
      members: 2,
      songs: 0,
      mine: false,
    },
  ]
  it('starts a band and goes to its Admin', async () => {
    const {calls} = mockFetch({
      'POST /api/bands': {status: 201, body: {id: 'b9'}},
    })
    render(<ManageBands bands={bands} />)
    expect(screen.getByText(/you’re not in it/)).toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText('Band name'), 'New Band')
    await userEvent.click(screen.getByRole('button', {name: 'Start it'}))
    expect(calls[1]).toMatchObject({
      url: '/api/bands/current',
      body: {bandId: 'b9'},
    })
    expect(assign).toHaveBeenCalledWith('/admin')
  })
  it('shows why a band couldn’t start', async () => {
    mockFetch({
      'POST /api/bands': {status: 400, body: {error: 'Give the band a name.'}},
    })
    render(<ManageBands bands={bands} />)
    await userEvent.type(screen.getByPlaceholderText('Band name'), ' x')
    await userEvent.click(screen.getByRole('button', {name: 'Start it'}))
    expect(screen.getByText('Give the band a name.')).toBeInTheDocument()
  })
  it('edits web addresses, and shows a refusal', async () => {
    let fail = true
    const {calls} = mockFetch({
      'PUT /api/bands/b2': () =>
        fail ? {status: 409, body: {error: 'Taken.'}} : {status: 204},
    })
    render(<ManageBands bands={bands} />)
    await userEvent.click(
      screen.getAllByRole('button', {name: 'Edit addresses'})[1],
    )
    await userEvent.type(
      screen.getByPlaceholderText('members.example.com'),
      'a.example.com, b.example.com',
    )
    await userEvent.click(screen.getByRole('button', {name: 'Save'}))
    expect(calls[0].body).toEqual({domains: ['a.example.com', 'b.example.com']})
    expect(screen.getByText('Taken.')).toBeInTheDocument()
    fail = false
    await userEvent.click(screen.getByRole('button', {name: 'Save'}))
    expect(refresh).toHaveBeenCalled()
    await userEvent.click(
      screen.getAllByRole('button', {name: 'Edit addresses'})[0],
    )
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}))
    expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument()
  })
})

describe('BandSettingsToggles', () => {
  it('saves each switch, and puts it back if that failed', async () => {
    let ok = true
    const {calls} = mockFetch({
      'PATCH /api/account/settings': () => (ok ? {} : {status: 500}),
    })
    render(
      <BandSettingsToggles
        initial={{shareAvailability: true, blockOtherBands: true}}
      />,
    )
    const boxes = screen.getAllByRole('checkbox')
    await userEvent.click(boxes[0])
    expect(calls[0].body).toEqual({shareAvailability: false})
    expect(
      screen.getByText(/Each band has its own days off/),
    ).toBeInTheDocument()
    ok = false
    await userEvent.click(boxes[1])
    expect(
      screen.getByText('Couldn’t save that — try again.'),
    ).toBeInTheDocument()
    expect(boxes[1]).toBeChecked()
  })
})
