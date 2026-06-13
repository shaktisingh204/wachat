import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAdminJwtEdge, verifyJwtEdge } from './lib/auth.edge';

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
 * Hosts that are considered "canonical" for the app. Any inbound request
 * whose `Host` header is NOT in this set is treated as a potential SabFlow
 * custom domain and rewritten to `/_domain/{host}`.
 */
const CANONICAL_HOST_SUFFIXES = [
  'sabnode.com',
  'vercel.app',
  'localhost',
  '127.0.0.1',
];

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

function isCanonicalHost(host: string, appUrl: string | undefined): boolean {
  const clean = host.toLowerCase().split(':')[0];
  if (!clean) return true;
  if (appUrl) {
    try {
      const appHost = new URL(appUrl).hostname.toLowerCase();
      if (clean === appHost) return true;
    } catch {
      // ignore malformed appUrl
    }
  }
  return CANONICAL_HOST_SUFFIXES.some(
    (suffix) => clean === suffix || clean.endsWith(`.${suffix}`),
  );
}

/**
 * Build a same-host redirect target. Critically we redirect using the
 * INCOMING request's URL — not `process.env.NEXT_PUBLIC_APP_URL` — so a
 * request to `sabnode.com` never bounces over to `www.sabnode.com`
 * (or http↔https), which previously caused ERR_TOO_MANY_REDIRECTS:
 * the session cookie set on host A wasn't visible on host B, so the
 * proxy concluded "no session" again and redirected forever.
 */
