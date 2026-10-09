import {beforeEach, describe, expect, it, vi} from 'vitest'

let prisma: any
let token: any
vi.mock('@/lib/db', () => ({
  get prisma() {
    return prisma
  },
}))
vi.mock('@/lib/email-tokens', () => ({findEmailToken: async () => token}))

import {POST} from '@/app/api/password/set/route'
import {verifyPassword} from '@/lib/password'

const post = (body: unknown) =>
  new Request('http://t/api/password/set', {
    method: 'POST',
    body: JSON.stringify(body),
  })

describe('POST /api/password/set', () => {
  beforeEach(() => {
    token = {userId: 'u1', user: {email: 'ana@example.com'}}
    prisma = {
      user: {update: vi.fn((a) => a)},
      emailToken: {updateMany: vi.fn((a) => a)},
      $transaction: vi.fn(async (ops: unknown[]) => ops),
    }
  })

  it('sets the password, signs out other sessions and spends every open link', async () => {
    const res = await POST(post({token: 't', password: 'a-long-enough-one'}))
    expect(await res.json()).toEqual({email: 'ana@example.com'})
    const [user, links] = prisma.$transaction.mock.calls[0][0]
    expect(user.where).toEqual({id: 'u1'})
    expect(user.data.sessionVersion).toEqual({increment: 1})
    expect(user.data.emailVerified).toBeInstanceOf(Date)
    expect(
      await verifyPassword('a-long-enough-one', user.data.passwordHash),
    ).toBe(true)
    expect(links.where).toEqual({userId: 'u1', usedAt: null})
  })

  it('refuses a used or expired link', async () => {
    token = null
    const res = await POST(post({token: 't', password: 'a-long-enough-one'}))
    expect(res.status).toBe(410)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('refuses a short password', async () => {
    const res = await POST(post({token: 't', password: 'short'}))
    expect(res.status).toBe(400)
  })
})
