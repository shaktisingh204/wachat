

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAdminJwtEdge, verifyJwtEdge } from './lib/auth.edge';
import { JWTExpired } from 'jose/errors';

const AUTH_PAGES = ['/login', '/signup', '/forgot-password'];
const ADMIN_AUTH_PAGE = '/admin-login';
const DASHBOARD_PREFIX = '/dashboard';
const ADMIN_DASHBOARD_PREFIX = '/admin/dashboard';
const PENDING_APPROVAL_PAGE = '/pending-approval';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('session')?.value;
  const adminSessionToken = request.cookies.get('admin_session')?.value;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  const isAuthPage = AUTH_PAGES.some(page => pathname.startsWith(page));
  const isAdminAuthPage = pathname.startsWith(ADMIN_AUTH_PAGE);

  let isUserSessionValid = false;
  if (sessionToken) {
    try {
      isUserSessionValid = await verifyJwtEdge(sessionToken);
    } catch (e) {
      // Token is invalid or expired
      isUserSessionValid = false;
    }
  }

  let isAdminSessionValid = false;
  if (adminSessionToken) {
    try {
      isAdminSessionValid = !!(await verifyAdminJwtEdge(adminSessionToken));
    } catch (e) {
      isAdminSessionValid = false;
    }
  }

  // Handle redirects for logged-in users trying to access auth pages
  if (isAuthPage && isUserSessionValid) {
    return NextResponse.redirect(new URL(DASHBOARD_PREFIX, appUrl));
  }
  if (isAdminAuthPage && isAdminSessionValid) {
    return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PREFIX, appUrl));
  }

  // Handle redirects for protected pages for logged-out users
  if (pathname.startsWith(DASHBOARD_PREFIX) && !isUserSessionValid) {
    const response = NextResponse.redirect(new URL('/login', appUrl));
    if (sessionToken) response.cookies.delete('session'); // Clear invalid/expired cookie
    return response;
  }
  if (pathname.startsWith(ADMIN_DASHBOARD_PREFIX) && !isAdminSessionValid) {
    const response = NextResponse.redirect(new URL(ADMIN_AUTH_PAGE, appUrl));
    if (adminSessionToken) response.cookies.delete('admin_session'); // Clear invalid/expired cookie
    return response;
  }
  
  if (pathname.startsWith(PENDING_APPROVAL_PAGE) && !isUserSessionValid) {
    const response = NextResponse.redirect(new URL('/login', appUrl));
    if (sessionToken) response.cookies.delete('session');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*', 
    '/admin/dashboard/:path*', 
    '/login', 
    '/signup', 
    '/forgot-password', 
    '/admin-login',
    '/pending-approval'
  ],
};
