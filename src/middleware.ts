

'use server';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAdminJwtEdge, verifyJwtEdge } from './lib/auth.edge';
import { JWTExpired } from 'jose/errors';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log(`[MIDDLEWARE] Checking path: ${pathname}`);

  const sessionToken = request.cookies.get('session')?.value;
  const adminSessionToken = request.cookies.get('admin_session')?.value;

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/forgot-password');
  const isAdminAuthPage = pathname.startsWith('/admin-login');
  const isDashboard = pathname.startsWith('/dashboard');
  const isAdminDashboard = pathname.startsWith('/admin/dashboard');
  const isPendingPage = pathname.startsWith('/pending-approval');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  // Admin session logic
  if (isAdminDashboard) {
    let adminSessionValid = false;
    let adminSessionExpired = false;
    if (adminSessionToken) {
      try {
        adminSessionValid = !!await verifyAdminJwtEdge(adminSessionToken);
      } catch (error: any) {
        if (error.code === 'ERR_JWT_EXPIRED') adminSessionExpired = true;
      }
    }

    if (!adminSessionValid) {
      const response = NextResponse.redirect(new URL('/admin-login', appUrl));
      if (adminSessionExpired || adminSessionToken) response.cookies.delete('admin_session');
      return response;
    }
  }
  
  // User session logic
  if (isDashboard || isPendingPage) {
    let sessionValid = false;
    let sessionExpired = false;
    if (sessionToken) {
        try {
            sessionValid = await verifyJwtEdge(sessionToken);
        } catch(e: any) {
            if (e.code === 'ERR_JWT_EXPIRED') sessionExpired = true;
        }
    }

    if (!sessionValid) {
        const response = NextResponse.redirect(new URL('/login', appUrl));
        if (sessionExpired || sessionToken) {
            response.cookies.delete('session');
        }
        return response;
    }
  }

  // Logged-in user trying to access auth pages
  if (isAuthPage && sessionToken) {
    if(await verifyJwtEdge(sessionToken)) {
        return NextResponse.redirect(new URL('/dashboard', appUrl));
    }
  }
  
  if (isAdminAuthPage && adminSessionToken) {
     try {
      if (await verifyAdminJwtEdge(adminSessionToken)) {
        return NextResponse.redirect(new URL('/admin/dashboard', appUrl));
      }
    } catch (e) {}
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/dashboard/:path*', '/login', '/signup', '/forgot-password', '/admin-login', '/pending-approval'],
};

    