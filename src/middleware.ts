
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get('session')?.value

  const isPublicPath =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/admin-login') ||
    pathname.startsWith('/api/webhooks') || // Allow webhooks to be public
    pathname.startsWith('/api/cron'); // Allow cron jobs to be public

  const isAuthPath = pathname.startsWith('/login') || pathname.startsWith('/signup')

  // If a user has a session token
  if (sessionToken) {
    // and they are trying to access an auth page, redirect them to the dashboard.
    if (isAuthPath) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    // Otherwise, allow them to proceed. The actual validation will happen in the layout.
    return NextResponse.next()
  }

  // If a user does not have a session token
  if (!sessionToken) {
    // and they are trying to access a protected page (not public)
    if (!isPublicPath) {
      // but allow access to the admin area for now (it has its own login)
      if (pathname.startsWith('/admin')) {
        return NextResponse.next();
      }
      // redirect them to the login page.
      return NextResponse.redirect(new URL('/login', request.url))
    }
    // Otherwise, allow access to the public page.
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all routes except for static files and special Next.js paths
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}
