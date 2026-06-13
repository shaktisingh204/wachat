/**
 * SabCRM email-tracking — CLICK redirect route.
 *
 *   GET /api/sabcrm/track/click/<token>?u=<original-url>
 *
 * Records a click for the signed token (best-effort) and 302-redirects to the
 * original destination carried in the `u` query param. The redirect ALWAYS
 * happens when `u` is a safe absolute http(s) URL — even if the token is forged
 * or the DB is down — so a tracking failure never strands the recipient. When
 * `u` is missing or unsafe, falls back to the app home.
 *
 * Public + unauthenticated by design — the token IS the capability; tenant
 * scope + tamper-resistance come from the HMAC verified in `recordClick`
 * (`@/lib/sabcrm/email-tracking.server`).
 */

import { NextRequest, NextResponse } from 'next/server';

import {
  recordClick,
  CLICK_URL_PARAM,
} from '@/lib/sabcrm/email-tracking.server';

function appHome(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  );
}

/** Only ever redirect to an absolute http(s) URL (open-redirect defense). */
function safeRedirectTarget(raw: string | null): string {
  if (!raw) return appHome();
  try {
    const u = new URL(raw);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
  } catch {
    /* not a valid absolute URL */
  }
  return appHome();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const original = new URL(req.url).searchParams.get(CLICK_URL_PARAM);
  const target = safeRedirectTarget(original);

  try {
    const { token } = await params;
    const ua = req.headers.get('user-agent') ?? undefined;
    if (original) await recordClick(token, original, ua);
  } catch {
    /* never let a tracking failure break the redirect */
  }

  // 302 (temporary) — the original URL is the canonical destination, this hop
  // is just instrumentation and must not be cached as permanent.
  return NextResponse.redirect(target, 302);
}
