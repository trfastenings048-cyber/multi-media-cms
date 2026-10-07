import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Authorized team members / user accounts for TR Fastenings Multimedia CMS
const SESSION_COOKIE = 'tr-cms-session'

// Next.js 16 Proxy Middleware convention (replaces legacy middleware.ts)
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = request.cookies.has(SESSION_COOKIE)

  // Public: Next.js internals, static files, the screen viewer (/view/*), sign-in/out APIs,
  // and read-only screen APIs used by the desktop player (GET /api/screens/**).
  const isReadOnly = request.method === 'GET' || request.method === 'HEAD'
  const isPublicApi =
    pathname.startsWith('/api/auth') || (isReadOnly && pathname.startsWith('/api/screens'))

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/view') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico' ||
    isPublicApi
  ) {
    return NextResponse.next()
  }

  // Every other API route (uploads, documents, playlists, any write) needs a session.
  if (pathname.startsWith('/api')) {
    return hasSession
      ? NextResponse.next()
      : NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  // Redirect unauthenticated requests to login page
  if (!hasSession && pathname !== '/login') {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated requests away from login page to home
  if (hasSession && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
