import {describe, it, expect, vi} from 'vitest'

vi.mock('@/lib/guard', () => ({
  requireSession: vi.fn(async () => ({user: {id: 'u1'}})),
}))

describe('/api/stream GET', () => {
  it('returns SSE headers', async () => {
    vi.resetModules()
    const {GET} = await import('@/app/api/stream/route')
    const res = await GET()
    expect(res.headers.get('Content-Type')).toMatch('text/event-stream')
    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-transform')
  })

  it('unsubscribes from bus on stream cancel', async () => {
    vi.resetModules()
    vi.doMock('@/lib/events', () => ({
      bus: {on: vi.fn(), off: vi.fn()},
      EVENTS: {PROPOSAL_UPDATED: 'u', PROPOSAL_CREATED: 'c'},
    }))
    const {GET} = await import('@/app/api/stream/route')
    const res = await GET()
    expect(res.body).toBeTruthy()
    // Cancel the stream to trigger cleanup
    // @ts-expect-error types for web streams
    await res.body?.cancel()
    const {bus} = await import('@/lib/events')
    expect(bus.off as any).toHaveBeenCalled()
  })
})
