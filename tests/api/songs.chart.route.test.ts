import {describe, it, expect, vi, beforeEach} from 'vitest'

const {saveChart, ConflictError} = vi.hoisted(() => {
  class ConflictError extends Error {
    latest: number
    constructor(latest: number) {
      super('conflict')
      this.latest = latest
    }
  }
  // A plain function, not vi.fn: vitest fails a test when a spy's
  // implementation throws, even if the code under test catches the error.
  const calls: unknown[] = []
  let impl: (args: unknown) => unknown = () => ({number: 1})
  const saveChart = Object.assign(
    async (args: unknown) => {
      calls.push(args)
      return impl(args)
    },
    {
      calls,
      use: (f: (args: unknown) => unknown) => (impl = f),
      reset: () => {
        calls.length = 0
        impl = () => ({number: 1})
      },
    },
  )
  return {saveChart, ConflictError}
})
vi.mock('@/lib/guard', async () => {
  const {ctx} = await import('../band')
  return {requireSession: vi.fn(async () => ctx({id: 'u1'}))}
})
vi.mock('@/lib/songs', () => ({saveChart, ConflictError}))

const post = (body: unknown) =>
  new Request('http://t/api/songs/s1/chart', {
    method: 'POST',
    body: JSON.stringify(body),
  })

describe('POST /api/songs/:id/chart', () => {
  beforeEach(() => saveChart.reset())

  it('saves a new version', async () => {
    const {POST} = await import('@/app/api/songs/[id]/chart/route')
    saveChart.use(() => ({number: 3}))
    const res = await POST(post({source: '[G]x', baseNumber: 2, note: 'hi'}), {
      params: {id: 's1'},
    })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({number: 3})
    expect(saveChart.calls[0]).toEqual({
      bandId: 'b1',
      songId: 's1',
      userId: 'u1',
      source: '[G]x',
      baseNumber: 2,
      note: 'hi',
    })
  })

  it('returns 409 when someone saved first', async () => {
    const {POST} = await import('@/app/api/songs/[id]/chart/route')
    saveChart.use(() => {
      throw new ConflictError(5)
    })
    const res = await POST(post({source: 'x', baseNumber: 4}), {
      params: {id: 's1'},
    })
    expect(res.status).toBe(409)
    expect((await res.json()).latest).toBe(5)
  })

  it('rejects a body without a base version', async () => {
    const {POST} = await import('@/app/api/songs/[id]/chart/route')
    const res = await POST(post({source: 'x'}), {params: {id: 's1'}})
    expect(res.status).toBe(400)
  })

  it("404s for a song that isn't in this band", async () => {
    saveChart.use(() => null)
    const {POST} = await import('@/app/api/songs/[id]/chart/route')
    const res = await POST(post({source: '[G]x', baseNumber: 0}), {
      params: {id: 's9'},
    })
    expect(res.status).toBe(404)
  })
})
