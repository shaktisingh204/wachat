
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get('session')?.value;
  const session = sessionToken ? verifySessionToken(sessionToken) : null;
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/admin-login');

  // If user is authenticated
  if (session) {
    // Redirect away from auth pages if logged in
    if (isAuthPage) {
        if (!pathname.startsWith('/admin-login')) { // Allow access to admin login even if user is logged in
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
    }
    return NextResponse.next();
  }

  // If user is not authenticated
  if (!session) {
    // Allow access to auth pages, root, and API routes
    if (isAuthPage || pathname === '/' || pathname.startsWith('/api') || pathname.startsWith('/admin')) {
      return NextResponse.next();
    }
    // Redirect all other requests to the login page
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except for static files and special Next.js paths
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}
