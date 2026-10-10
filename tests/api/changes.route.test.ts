// @vitest-environment node
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {prismaMock} from '../prisma-mock'

let db: any
vi.mock('@/lib/db', () => ({
  get prisma() {
    return db
  },
}))
const requireSession = vi.fn(async (_opts?: unknown) => ({
  user: {id: 'u1'},
  band: {id: 'b1'},
}))
vi.mock('@/lib/guard', () => ({
  requireSession: (opts?: unknown) => requireSession(opts),
}))

import {GET} from '@/app/api/changes/route'
import {bandStamp} from '@/lib/changes'

beforeEach(() => {
  db = prismaMock()
  requireSession.mockClear()
})

describe('bandStamp', () => {
  it('is the newest change the band sees, its own or a member’s own', async () => {
    db.activity.findFirst.mockResolvedValue({id: 'a9'})
    expect(await bandStamp('b1')).toBe('a9')
    const q = db.activity.findFirst.mock.calls[0][0]
    expect(q.orderBy).toEqual({createdAt: 'desc'})
    expect(q.where.OR).toEqual([
      {bandId: 'b1'},
      {bandId: null, user: {memberships: {some: {bandId: 'b1'}}}},
    ])
  })

  it('is empty for a band where nothing has happened yet', async () => {
    expect(await bandStamp('b1')).toBe('')
  })
})

describe('/api/changes', () => {
  it('answers with the stamp, never cached, even for a lapsed band', async () => {
    db.activity.findFirst.mockResolvedValue({id: 'a3'})
    const res = await GET()
    expect(await res.json()).toEqual({stamp: 'a3'})
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(requireSession).toHaveBeenCalledWith({allowLapsed: true})
  })
})
