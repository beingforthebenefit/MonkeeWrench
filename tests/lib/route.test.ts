import {describe, it, expect} from 'vitest'
import {route} from '@/lib/route'

describe('route()', () => {
  it('returns a thrown Response (a guard refusing) instead of a 500', async () => {
    const h = route(async () => {
      throw new Response('Unauthorized', {status: 401})
    })
    expect((await h()).status).toBe(401)
  })

  it('passes normal responses and real errors through', async () => {
    expect((await route(async () => new Response('ok'))()).status).toBe(200)
    await expect(
      route(async () => {
        throw new Error('boom')
      })(),
    ).rejects.toThrow('boom')
  })
})
