import { type NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE_NAME = '__session'

/**
 * Middleware gates /admin/* routes.
 *
 * It only checks for the cookie's presence — full cryptographic verification
 * happens server-side inside each admin page via requireAdmin().
 *
 * This is intentional: middleware runs on the edge and cannot use the
 * Firebase Admin SDK (Node.js only). The real auth check is in requireAdmin().
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  // Protect /admin/* routes
  if (pathname.startsWith('/admin')) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)

    if (!sessionCookie?.value) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
