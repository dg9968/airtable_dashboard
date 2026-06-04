import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/admin',
  '/airtable-dashboard',
  '/view-display',
  '/document-management',
]

export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)
  const { pathname } = request.nextUrl

  if (!sessionCookie && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/airtable-dashboard/:path*',
    '/view-display/:path*',
    '/document-management/:path*',
  ],
}
