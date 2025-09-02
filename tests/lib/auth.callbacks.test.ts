import {describe, it, expect, vi, beforeEach} from 'vitest'

let prisma: any

vi.mock('@/lib/db', () => ({
  get prisma() {
    return prisma
  },
}))

function gp(email: string, verified = true) {
  return {
    email,
    email_verified: verified,
    name: 'Test User',
    picture: 'http://img',
  }
}

describe('auth callbacks', () => {
  beforeEach(() => {
    prisma = {
      settings: {findUnique: vi.fn().mockResolvedValue({adminAllowlist: []})},
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
      account: {findUnique: vi.fn().mockResolvedValue(null), create: vi.fn()},
    }
    // default env allowlists
    process.env.ADMIN_ALLOWLIST = ''
    process.env.USER_ALLOWLIST = ''
    process.env.GOOGLE_CLIENT_ID = 'test-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret'
  })

  it('signIn denies when no email', async () => {
    const {authOptions} = await import('@/lib/auth')
    const ok = await authOptions.callbacks!.signIn!({
      // @ts-expect-error - narrow args
      account: {provider: 'google'},
      profile: {},
    })
    expect(ok).toBe(false)
  })

  it('signIn allows admin allowlist via env', async () => {
    process.env.ADMIN_ALLOWLIST = 'admin@x.test'
    const {authOptions} = await import('@/lib/auth')
    const ok = await authOptions.callbacks!.signIn!({
      // @ts-expect-error - narrow args
      account: {provider: 'google'},
      profile: gp('admin@x.test', true),
    })
    expect(ok).toBe(true)
  })

  it('session callback enriches session from DB', async () => {
    const {authOptions} = await import('@/lib/auth')
    prisma.user.findUnique.mockResolvedValue({
      isAdmin: true,
      image: 'i',
      name: 'n',
    })
    const session = await authOptions.callbacks!.session!({
      session: {user: {email: 'u@x', name: null, image: null}} as any,
    } as any)
    expect(session.user?.isAdmin).toBe(true)
    expect(session.user?.image).toBe('i')
    expect(session.user?.name).toBe('n')
  })
})
