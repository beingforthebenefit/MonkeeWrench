import {beforeEach, describe, expect, it, vi} from 'vitest'

let prisma: any
vi.mock('@/lib/db', () => ({
  get prisma() {
    return prisma
  },
}))

import {GET} from '@/app/api/tls/ask/route'

const ask = (domain?: string) =>
  GET(
    new Request(
      'http://app:3000/api/tls/ask' + (domain ? `?domain=${domain}` : ''),
    ),
  )

describe('GET /api/tls/ask (may Caddy get a certificate?)', () => {
  beforeEach(() => {
    process.env.APP_HOST = 'app.bandstand.info'
    prisma = {
      bandDomain: {
        findUnique: vi.fn(async ({where}: any) =>
          where.host === 'members.myband.com' ? {host: where.host} : null,
        ),
      },
    }
  })

  it('yes for the service’s own address', async () => {
    expect((await ask('app.bandstand.info')).status).toBe(200)
  })

  it('yes for a band’s own address, whatever its case', async () => {
    expect((await ask('Members.MyBand.com')).status).toBe(200)
  })

  it('no for anything else', async () => {
    expect((await ask('evil.example.com')).status).toBe(404)
    expect((await ask()).status).toBe(400)
  })
})
