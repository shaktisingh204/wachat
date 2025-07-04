
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get('session')?.value
  const adminSessionToken = request.cookies.get('admin_session')?.value

  const isAuthPath = pathname.startsWith('/login') || pathname.startsWith('/signup')
  const isAdminAuthPath = pathname.startsWith('/admin-login')

  const publicPaths = [
    '/',
    '/terms-and-conditions',
    '/privacy-policy',
  ];
  const publicPrefixes = ['/s/']; // For URL shortener links

  const isApiRoute = pathname.startsWith('/api/');

  // Determine if the path is public
  const isPublicPath = 
    publicPaths.includes(pathname) ||
    publicPrefixes.some(prefix => pathname.startsWith(prefix)) ||
    isAuthPath ||
    isAdminAuthPath ||
    isApiRoute;

  // 1. Admin Session Management
  if (adminSessionToken) {
    // If admin is logged in and tries to access admin login page, redirect to admin dashboard
    if (isAdminAuthPath) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }
  } else {
    // If admin is not logged in and tries to access protected admin routes, redirect to admin login
    if (pathname.startsWith('/admin/dashboard')) {
      return NextResponse.redirect(new URL('/admin-login', request.url))
    }
  }

  // 2. User Session Management
  if (sessionToken) {
    // If user is logged in and tries to access login/signup pages, redirect to dashboard
    if (isAuthPath) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  } else {
    // If user is not logged in and tries to access a protected route
    if (!isPublicPath && !pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // 3. Allow request to proceed if no redirect conditions are met
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all routes except for static files and special Next.js paths
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}
