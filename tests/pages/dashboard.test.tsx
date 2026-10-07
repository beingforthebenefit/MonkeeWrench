import {describe, it, expect, vi} from 'vitest'

const redirect = vi.fn(() => {
  throw new Error('NEXT_REDIRECT')
})
vi.mock('next/navigation', () => ({redirect}))

describe('Home page (src/app/page.tsx)', () => {
  it('sends everyone to the song list', async () => {
    const Home = (await import('@/app/page')).default
    expect(() => Home()).toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/songs')
  })
})
