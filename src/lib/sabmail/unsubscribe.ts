import 'server-only';

import crypto from 'node:crypto';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail — one-click List-Unsubscribe tokens + headers.
 *
 * Gmail/Yahoo bulk-sender rules require a one-click `List-Unsubscribe` on
 * bulk mail (RFC 8058). This module mints a STATELESS, signed token that
 * carries `{ workspaceId, email, campaignId? }` — no DB row needed — and
 * helpers to verify it and to build the outgoing headers.
 *
 * The token is `base64url(payload) + '.' + base64url(HMAC-SHA256(payload))`.
 * Verification recomputes the signature and constant-time compares it, so a
 * forged or tampered token can never unsubscribe someone else's address.
 *
 * Deliberately NOT a `'use server'` file: called from the bulk send path and
 * from the public unsubscribe route (which has no session/cookie). The tenant
 * key rides inside the verified token — never `getSabmailWorkspaceId()` here.
 * ──────────────────────────────────────────────────────────────────── */

/** The signed-token payload (round-trips through the URL token). */
export interface UnsubscribePayload {
  workspaceId: string;
  email: string;
  campaignId?: string;
}

/**
 * Signing secret. Prefers a dedicated unsubscribe secret, then the shared
 * cron secret, then the SabMail creds key, with a dev fallback so local sends
 * still produce a verifiable token. Never throws.
 */
function secret(): string {
  return (
    process.env.SABMAIL_UNSUB_SECRET ||
    process.env.CRON_SECRET ||
    process.env.SABMAIL_CREDS_KEY ||
    'sabmail-dev-unsub'
  );
}

/** URL-safe base64 of a UTF-8 string. */
function base64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

/** base64url(HMAC-SHA256(payload, secret)). */
function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

/**
 * Mint a stateless, signed unsubscribe token for `email` within `workspaceId`
 * (optionally tied to `campaignId`). URL-safe — embed it directly in a path.
 */
export function makeUnsubscribeToken(
  workspaceId: string,
  email: string,
  campaignId?: string,
): string {
  const data: UnsubscribePayload = {
    workspaceId: String(workspaceId ?? ''),
    email: String(email ?? '').trim().toLowerCase(),
  };
  if (campaignId) data.campaignId = String(campaignId);
  const payload = base64url(JSON.stringify(data));
  return `${payload}.${sign(payload)}`;
}

/**
 * Verify a token: recompute the signature, constant-time compare, and decode
 * the payload. Returns the `{ workspaceId, email, campaignId? }` on success or
 * `null` on ANY malformed / tampered / unparseable input (defensive — never
 * throws, so the route can `400` cleanly).
 */
export function verifyUnsubscribeToken(token: string): UnsubscribePayload | null {
  try {
    if (typeof token !== 'string') return null;
    const dot = token.indexOf('.');
    if (dot <= 0 || dot === token.length - 1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);

    const expected = sign(payload);
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    // timingSafeEqual throws on length mismatch — guard first.
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

    const json = Buffer.from(payload, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;
    const workspaceId = String(obj.workspaceId ?? '');
    const email = String(obj.email ?? '');
    if (!workspaceId || !email) return null;
    const out: UnsubscribePayload = { workspaceId, email };
    if (obj.campaignId) out.campaignId = String(obj.campaignId);
    return out;
  } catch {
    return null;
  }
}

/**
 * Build the outgoing one-click unsubscribe headers (RFC 2369 + RFC 8058):
 *   - `List-Unsubscribe`: `<https://APP/api/sabmail/unsubscribe/TOKEN>`
 *     (with a `, <mailto:senderEmail?subject=unsubscribe>` fallback when a
 *     sender address is given).
 *   - `List-Unsubscribe-Post`: `List-Unsubscribe=One-Click` — signals to the
 *     mailbox provider that the URL accepts a one-click POST.
 *
 * `appBaseUrl` is the public origin (no trailing slash needed). The caller is
 * responsible for skipping these headers when `appBaseUrl` is empty.
 */
export function buildUnsubscribeHeaders(
  appBaseUrl: string,
  token: string,
  senderEmail?: string,
): Record<string, string> {
  const base = String(appBaseUrl ?? '').replace(/\/+$/, '');
  const url = `${base}/api/sabmail/unsubscribe/${encodeURIComponent(token)}`;
  let listUnsub = `<${url}>`;
  const sender = String(senderEmail ?? '').trim();
  if (sender) {
    listUnsub += `, <mailto:${sender}?subject=unsubscribe>`;
  }
  return {
    'List-Unsubscribe': listUnsub,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
