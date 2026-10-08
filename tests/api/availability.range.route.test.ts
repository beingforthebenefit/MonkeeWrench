import {describe, it, expect, vi, beforeEach} from 'vitest'

let prisma: any
let tx: any
vi.mock('@/lib/db', () => ({
  get prisma() {
    return prisma
  },
}))
let share = true
vi.mock('@/lib/guard', async () => {
  const {ctx} = await import('../band')
  return {
    requireSession: vi.fn(async () =>
      ctx({id: 'u1', shareAvailability: share}),
    ),
  }
})

const put = (body: unknown) =>
  new Request('http://x/api/availability/range', {
    method: 'PUT',
    body: JSON.stringify(body),
  })

describe('PUT /api/availability/range', () => {
  beforeEach(() => {
    tx = {
      unavailability: {deleteMany: vi.fn(), createMany: vi.fn()},
      user: {update: vi.fn()},
      activity: {create: vi.fn()},
    }
    prisma = {$transaction: vi.fn(async (fn: any) => fn(tx))}
  })

  it('marks every day in the range', async () => {
    const {PUT} = await import('@/app/api/availability/range/route')
    const res = await PUT(
      put({from: '2026-12-30', to: '2027-01-02', kind: 'OUT'}),
    )
    expect((await res.json()).days).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ])
    const rows = tx.unavailability.createMany.mock.calls[0][0].data
    expect(rows).toHaveLength(4)
    // Shared days: every band sees them, and the log line is personal
    expect(rows[0].scope).toBe('')
    expect(tx.activity.create.mock.calls[0][0].data.bandId).toBeNull()
  })

  it("someone who keeps each band's days separate marks this band's", async () => {
    share = false
    const {PUT} = await import('@/app/api/availability/range/route')
    await PUT(put({from: '2026-12-30', to: '2026-12-31', kind: 'OUT'}))
    share = true
    expect(tx.unavailability.deleteMany.mock.calls[0][0].where.scope).toBe('b1')
    expect(tx.unavailability.createMany.mock.calls[0][0].data[0].scope).toBe(
      'b1',
    )
    expect(tx.activity.create.mock.calls[0][0].data.bandId).toBe('b1')
  })

  it('can limit to weekdays (every Tuesday)', async () => {
    const {PUT} = await import('@/app/api/availability/range/route')
    const res = await PUT(
      put({from: '2026-11-01', to: '2026-11-30', kind: 'OUT', weekdays: [2]}),
    )
    expect((await res.json()).days).toEqual([
      '2026-11-03',
      '2026-11-10',
      '2026-11-17',
      '2026-11-24',
    ])
  })

  it('clears a range back to free', async () => {
    const {PUT} = await import('@/app/api/availability/range/route')
    await PUT(put({from: '2026-11-01', to: '2026-11-02', kind: null}))
    expect(tx.unavailability.deleteMany).toHaveBeenCalled()
    expect(tx.unavailability.createMany).not.toHaveBeenCalled()
  })

  it('refuses a backwards or over-long range', async () => {
    const {PUT} = await import('@/app/api/availability/range/route')
    expect(
      (await PUT(put({from: '2026-11-02', to: '2026-11-01', kind: 'OUT'})))
        .status,
    ).toBe(400)
    expect(
      (await PUT(put({from: '2026-01-01', to: '2028-01-01', kind: 'OUT'})))
        .status,
    ).toBe(400)
  })
})
