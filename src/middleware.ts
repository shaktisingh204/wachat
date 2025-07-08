
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAdminJwtForMiddleware, verifyJwtForMiddleware } from './lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get('session')?.value
  const adminSessionToken = request.cookies.get('admin_session')?.value

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/admin-login');
  const isDashboard = pathname.startsWith('/dashboard');
  const isAdminDashboard = pathname.startsWith('/admin/dashboard');

  const sessionValid = sessionToken ? await verifyJwtForMiddleware(sessionToken) : false;
  const adminSessionValid = adminSessionToken ? await verifyAdminJwtForMiddleware(adminSessionToken) : false;

  if (isAdminDashboard && !adminSessionValid) {
    return NextResponse.redirect(new URL('/admin-login', request.url));
  }

  if (isDashboard && !sessionValid) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthPage) {
    if (sessionValid && !pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (adminSessionValid && pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

// Updated matcher to be simpler. It protects dashboards and handles auth page redirects.
// It no longer needs to exclude short URL paths because they are not protected.
export const config = {
  matcher: ['/dashboard/:path*', '/admin/dashboard/:path*', '/login', '/signup', '/admin-login'],
}
