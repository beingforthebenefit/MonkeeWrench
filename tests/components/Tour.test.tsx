import {render, screen, fireEvent, cleanup} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/songs',
  useRouter: () => ({push: vi.fn()}),
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
})
