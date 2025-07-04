import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get('session')?.value
  const adminSessionToken = request.cookies.get('admin_session')?.value

  const isAuthPage = pathname === '/login' || pathname === '/signup'
  const isAdminAuthPage = pathname === '/admin-login'
  const isDashboardPage = pathname.startsWith('/dashboard')
  const isAdminDashboardPage = pathname.startsWith('/admin/dashboard')
  
  // If trying to access the admin dashboard and no admin session exists, redirect to admin login
  if (isAdminDashboardPage && !adminSessionToken) {
    return NextResponse.redirect(new URL('/admin-login', request.url))
  }

  // If trying to access the user dashboard and no user session exists, redirect to login
  if (isDashboardPage && !sessionToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // If trying to access a regular auth page (login/signup) while logged in, redirect to dashboard
  if (isAuthPage && sessionToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // If trying to access the admin login page while an admin session exists, redirect to admin dashboard
  if (isAdminAuthPage && adminSessionToken) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  // Allow all other requests to proceed
  return NextResponse.next()
}

// Match all routes except for static assets, API routes, and public paths
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|s/|.*\\..*).*)',
  ],
}

    