import {describe, it, expect, vi, beforeEach} from 'vitest'
import {hashPassword} from '@/lib/password'
import {isThrottled, resetThrottleForTests} from '@/lib/login-throttle'

let prisma: any
vi.mock('@/lib/db', () => ({
  get prisma() {
    return prisma
  },
}))

async function authorize(email: string, password: string, ip = '1.2.3.4') {
  const {authOptions} = await import('@/lib/auth')
  const provider: any = authOptions.providers[0]
  return provider.options.authorize(
    {email, password},
    {headers: {'x-forwarded-for': ip}},
  )
}

describe('password sign-in', () => {
  let hash: string
  beforeEach(async () => {
    resetThrottleForTests()
    hash ??= await hashPassword('k7mq-x2vd-9rta-hp3e')
    prisma = {
      user: {
        findFirst: vi.fn(async ({where}: any) =>
          where.email.equals === 'ken@example.com'
            ? {
                id: 'u1',
                email: 'ken@example.com',
                name: 'Kenneth Johnson',
                displayName: 'Ken',
                passwordHash: hash,
              }
            : null,
        ),
        findUnique: vi.fn(),
      },
    }
  })

  it('signs in with the right password, any email case', async () => {
    expect(await authorize('Ken@Example.com ', 'k7mq-x2vd-9rta-hp3e')).toEqual({
      id: 'u1',
      email: 'ken@example.com',
      name: 'Ken',
    })
  })

  it('refuses a wrong password or unknown email, and counts the failure', async () => {
    expect(await authorize('ken@example.com', 'nope')).toBeNull()
    expect(await authorize('who@example.com', 'nope')).toBeNull()
    for (let i = 0; i < 7; i++) await authorize('ken@example.com', 'nope')
    expect(isThrottled('ken@example.com', '9.9.9.9')).toBe(true)
    await expect(
      authorize('ken@example.com', 'k7mq-x2vd-9rta-hp3e'),
    ).rejects.toThrow('throttled')
  })

  it('refuses a member with no password yet', async () => {
    prisma.user.findFirst = vi.fn(async () => ({
      id: 'u2',
      email: 'ed@example.com',
      passwordHash: null,
    }))
    expect(await authorize('ed@example.com', 'anything')).toBeNull()
  })
})

describe('session callbacks', () => {
  beforeEach(() => {
    prisma = {
      user: {
        findUnique: vi.fn(async () => ({
          email: 'ken@example.com',
          name: 'Kenneth Johnson',
          displayName: 'Ken',
          isAdmin: false,
          sessionVersion: 3,
        })),
      },
    }
  })

  it('stamps the session version into the token at sign-in', async () => {
    const {authOptions} = await import('@/lib/auth')
    const token = await authOptions.callbacks!.jwt!({
      token: {},
      user: {id: 'u1'},
    } as any)
    expect(token).toMatchObject({uid: 'u1', sv: 3})
  })

  it('fills the session from the database while the version matches', async () => {
    const {authOptions} = await import('@/lib/auth')
    const s: any = await authOptions.callbacks!.session!({
      session: {expires: 'x'},
      token: {uid: 'u1', sv: 3},
    } as any)
    expect(s.user).toEqual({
      email: 'ken@example.com',
      name: 'Ken',
      image: null,
      isAdmin: false,
    })
  })

  it('drops the user once the password has been reset (version moved on)', async () => {
    const {authOptions} = await import('@/lib/auth')
    const s: any = await authOptions.callbacks!.session!({
      session: {expires: 'x'},
      token: {uid: 'u1', sv: 2},
    } as any)
    expect(s.user).toBeUndefined()
  })
})
