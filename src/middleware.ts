
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
  
  // If trying to access the admin dashboard
  if (isAdminDashboardPage) {
    // If not an admin, redirect to admin login
    if (!adminSessionToken) {
      return NextResponse.redirect(new URL('/admin-login', request.url))
    }
    // Otherwise, allow access
    return NextResponse.next()
  }

  // If trying to access the user dashboard
  if (isDashboardPage) {
    // If not logged in, redirect to login
    if (!sessionToken) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    // Otherwise, allow access
    return NextResponse.next()
  }

  // If trying to access a regular auth page (login/signup)
  if (isAuthPage) {
    // If already logged in, redirect to the user dashboard
    if (sessionToken) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    // Otherwise, allow access
    return NextResponse.next()
  }

  // If trying to access the admin login page
  if (isAdminAuthPage) {
    // If already an admin, redirect to the admin dashboard
    if (adminSessionToken) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }
    // Otherwise, allow access
    return NextResponse.next()
  }

  // For all other pages (e.g., public landing page), allow access
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all routes except for static files, API routes, and special Next.js paths
    '/((?!_next/static|_next/image|favicon.ico|api/|s/|.*\\..*).*)',
  ],
}
