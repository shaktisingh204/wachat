
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAdminJwtEdge, verifyJwtEdge } from './lib/auth.edge';

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

  let isUserSessionValid = false;
  let isUserSessionExpired = false;
  if (sessionToken) {
    try {
      isUserSessionValid = await verifyJwtEdge(sessionToken);
    } catch (error: any) {
      if (error.code === 'ERR_JWT_EXPIRED') {
        isUserSessionExpired = true;
      }
    }
  }

  let isAdminSessionValid = false;
  let isAdminSessionExpired = false;
  if (adminSessionToken) {
    try {
      isAdminSessionValid = !!await verifyAdminJwtEdge(adminSessionToken);
    } catch (error: any)      {
      if (error.code === 'ERR_JWT_EXPIRED') {
        isAdminSessionExpired = true;
      }
    }
  }

  const isAuthPage = AUTH_PAGES.some(page => pathname.startsWith(page));
  const isAdminAuthPage = pathname.startsWith(ADMIN_AUTH_PAGE);
  const isDashboard = pathname.startsWith(DASHBOARD_PREFIX);
  const isAdminDashboard = pathname.startsWith(ADMIN_DASHBOARD_PREFIX);
  const isPendingPage = pathname.startsWith(PENDING_APPROVAL_PAGE);

  // Admin session logic
  if (isAdminDashboard && !isAdminSessionValid) {
    const response = NextResponse.redirect(new URL(ADMIN_AUTH_PAGE, appUrl));
    if (isAdminSessionExpired || adminSessionToken) {
      response.cookies.delete('admin_session');
    }
    return response;
  }

  if (isAdminAuthPage && isAdminSessionValid) {
    return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PREFIX, appUrl));
  }

  // User session logic
  if ((isDashboard || isPendingPage) && !isUserSessionValid) {
    const response = NextResponse.redirect(new URL('/login', appUrl));
    if (isUserSessionExpired || sessionToken) {
        response.cookies.delete('session');
    }
    return response;
  }
  
  if (isAuthPage && isUserSessionValid) {
    return NextResponse.redirect(new URL(DASHBOARD_PREFIX, appUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/dashboard/:path*', '/login', '/signup', '/forgot-password', '/admin-login', '/pending-approval'],
};
