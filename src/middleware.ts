
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAdminJwtEdge } from './lib/auth.edge';

const PROTECTED_ROUTES = ['/dashboard'];
const ADMIN_ROUTES = ['/admin'];
const PUBLIC_ROUTES = ['/login', '/signup', '/forgot-password', '/admin-login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('session')?.value;
  const adminSessionToken = request.cookies.get('admin_session')?.value;

  const isProtectedRoute = PROTECTED_ROUTES.some((path) => pathname.startsWith(path));
  const isAdminRoute = ADMIN_ROUTES.some((path) => pathname.startsWith(path));
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  // Admin routes protection
  if (isAdminRoute) {
    if (!adminSessionToken) {
      return NextResponse.redirect(new URL('/admin-login', request.url));
    }
    const adminPayload = await verifyAdminJwtEdge(adminSessionToken);
    if (!adminPayload) {
      return NextResponse.redirect(new URL('/admin-login', request.url));
    }
  }

  // User dashboard protection
  if (isProtectedRoute && !sessionToken) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `redirect=${pathname}`;
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users from auth pages
  if (isPublicRoute && sessionToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
   if (pathname === '/admin' && adminSessionToken) {
      const adminPayload = await verifyAdminJwtEdge(adminSessionToken);
      if(adminPayload) return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }


  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/admin', '/login', '/signup', '/forgot-password', '/admin-login'],
};
