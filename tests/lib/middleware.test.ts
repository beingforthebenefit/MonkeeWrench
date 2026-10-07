import {describe, it, expect} from 'vitest'
import {NextRequest} from 'next/server'
import {middleware} from '@/middleware'

const req = (path: string, cookie?: string) =>
  new NextRequest(new URL('http://x' + path), {
    headers: cookie ? {cookie} : {},
  })

describe('middleware', () => {
  it('answers signed-out API calls with 401, not a 500 from the guard', () => {
    expect(middleware(req('/api/songs')).status).toBe(401)
    expect(middleware(req('/api/songs/abc/pdf')).status).toBe(401)
  })

  it('lets sign-in and the public proposal lists through', () => {
    for (const p of ['/api/auth/session', '/api/health'])
      expect(middleware(req(p)).status).toBe(200)
  })

  it('lets a request with a session cookie reach the route guard', () => {
    expect(
      middleware(req('/api/songs', 'next-auth.session-token=t')).status,
    ).toBe(200)
    expect(
      middleware(req('/api/songs', '__Secure-next-auth.session-token=t'))
        .status,
    ).toBe(200)
  })

  it('passes the requested page path to layouts', () => {
    const res = middleware(req('/songs?x=1'))
    expect(res.headers.get('x-middleware-request-x-pathname')).toBe(
      '/songs?x=1',
    )
  })
})
