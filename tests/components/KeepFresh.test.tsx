import {act, render} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {mockFetch} from '../fetch-mock'

const refresh = vi.fn()
let pathname = '/songs'
vi.mock('next/navigation', () => ({
  useRouter: () => ({refresh}),
  usePathname: () => pathname,
}))

import KeepFresh from '@/components/KeepFresh'

let server = 'a1'
let visible = 'visible'
beforeEach(() => {
  vi.useFakeTimers({shouldAdvanceTime: true})
  refresh.mockClear()
  server = 'a1'
  visible = 'visible'
  pathname = '/songs'
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visible,
  })
  mockFetch({'/api/changes': () => ({body: {stamp: server}})})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const settle = () => act(() => vi.advanceTimersByTimeAsync(0))

describe('KeepFresh', () => {
  it('leaves pages alone while nothing has changed', async () => {
    render(<KeepFresh stamp="a1" />)
    await settle()
    await act(() => vi.advanceTimersByTimeAsync(31_000))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('fetches again when someone changed something since', async () => {
    server = 'a2'
    render(<KeepFresh stamp="a1" />)
    await settle()
    expect(refresh).toHaveBeenCalledTimes(1)
    // Once: it now knows where the band is up to
    await act(() => vi.advanceTimersByTimeAsync(31_000))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('asks on a tab switch', async () => {
    const r = render(<KeepFresh stamp="a1" />)
    await settle()
    server = 'a2'
    pathname = '/setlists'
    r.rerender(<KeepFresh stamp="a1" />)
    await settle()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('asks on coming back to the app, not while it’s in the background', async () => {
    render(<KeepFresh stamp="a1" />)
    await settle()
    server = 'a2'
    visible = 'hidden'
    await act(() => vi.advanceTimersByTimeAsync(61_000))
    expect(refresh).not.toHaveBeenCalled()
    visible = 'visible'
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await settle()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('asks every 30 seconds while on screen', async () => {
    render(<KeepFresh stamp="a1" />)
    await settle()
    server = 'a2'
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('takes the stamp a fresh render was drawn with', async () => {
    const r = render(<KeepFresh stamp="a1" />)
    await settle()
    // Your own save refreshed the page: it already shows a2
    server = 'a2'
    r.rerender(<KeepFresh stamp="a2" />)
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('does nothing without signal', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    server = 'a2'
    render(<KeepFresh stamp="a1" />)
    await settle()
    expect(refresh).not.toHaveBeenCalled()
  })
})
