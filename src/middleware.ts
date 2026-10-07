import {NextResponse, type NextRequest} from 'next/server'

// Session cookie names NextAuth uses (secure prefix when served over https)
const SESSION_COOKIES = [
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
]

// Read-only endpoints that are deliberately public
const PUBLIC_API = [
  /^\/api\/auth\//,
  /^\/api\/proposals\/(pending|pending\/count|approved)$/,
]

export function middleware(req: NextRequest) {
  const {pathname, search} = req.nextUrl

  if (pathname.startsWith('/api/')) {
    // The route guards throw a Response, which Next.js turns into a 500.
    // Answer the common case (no session at all) here with a proper 401.
    const signedIn = SESSION_COOKIES.some((c) => req.cookies.has(c))
    if (!signedIn && !PUBLIC_API.some((r) => r.test(pathname)))
      return new NextResponse('Unauthorized', {status: 401})
    return NextResponse.next()
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
