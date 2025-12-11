
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDecodedSession } from './lib/auth.edge';

const PROTECTED_ROUTES = ['/dashboard', '/api/v1'];
const ADMIN_ROUTES = ['/admin'];
const PUBLIC_ROUTES = ['/login', '/signup', '/forgot-password', '/admin-login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await getDecodedSession();

  const isProtectedRoute = PROTECTED_ROUTES.some((path) => pathname.startsWith(path));
  const isAdminRoute = ADMIN_ROUTES.some((path) => pathname.startsWith(path));
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  if (isProtectedRoute && !session) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `redirect=${pathname}`;
    return NextResponse.redirect(url);
  }

  if (isAdminRoute && session?.role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/admin-login';
      return NextResponse.redirect(url);
  }

  if (isPublicRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  if (pathname === '/admin' && session?.role === 'admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/v1/:path*', '/admin/:path*', '/login', '/signup', '/forgot-password', '/admin-login'],
};
