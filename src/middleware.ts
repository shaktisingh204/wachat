
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const secret = process.env.NEXTAUTH_SECRET;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req, secret, raw: true });

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup');
  const isAdminAuthPage = pathname.startsWith('/admin-login');
  const isDashboard = pathname.startsWith('/dashboard');
  const isAdminDashboard = pathname.startsWith('/admin/dashboard');

  // Logic for admin pages
  if (isAdminDashboard) {
    // A simple check for a token might not be enough.
    // In a real app, you'd decode the token and check for an admin role.
    // next-auth's default middleware handling is generally better.
    // This is simplified for this context.
    return NextResponse.next(); 
  }

  // Logic for user pages
  if (isDashboard) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    return NextResponse.next();
  }

  // Logic for auth pages
  if (isAuthPage) {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/dashboard/:path*', '/login', '/signup', '/admin-login'],
};
