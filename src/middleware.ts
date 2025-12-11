
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAdminJwtEdge, verifyJwtEdge } from './lib/auth.edge';
import { JWTExpired } from 'jose/errors';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('session')?.value;
  const adminSessionToken = request.cookies.get('admin_session')?.value;

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup');
  const isAdminAuthPage = pathname.startsWith('/admin-login');
  const isDashboard = pathname.startsWith('/dashboard');
  const isAdminDashboard = pathname.startsWith('/admin/dashboard');

  let sessionValid = false;
  let adminSessionValid = false;
  let sessionExpired = false;
  let adminSessionExpired = false;

  // Use lightweight 'jose' for verification on the Edge
  if (sessionToken) {
    try {
      sessionValid = !!await verifyJwtEdge(sessionToken);
    } catch (error) {
      if (error instanceof JWTExpired) {
        sessionExpired = true;
      }
    }
  }

  if (adminSessionToken) {
    try {
      adminSessionValid = !!await verifyAdminJwtEdge(adminSessionToken);
    } catch (error) {
      if (error instanceof JWTExpired) {
        adminSessionExpired = true;
      }
    }
  }

  // If on admin dashboard and session is not valid (or expired), redirect to admin login
  if (isAdminDashboard && !adminSessionValid) {
    const response = NextResponse.redirect(new URL('/admin-login', request.url));
    if (adminSessionExpired || adminSessionToken) {
      response.cookies.delete('admin_session');
    }
    return response;
  }

  // If on user dashboard and session is not valid (or expired), redirect to user login
  if (isDashboard && !sessionValid) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    if (sessionExpired || sessionToken) {
      response.cookies.delete('session');
    }
    return response;
  }

  // If trying to access a login page while already logged in
  if (isAuthPage && sessionValid) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  if (isAdminAuthPage && adminSessionValid) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/dashboard/:path*', '/login', '/signup', '/admin-login'],
};
