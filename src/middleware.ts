import {NextResponse, type NextRequest} from 'next/server'

// Expose the requested path to server layouts so a sign-in redirect can
// return the user to the page they asked for.
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers)
  headers.set('x-pathname', req.nextUrl.pathname + req.nextUrl.search)
  return NextResponse.next({request: {headers}})
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
