import {describe, it, expect, vi} from 'vitest'

vi.mock('@/lib/guard', () => ({
  requireSession: vi.fn(async () => ({user: {id: 'u1'}})),
}))

describe('/api/stream GET', () => {
  it('returns SSE headers', async () => {
    const {GET} = await import('@/app/api/stream/route')
    const res = await GET()
    expect(res.headers.get('Content-Type')).toMatch('text/event-stream')
    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-transform')
  })
})
