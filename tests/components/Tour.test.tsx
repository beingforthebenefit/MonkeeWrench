import {render, screen, fireEvent, cleanup} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  usePathname: () => '/songs',
  useRouter: () => ({push}),
}))

async function tour(demo: boolean) {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_DEMO', demo ? '1' : '')
  return (await import('@/components/tour/Tour')).default
}

describe('Tour', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/songs')
    window.fetch = vi.fn(async () => new Response('{}')) as typeof fetch
    push.mockClear()
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  it('opens by itself for someone who has not taken it', async () => {
    const Tour = await tour(false)
    render(<Tour auto />)
    expect(screen.getByLabelText('Tour')).toBeTruthy()
  })

  it('stays shut for someone who has', async () => {
    const Tour = await tour(false)
    render(<Tour auto={false} />)
    expect(screen.queryByLabelText('Tour')).toBeNull()
  })

  it('in the public demo, opens once per browser', async () => {
    const Tour = await tour(true)
    const first = render(<Tour auto />)
    fireEvent.click(screen.getByText('Skip tour'))
    expect(localStorage.getItem('ms:tour-done')).toBe('1')
    first.unmount()
    render(<Tour auto />)
    expect(screen.queryByLabelText('Tour')).toBeNull()
  })

  it('outside the demo, the account remembers, not the browser', async () => {
    const Tour = await tour(false)
    render(<Tour auto />)
    fireEvent.click(screen.getByText('Skip tour'))
    expect(localStorage.getItem('ms:tour-done')).toBeNull()
    expect(window.fetch).toHaveBeenCalledWith(
      '/api/account/settings',
      expect.objectContaining({method: 'PATCH'}),
    )
  })

  it('leaves out the scheduling steps in a band that has scheduling off', async () => {
    const {stepsFor} = await import('@/components/tour/steps')
    const on = stepsFor({scheduling: true})
    const off = stepsFor({scheduling: false})
    expect(on.length - off.length).toBe(2)
    expect(off.some((s) => s.needs)).toBe(false)

    const Tour = await tour(false)
    const {unmount} = render(<Tour auto features={{scheduling: false}} />)
    expect(screen.getByText(`1 of ${off.length}`)).toBeTruthy()
    unmount()
    render(<Tour auto features={{scheduling: true}} />)
    expect(screen.getByText(`1 of ${on.length}`)).toBeTruthy()
  })

  it('ends back on the songs, wherever its last step was', async () => {
    const Tour = await tour(false)
    render(<Tour auto />)
    window.history.replaceState(null, '', '/rehearsals')
    fireEvent.click(screen.getByText('Skip tour'))
    expect(push).toHaveBeenCalledWith('/songs')
  })

  it('stays put when ended on the songs', async () => {
    const Tour = await tour(false)
    render(<Tour auto />)
    fireEvent.click(screen.getByText('Skip tour'))
    expect(push).not.toHaveBeenCalled()
  })

  it('ends the public demo with a way to start a real band', async () => {
    const {stepsFor} = await import('@/components/tour/steps')
    const app = stepsFor({scheduling: true})
    const demo = stepsFor({scheduling: true, demo: true})
    expect(demo.length - app.length).toBe(1)
    expect(app.some((s) => s.cta)).toBe(false)
    const last = demo[demo.length - 1]
    expect(last.cta?.href).toBe('https://app.bandstand.info/start')

    // On the card: a link, where Done would be
    sessionStorage.setItem('ms:tour-step', String(demo.length - 1))
    const Tour = await tour(true)
    render(<Tour auto={false} features={{scheduling: true, demo: true}} />)
    expect(screen.getByRole('link', {name: 'Start your band'})).toHaveAttribute(
      'href',
      'https://app.bandstand.info/start',
    )
    expect(screen.queryByText('Done')).toBeNull()
  })
})
