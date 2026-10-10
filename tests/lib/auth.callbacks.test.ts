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
          id: 'u1',
          email: 'ken@example.com',
          name: 'Kenneth Johnson',
          displayName: 'Ken',
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

describe('Google sign-in', () => {
  beforeEach(() => {
    prisma = {
      user: {
        findFirst: vi.fn(async ({where}: any) =>
          where.email.equals.toLowerCase() === 'ken@example.com'
            ? {id: 'u1', email: 'ken@example.com', sessionVersion: 4}
            : null,
        ),
        findUnique: vi.fn(),
      },
    }
  })

  it('lets in a member whose verified Google email matches', async () => {
    const {authOptions} = await import('@/lib/auth')
    const ok = await authOptions.callbacks!.signIn!({
      account: {provider: 'google'},
      profile: {email: 'Ken@Example.com', email_verified: true},
    } as any)
    expect(ok).toBe(true)
  })

  it('turns away someone who is not a member, or an unverified email', async () => {
    const {authOptions} = await import('@/lib/auth')
    for (const profile of [
      {email: 'stranger@example.com', email_verified: true},
      {email: 'ken@example.com', email_verified: false},
    ])
      expect(
        await authOptions.callbacks!.signIn!({
          account: {provider: 'google'},
          profile,
        } as any),
      ).toBe('/login?error=NotMember')
  })

  it('on the hosted service, signs up a new verified address with no band', async () => {
    vi.resetModules()
    vi.stubEnv('BANDSTAND_HOSTED', '1')
    prisma.user.create = vi.fn(async ({data}: any) => ({id: 'u9', ...data}))
    const {authOptions} = await import('@/lib/auth')
    const ok = await authOptions.callbacks!.signIn!({
      account: {provider: 'google'},
      profile: {
        email: 'New.Player@Example.com',
        email_verified: true,
        name: 'Rosa Diaz',
      },
    } as any)
    expect(ok).toBe(true)
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'new.player@example.com',
        name: 'Rosa Diaz',
        displayName: 'Rosa',
      }),
    })
    // Still never for an address Google hasn't verified
    prisma.user.create.mockClear()
    expect(
      await authOptions.callbacks!.signIn!({
        account: {provider: 'google'},
        profile: {email: 'x@example.com', email_verified: false},
      } as any),
    ).toBe('/login?error=NotMember')
    expect(prisma.user.create).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('maps the Google account to the member by email in the token', async () => {
    const {authOptions} = await import('@/lib/auth')
    const token = await authOptions.callbacks!.jwt!({
      token: {},
      user: {id: 'google-sub-123', email: 'ken@example.com'},
      account: {provider: 'google'},
    } as any)
    expect(token).toMatchObject({uid: 'u1', sv: 4})
  })
})
