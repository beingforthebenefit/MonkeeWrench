import {describe, it, expect, vi, beforeEach} from 'vitest'

let prisma: any

vi.mock('@/lib/db', () => ({
  get prisma() {
    return prisma
  },
}))
vi.mock('@/lib/guard', () => ({
  requireAdmin: vi.fn(async () => ({id: 'admin1'})),
}))

describe('/api/admin/users/[id] routes', () => {
  beforeEach(() => {
    prisma = {
      user: {
        update: vi.fn(),
        delete: vi.fn(),
      },
    }
  })

  it('PATCH requires isAdmin boolean', async () => {
    const {PATCH} = await import('@/app/api/admin/users/[id]/route')
    const req = new Request('http://x', {
      method: 'PATCH',
      body: JSON.stringify({}),
    })
    const res = await PATCH(req, {params: {id: 'u1'}})
    expect(res.status).toBe(400)
  })

  it('DELETE returns 204', async () => {
    const {DELETE} = await import('@/app/api/admin/users/[id]/route')
    const res = await DELETE(new Request('http://x'), {params: {id: 'u1'}})
    expect(res.status).toBe(204)
  })
})
