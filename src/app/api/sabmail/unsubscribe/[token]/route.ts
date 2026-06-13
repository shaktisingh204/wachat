/**
 * PUBLIC GET / POST /api/sabmail/unsubscribe/<token>
 *
 * The no-auth target of the one-click `List-Unsubscribe` header we attach to
 * SabMail bulk/campaign mail. There is NO session/cookie here — the workspace
 * + recipient ride INSIDE the signed token, verified by `verifyUnsubscribeToken`.
 *
 * POST (RFC 8058 one-click): the mailbox provider (Gmail/Yahoo) POSTs here when
 * the user hits the native "Unsubscribe" affordance. On a valid token we add a
 * workspace-scoped suppression and return 200. Idempotent — already-suppressed
 * still returns 200; only an invalid token returns 400.
 *
 * GET (human-clicked footer link): shows a minimal confirmation page with a
 * single POST form back to the same URL. We do NOT auto-unsubscribe on GET, so
 * an email-scanner's link-prefetch can't silently opt someone out — only the
 * explicit POST does.
 */

import { NextResponse, type NextRequest } from 'next/server';

import {
  addSabmailSuppression,
  type SabmailSuppressionSource,
} from '@/lib/sabmail/suppressions';
import { verifyUnsubscribeToken } from '@/lib/sabmail/unsubscribe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Escape a string for safe interpolation into the confirmation HTML. */
function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PAGE_STYLE =
  'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;' +
  'max-width:32rem;margin:4rem auto;padding:2rem;line-height:1.5;color:#1a1a1a;';

function htmlResponse(body: string, status = 200): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>Unsubscribe</title></head><body style="${PAGE_STYLE}">${body}</body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

/**
 * RFC 8058 one-click: provider POSTs here. Suppress on a valid token, 200
 * regardless of whether it was already suppressed; 400 only on a bad token.
 */
export async function POST(
  _req: NextRequest,
  props: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await props.params;
  const payload = verifyUnsubscribeToken(token);
  if (!payload) {
    return new NextResponse(null, { status: 400 });
  }
  try {
    await addSabmailSuppression(
      payload.workspaceId,
      payload.email,
      'unsubscribe',
      // Provenance tag for one-click List-Unsubscribe sends (stored as the
      // suppression `source`); narrowed via the existing source union.
      'list-unsubscribe' as SabmailSuppressionSource,
    );
  } catch {
    /* upsert is idempotent + never throws, but stay defensive — still 200 */
  }
  return new NextResponse(null, { status: 200 });
}

/**
 * Human-clicked footer link: render a confirm page. The single button POSTs
 * back to this same URL, so a passive GET prefetch never unsubscribes.
 */
export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await props.params;
  const payload = verifyUnsubscribeToken(token);
  if (!payload) {
    return htmlResponse(
      `<h1 style="font-size:1.25rem;margin:0 0 .5rem">Invalid unsubscribe link</h1>` +
        `<p style="color:#555">This unsubscribe link is invalid or has expired. ` +
        `Please use the link from the most recent email you received.</p>`,
      400,
    );
  }

  const action = `/api/sabmail/unsubscribe/${encodeURIComponent(token)}`;
  return htmlResponse(
    `<h1 style="font-size:1.25rem;margin:0 0 .75rem">Unsubscribe</h1>` +
      `<p style="color:#444;margin:0 0 1.5rem">` +
      `Click the button below to stop receiving these emails at ` +
      `<strong>${esc(payload.email)}</strong>.</p>` +
      `<form method="post" action="${esc(action)}">` +
      `<button type="submit" style="cursor:pointer;border:0;border-radius:.5rem;` +
      `background:#1a1a1a;color:#fff;font-size:1rem;padding:.65rem 1.25rem;">` +
      `Unsubscribe</button></form>`,
  );
}
