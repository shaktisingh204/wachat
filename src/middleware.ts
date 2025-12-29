
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAdminJwtEdge, verifyJwtEdge } from './lib/auth.edge';
import type { JWTExpired } from 'jose/errors';

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

  // Use the environment variable for the base URL, falling back to the request URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  // Use lightweight 'jose' for verification on the Edge
  if (sessionToken) {
    try {
      sessionValid = !!await verifyJwtEdge(sessionToken);
    } catch (error: any) {
      if (error.code === 'ERR_JWT_EXPIRED' || error.code === 'auth/id-token-expired') {
        sessionExpired = true;
      }
    }
  }

  if (adminSessionToken) {
    try {
      adminSessionValid = !!await verifyAdminJwtEdge(adminSessionToken);
    } catch (error: any) {
      if (error.code === 'ERR_JWT_EXPIRED') {
        adminSessionExpired = true;
      }
    }
  }

  // If on admin dashboard and session is not valid (or expired), redirect to admin login
  if (isAdminDashboard && !adminSessionValid) {
    const response = NextResponse.redirect(new URL('/admin-login', appUrl));
    if (adminSessionExpired || adminSessionToken) {
      response.cookies.delete('admin_session');
    }
    return response;
  }

  // If on user dashboard and session is not valid (or expired), redirect to user login
  if (isDashboard && !sessionValid) {
    const response = NextResponse.redirect(new URL('/login', appUrl));
    if (sessionExpired || sessionToken) {
      response.cookies.delete('session');
    }
    return response;
  }

  // If trying to access a login page while already logged in
  if (isAuthPage && sessionValid) {
    return NextResponse.redirect(new URL('/dashboard', appUrl));
  }
  if (isAdminAuthPage && adminSessionValid) {
    return NextResponse.redirect(new URL('/admin/dashboard', appUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/dashboard/:path*', '/login', '/signup', '/admin-login'],
};
