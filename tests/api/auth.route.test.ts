import {describe, it, expect, vi} from 'vitest'

const mockHandler = vi.fn(() => new Response('ok'))

vi.mock('next-auth', () => ({
  default: vi.fn(() => mockHandler),
}))

describe('/api/auth route exports handler', () => {
  it('exports GET and POST from NextAuth(authOptions)', async () => {
    const mod = await import('@/app/api/auth/[...nextauth]/route')
    expect(typeof mod.GET).toBe('function')
    expect(typeof mod.POST).toBe('function')
    const res = await mod.GET(new Request('http://x'))
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toBe('ok')
  })
})
