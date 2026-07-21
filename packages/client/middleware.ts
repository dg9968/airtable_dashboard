import { NextRequest, NextResponse } from 'next/server'

const PROTECTED_PREFIXES = [
  '/admin',
  '/airtable-dashboard',
  '/document-management',
]

// Better Auth sets one of these two cookie names depending on whether the
// connection is HTTPS (production) or HTTP (local dev).
// We check both to avoid importing better-auth/cookies, which pulls in
// jose → Node.js CompressionStream, crashing the Edge Runtime middleware.
function hasSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has('better-auth.session_token') ||
    request.cookies.has('__Secure-better-auth.session_token')
  )
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!hasSessionCookie(request) && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/airtable-dashboard/:path*',
    '/document-management/:path*',
  ],
}
