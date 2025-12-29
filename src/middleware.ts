
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAdminJwtEdge, verifyJwtEdge } from './lib/auth.edge';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log(`[MIDDLEWARE] Checking path: ${pathname}`);

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

  if (sessionToken) {
    try {
      console.log('[MIDDLEWARE] Found user session token, verifying...');
      const decoded = await verifyJwtEdge(sessionToken);
      sessionValid = !!decoded;
      console.log(`[MIDDLEWARE] User session validation result: ${sessionValid}`);
    } catch (error: any) {
      if (error.code === 'ERR_JWT_EXPIRED') {
        console.log('[MIDDLEWARE] User session token expired.');
        sessionExpired = true;
      } else {
        console.error('[MIDDLEWARE] User session verification error:', error.message);
      }
    }
  }

  if (adminSessionToken) {
    try {
      console.log('[MIDDLEWARE] Found admin session token, verifying...');
      const decoded = await verifyAdminJwtEdge(adminSessionToken);
      adminSessionValid = !!decoded;
      console.log(`[MIDDLEWARE] Admin session validation result: ${adminSessionValid}`);
    } catch (error: any) {
      if (error.code === 'ERR_JWT_EXPIRED') {
        console.log('[MIDDLEWARE] Admin session token expired.');
        adminSessionExpired = true;
      } else {
         console.error('[MIDDLEWARE] Admin session verification error:', error.message);
      }
    }
  }

  // If on admin dashboard and session is not valid (or expired), redirect to admin login
  if (isAdminDashboard && !adminSessionValid) {
    console.log('[MIDDLEWARE] Admin dashboard access denied. Redirecting to /admin-login.');
    const response = NextResponse.redirect(new URL('/admin-login', appUrl));
    if (adminSessionExpired || adminSessionToken) {
      console.log('[MIDDLEWARE] Deleting expired/invalid admin cookie.');
      response.cookies.delete('admin_session');
    }
    return response;
  }

  // If on user dashboard and session is not valid (or expired), redirect to user login
  if (isDashboard && !sessionValid) {
    console.log('[MIDDLEWARE] User dashboard access denied. Redirecting to /login.');
    const response = NextResponse.redirect(new URL('/login', appUrl));
    if (sessionExpired || sessionToken) {
      console.log('[MIDDLEWARE] Deleting expired/invalid user cookie.');
      response.cookies.delete('session');
    }
    return response;
  }

  // If trying to access a login page while already logged in
  if (isAuthPage && sessionValid) {
    console.log('[MIDDLEWARE] User already logged in. Redirecting from auth page to /dashboard.');
    return NextResponse.redirect(new URL('/dashboard', appUrl));
  }
  if (isAdminAuthPage && adminSessionValid) {
    console.log('[MIDDLEWARE] Admin already logged in. Redirecting from admin login page to /admin/dashboard.');
    return NextResponse.redirect(new URL('/admin/dashboard', appUrl));
  }
  
  console.log('[MIDDLEWARE] All checks passed. Allowing request.');
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/dashboard/:path*', '/login', '/signup', '/admin-login'],
};
