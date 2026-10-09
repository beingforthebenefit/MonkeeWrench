import {beforeEach, describe, expect, it, vi} from 'vitest'

let rows: any[]
let prisma: any
vi.mock('@/lib/db', () => ({
  get prisma() {
    return prisma
  },
}))
vi.mock('@/lib/band', () => ({PRODUCT: 'Bandstand'}))
vi.mock('@/lib/mail', () => ({sendMail: vi.fn()}))

import {
  createEmailToken,
  emailFor,
  findEmailToken,
  setPasswordUrl,
} from '@/lib/email-tokens'

const now = new Date('2026-10-09T12:00:00Z')

describe('emailed password links', () => {
  beforeEach(() => {
    rows = []
    prisma = {
      emailToken: {
        updateMany: vi.fn(({where, data}) => {
          rows
            .filter(
              (r) =>
                r.userId === where.userId && r.kind === where.kind && !r.usedAt,
            )
            .forEach((r) => Object.assign(r, data))
          return 'updateMany'
        }),
        create: vi.fn(({data}) => {
          rows.push({...data, usedAt: null})
          return 'create'
        }),
        findUnique: vi.fn(async ({where}) => {
          const r = rows.find((r) => r.tokenHash === where.tokenHash)
          return r && {...r, user: {id: r.userId, email: 'a@x.com'}}
        }),
      },
      $transaction: async (ops: unknown[]) => ops,
    }
  })

  it('stores only a hash of the link', async () => {
    const token = await createEmailToken('u1', 'INVITE', now)
    expect(token.length).toBeGreaterThan(40)
    expect(JSON.stringify(rows)).not.toContain(token)
  })

  it('finds a fresh link, and not an expired one', async () => {
    const reset = await createEmailToken('u1', 'RESET', now)
    expect(await findEmailToken(reset, now)).toMatchObject({userId: 'u1'})
    const later = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    expect(await findEmailToken(reset, later)).toBeNull()
  })

  it('invites last a week; a newer link replaces the older one', async () => {
    const first = await createEmailToken('u1', 'INVITE', now)
    const sixDays = new Date(now.getTime() + 6 * 86400000)
    expect(await findEmailToken(first, sixDays)).not.toBeNull()
    const second = await createEmailToken('u1', 'INVITE', now)
    expect(await findEmailToken(first, now)).toBeNull()
    expect(await findEmailToken(second, now)).not.toBeNull()
  })

  it('knows nothing of a made-up link', async () => {
    expect(await findEmailToken('nope', now)).toBeNull()
    expect(await findEmailToken('', now)).toBeNull()
  })

  it('writes the link and the email for each kind', () => {
    const url = setPasswordUrl('https://app.test', 'a/b')
    expect(url).toBe('https://app.test/set-password?token=a%2Fb')
    const invite = emailFor('INVITE', {url, bandName: 'The Reeds', by: 'Ana'})
    expect(invite.subject).toBe('Ana added you to The Reeds on Bandstand')
    expect(invite.text).toContain(url)
    expect(emailFor('RESET', {url}).text).toContain('an hour')
  })
})
