/**
 * SabCRM email-tracking — OPEN pixel route.
 *
 *   GET /api/sabcrm/track/open/<token>
 *
 * Records an open for the signed token (best-effort) and ALWAYS returns a 1×1
 * transparent GIF with no-store caching, regardless of whether the token was
 * valid or the DB was reachable. A tracking pixel must never error or leak the
 * outcome to the recipient's mail client.
 *
 * Public + unauthenticated by design — the token IS the capability. Tenant
 * scope + tamper-resistance come from the HMAC signature verified in
 * `recordOpen` (`@/lib/sabcrm/email-tracking.server`).
 */

import { NextRequest, NextResponse } from 'next/server';

import { recordOpen } from '@/lib/sabcrm/email-tracking.server';

// A 43-byte 1×1 transparent GIF (the canonical web-bug pixel).
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

function pixelResponse(): NextResponse {
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  try {
    const { token } = await params;
    const ua = req.headers.get('user-agent') ?? undefined;
    // Fire-and-forget semantics — we still respond with the pixel even if this
    // rejects; awaiting keeps the function alive long enough to persist.
    await recordOpen(token, ua);
  } catch {
    /* never let a tracking failure break the pixel */
  }
  return pixelResponse();
}
