
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAdminJwtEdge, verifyJwtEdge } from '@/lib/auth.edge';

const AUTH_PAGES = ['/login', '/signup', '/forgot-password'];
const ADMIN_AUTH_PAGE = '/admin-login';
const DASHBOARD_PREFIX = '/dashboard';
const WACHAT_PREFIX = '/wachat';
// Both /dashboard/* and /wachat/* are auth-gated user surfaces. Wachat
// was relocated out of /dashboard in this iteration; the proxy treats
// the two prefixes equivalently for session checks. After login,
// users land on /wachat — that's the new default landing route.
const PROTECTED_PREFIXES = [DASHBOARD_PREFIX, WACHAT_PREFIX] as const;
const POST_LOGIN_LANDING = WACHAT_PREFIX;
const ADMIN_DASHBOARD_PREFIX = '/admin/dashboard';
const PENDING_APPROVAL_PAGE = '/pending-approval';

/**
 * Hosts that are considered "canonical" for the app.  Any inbound request
 * whose `Host` header is NOT in this set is treated as a potential SabFlow
 * custom domain and rewritten to `/_domain/{host}` — a Node.js-runtime page
 * that looks the host up in Mongo and renders the target flow.
 *
 * The list is augmented with `NEXT_PUBLIC_APP_URL`'s host at runtime.
 */
const CANONICAL_HOST_SUFFIXES = [
  'sabnode.com',
  'vercel.app',
  'localhost',
  '127.0.0.1',
];

/** Path prefixes that must NEVER be rewritten to the domain router. */
const DOMAIN_ROUTE_BYPASS = [
  '/api',
  '/_next',
  '/_domain',
  '/static',
  '/favicon.ico',
  '/embed.js',
  '/robots.txt',
  '/sitemap.xml',
];

function isCanonicalHost(host: string, appUrl: string): boolean {
  const clean = host.toLowerCase().split(':')[0];
  if (!clean) return true;
  try {
    const appHost = new URL(appUrl).hostname.toLowerCase();
    if (clean === appHost) return true;
  } catch {
    // ignore malformed appUrl
  }
  return CANONICAL_HOST_SUFFIXES.some(
    (suffix) => clean === suffix || clean.endsWith(`.${suffix}`),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('session')?.value;
  const adminSessionToken = request.cookies.get('admin_session')?.value;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  /* ── Custom-domain routing ─────────────────────────────── */
  // Detect requests whose Host header does NOT match the canonical app host.
  // Rewrite them to `/_domain/{host}` where a Node.js page resolves the
  // host against `sabflow_custom_domains` and renders the target flow.
  const host = request.headers.get('host') ?? '';
  const isBypass = DOMAIN_ROUTE_BYPASS.some((p) => pathname.startsWith(p));
  if (host && !isBypass && !isCanonicalHost(host, appUrl)) {
    const url = request.nextUrl.clone();
    url.pathname = `/_domain/${encodeURIComponent(host)}${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }

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
      isAdminSessionValid = !!(await verifyAdminJwtEdge(adminSessionToken));
    } catch (error: any)      {
      if (error.code === 'ERR_JWT_EXPIRED') {
        isAdminSessionExpired = true;
      }
    }
  }

  const isAuthPage = AUTH_PAGES.some(page => pathname.startsWith(page));
  const isAdminAuthPage = pathname.startsWith(ADMIN_AUTH_PAGE);
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
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
  if ((isProtected || isPendingPage) && !isUserSessionValid) {
    const response = NextResponse.redirect(new URL('/login', appUrl));
    if (isUserSessionExpired || sessionToken) {
        response.cookies.delete('session');
    }
    return response;
  }

  if (isAuthPage && isUserSessionValid) {
    return NextResponse.redirect(new URL(POST_LOGIN_LANDING, appUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/wachat/:path*',
    '/admin/dashboard/:path*',
    '/login',
    '/signup',
    '/forgot-password',
    '/admin-login',
    '/pending-approval',
  ],
};
