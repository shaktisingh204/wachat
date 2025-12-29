
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAdminJwtEdge, verifyJwtEdge } from './lib/auth.edge';
import { JWTExpired } from 'jose/errors';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log(`[MIDDLEWARE] Checking path: ${pathname}`);

  const sessionToken = request.cookies.get('session')?.value;
  const adminSessionToken = request.cookies.get('admin_session')?.value;

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup');
  const isAdminAuthPage = pathname.startsWith('/admin-login');
  const isDashboard = pathname.startsWith('/dashboard');
  const isAdminDashboard = pathname.startsWith('/admin/dashboard');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  // --- Admin Session Logic (Unchanged) ---
  if (isAdminDashboard) {
    let adminSessionValid = false;
    let adminSessionExpired = false;
    if (adminSessionToken) {
      try {
        console.log('[MIDDLEWARE] Found admin session token, verifying...');
        adminSessionValid = !!await verifyAdminJwtEdge(adminSessionToken);
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

    if (!adminSessionValid) {
      console.log('[MIDDLEWARE] Admin dashboard access denied. Redirecting to /admin-login.');
      const response = NextResponse.redirect(new URL('/admin-login', appUrl));
      if (adminSessionExpired || adminSessionToken) {
        console.log('[MIDDLEWARE] Deleting expired/invalid admin cookie.');
        response.cookies.delete('admin_session');
      }
      return response;
    }
  }

  // --- User Session Logic (Corrected) ---
  if (isDashboard) {
    if (!sessionToken) {
      console.log('[MIDDLEWARE] User dashboard access denied, no session token. Redirecting to /login.');
      const response = NextResponse.redirect(new URL('/login', appUrl));
      response.cookies.delete('session');
      return response;
    }
    // If a token exists, we let it pass. The actual verification happens
    // server-side in the layout/page via getSession(). This avoids the edge runtime error.
    console.log('[MIDDLEWARE] User session token found. Allowing request to proceed for server-side validation.');
  }

  // --- Logged-in user trying to access auth pages ---
  if (isAuthPage && sessionToken) {
    // A quick check is sufficient here. If they have a token, just send them to the dashboard.
    // If the token is invalid, the dashboard's own checks will handle the redirect back to login.
    console.log('[MIDDLEWARE] User already logged in. Redirecting from auth page to /dashboard.');
    return NextResponse.redirect(new URL('/dashboard', appUrl));
  }
  
  if (isAdminAuthPage && adminSessionToken) {
    // Quick check for admin is fine here too.
     try {
      if (await verifyAdminJwtEdge(adminSessionToken)) {
        console.log('[MIDDLEWARE] Admin already logged in. Redirecting from admin login page to /admin/dashboard.');
        return NextResponse.redirect(new URL('/admin/dashboard', appUrl));
      }
    } catch (e) {
      // Token might be expired, just continue to the login page
    }
  }
  
  console.log('[MIDDLEWARE] All middleware checks passed. Allowing request.');
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/dashboard/:path*', '/login', '/signup', '/admin-login'],
};