function sameHostRedirect(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('session')?.value;
  const adminSessionToken = request.cookies.get('admin_session')?.value;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  /* ── Custom-domain routing ─────────────────────────────── */
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
      if (error?.code === 'ERR_JWT_EXPIRED') {
        isUserSessionExpired = true;
      }
    }
  }

  let isAdminSessionValid = false;
  let isAdminSessionExpired = false;
  if (adminSessionToken) {
    try {
      isAdminSessionValid = !!(await verifyAdminJwtEdge(adminSessionToken));
    } catch (error: any) {
      if (error?.code === 'ERR_JWT_EXPIRED') {
        isAdminSessionExpired = true;
      }
    }
  }

  const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page));
  const isAdminAuthPage = pathname.startsWith(ADMIN_AUTH_PAGE);
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAdminDashboard = pathname.startsWith(ADMIN_DASHBOARD_PREFIX);
  const isPendingPage = pathname.startsWith(PENDING_APPROVAL_PAGE);

  // Admin gate
  if (isAdminDashboard && !isAdminSessionValid) {
    const response = sameHostRedirect(request, ADMIN_AUTH_PAGE);
    if (isAdminSessionExpired || adminSessionToken) {
      response.cookies.delete('admin_session');
    }
    return response;
  }

  if (isAdminAuthPage && isAdminSessionValid) {
    return sameHostRedirect(request, ADMIN_DASHBOARD_PREFIX);
  }

  // User gate
  if ((isProtected || isPendingPage) && !isUserSessionValid) {
    const response = sameHostRedirect(request, '/login');
    if (isUserSessionExpired || sessionToken) {
      response.cookies.delete('session');
    }
    return response;
  }

  if (isAuthPage && isUserSessionValid) {
    return sameHostRedirect(request, POST_LOGIN_LANDING);
  }

  // P9: legacy CRM module deleted — permanent redirect into the SabCRM suite.
  // (Unauthenticated /dashboard/crm/* already bounced to /login by the user gate.)
  const LEGACY_CRM_PREFIX = '/dashboard/crm';
  if (
    pathname === LEGACY_CRM_PREFIX ||
    pathname.startsWith(`${LEGACY_CRM_PREFIX}/`)
  ) {
    // Ordered longest-prefix-first (first startsWith match wins).
    const LEGACY_CRM_MAP: Array<[string, string]> = [
      ['/dashboard/crm/sales/invoices', '/sabcrm/finance/invoices'],
      ['/dashboard/crm/sales/quotations', '/sabcrm/finance/quotations'],
      ['/dashboard/crm/sales/credit-notes', '/sabcrm/finance/credit-notes'],
      ['/dashboard/crm/sales/receipts', '/sabcrm/finance/payment-receipts'],
      ['/dashboard/crm/sales-crm', '/sabcrm/leads'],
      ['/dashboard/crm/hr-payroll/employees', '/sabcrm/people/employees'],
      ['/dashboard/crm/hr-payroll', '/sabcrm/people'],
      ['/dashboard/crm/purchase-orders', '/sabcrm/supply/purchase-orders'],
      ['/dashboard/crm/purchases', '/sabcrm/supply'],
      ['/dashboard/crm/inventory', '/sabcrm/supply/items'],
      ['/dashboard/crm/accounts', '/sabcrm/companies'],
      ['/dashboard/crm/products', '/sabcrm/products'],
      ['/dashboard/crm/deals', '/sabcrm/leads'],
      ['/dashboard/crm/leads', '/sabcrm/leads'],
      ['/dashboard/crm/tasks', '/sabcrm/tasks'],
      ['/dashboard/crm/projects', '/sabcrm/projects'],
    ];
    const hit = LEGACY_CRM_MAP.find(([from]) => pathname.startsWith(from));
    const url = request.nextUrl.clone();
    url.pathname = hit ? hit[1] : '/sabcrm';
    return NextResponse.redirect(url, 308);
  }

  // Legacy email surfaces retired into the unified SabMail module (/sabmail).
  const LEGACY_MAIL_PREFIXES = [
    '/dashboard/email',
    '/dashboard/mailbox',
    '/dashboard/sabmail',
  ];
  if (
    LEGACY_MAIL_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    )
  ) {
    // Longest-prefix-first (first startsWith match wins) — subpaths before the bare prefix.
    const LEGACY_MAIL_MAP: Array<[string, string]> = [
      ['/dashboard/email/campaigns', '/sabmail/campaigns'],
      ['/dashboard/email/templates', '/sabmail/templates'],
      ['/dashboard/email/journeys', '/sabmail/automations'],
      ['/dashboard/email/audience', '/sabmail/contacts'],
      ['/dashboard/email/contacts', '/sabmail/contacts'],
      ['/dashboard/email/deliverability', '/sabmail/domains'],
      ['/dashboard/email/reports', '/sabmail/analytics'],
      ['/dashboard/email/analytics', '/sabmail/analytics'],
      ['/dashboard/email/integrations', '/sabmail/settings'],
      ['/dashboard/email/settings', '/sabmail/settings'],
      ['/dashboard/email', '/sabmail'],
      ['/dashboard/sabmail/inbox', '/sabmail/inbox'],
      ['/dashboard/sabmail/crm-email', '/sabmail/inbox'],
      ['/dashboard/sabmail', '/sabmail'],
      ['/dashboard/mailbox', '/sabmail/inbox'],
    ];
    const hit = LEGACY_MAIL_MAP.find(([from]) => pathname.startsWith(from));
    const url = request.nextUrl.clone();
    url.pathname = hit ? hit[1] : '/sabmail';
    url.search = '';
    return NextResponse.redirect(url, 308);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-url', pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/wachat/:path*',
    // SabSMS is gated in its layout (project + mandatory setup). It is NOT
    // added to PROTECTED_PREFIXES — the proxy just passes through and sets
    // the `x-url` header so the layout can read the current pathname.
    '/sabsms/:path*',
    // SabMail uses the same in-layout project + setup gate; the proxy just
    // passes through and sets `x-url` for the layout to read.
    '/sabmail/:path*',
    '/admin/dashboard/:path*',
    '/login',
    '/signup',
    '/forgot-password',
    '/admin-login',
    '/pending-approval',
  ],
};
