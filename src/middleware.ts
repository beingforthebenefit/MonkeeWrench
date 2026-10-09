import {NextResponse, type NextRequest} from 'next/server'

// Session cookie names NextAuth uses (secure prefix when served over https)
const SESSION_COOKIES = [
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
]

// Read-only endpoints that are deliberately public
const PUBLIC_API = [
  /^\/api\/auth\//,
  /^\/api\/health$/,
  // Calendar apps fetch the feed with no session; its URL holds a secret
  /^\/api\/calendar\/[^/]+$/,
  // Starting a band, and setting a password from an emailed link
  /^\/api\/signup$/,
  /^\/api\/password\/(forgot|set)$/,
  // Polar's webhooks: signed, checked in the route
  /^\/api\/billing\/webhook$/,
  // Caddy, asking whether to get a certificate for a band's web address
  /^\/api\/tls\/ask$/,
]

export function middleware(req: NextRequest) {
  const {pathname, search} = req.nextUrl

  if (pathname.startsWith('/api/')) {
    // The route guards throw a Response, which Next.js turns into a 500.
    // Answer the common case (no session at all) here with a proper 401.
    const signedIn = SESSION_COOKIES.some((c) => req.cookies.has(c))
    if (!signedIn && !PUBLIC_API.some((r) => r.test(pathname)))
      return new NextResponse('Unauthorized', {status: 401})
    // The guards can't see the method; they need it to keep a lapsed hosted
    // band read-only. Always set here, so a request can't claim its own.
    const headers = new Headers(req.headers)
    headers.set('x-request-method', req.method)
    return NextResponse.next({request: {headers}})
  }

  // Expose the requested path to server layouts so a sign-in redirect can
  // return the user to the page they asked for.
  const headers = new Headers(req.headers)
  headers.set('x-pathname', pathname + search)
  return NextResponse.next({request: {headers}})
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
