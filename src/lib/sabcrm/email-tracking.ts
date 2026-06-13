/**
 * SabCRM — email open + click tracking — PURE helpers.
 *
 * The structural twin of `./scoring.ts`: a `'server-only'`- and network-I/O-free
 * module so the unit tests (`tsx --test`) AND the `'use client'` settings page
 * can import the types + the deterministic HTML-rewriting / token math directly.
 * The Mongo + activity side effects live in `./email-tracking.server.ts`, which
 * re-exports everything here.
 *
 * ## What it does
 *
 * Given an outbound email's HTML and a per-message {@link TrackingToken}, two
 * pure transforms make the mail observable:
 *
 *   - {@link injectTracking} appends a 1×1 transparent tracking pixel
 *     (`<img src=".../track/open/<token>">`) just before `</body>` (or at the
 *     end when there is no body) and REWRITES every `<a href="…">` to point at
 *     the click route (`.../track/click/<token>?u=<encoded original url>`), so a
 *     click is recorded and then 302-redirected to the original destination.
 *
 *   - {@link signToken} / {@link verifyToken} wrap a small JSON payload (the
 *     message id) in an HMAC-SHA256 signature (via `node:crypto`) so the token
 *     embedded in those URLs cannot be forged or tampered with: a hit on the
 *     open/click route is only counted when the token verifies.
 *
 * ## Storage envelope (see `./email-tracking.server.ts`)
 *
 * Per-message tracking state is a `sabcrm_email_events` doc. The first time a
 * record is emailed with tracking on, a compact scalar summary is also written
 * onto the record at `data.emailLastEvent` (+ the reserved `data.__emailtrack`
 * meta) with NO `updatedAt` bump — the same scalar envelope the AI-fields /
 * scoring features use, so both stores see it with zero engine change.
 */

import { createHmac, timingSafeEqual } from 'crypto';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/** The signed payload carried in an open/click URL. */
export interface TrackingToken {
  /** The `sabcrm_email_events` message id this hit belongs to. */
  mid: string;
  /** Project scope (defends a stolen secret against cross-tenant replay). */
  pid: string;
  /** Issued-at (ms epoch); lets the server reject ancient tokens if it wants. */
  iat: number;
}

/** Where the open/click routes live (no trailing slash). */
export const TRACK_OPEN_PATH = '/api/sabcrm/track/open';
export const TRACK_CLICK_PATH = '/api/sabcrm/track/click';

/** Query key carrying the original (pre-rewrite) destination on click URLs. */
export const CLICK_URL_PARAM = 'u';

/** Reserved scalar key holding the most recent event summary on a record. */
export const EMAIL_LAST_EVENT_FIELD = 'emailLastEvent';
/** Reserved meta namespace under `data.__emailtrack`. */
export const EMAIL_TRACK_META = '__emailtrack';

/** Env var holding the HMAC secret (documented fallback in the server module). */
export const TRACK_SECRET_ENV = 'SABCRM_TRACK_SECRET';

/* -------------------------------------------------------------------------- */
/* base64url encode / decode (pure, dependency-free)                           */
/* -------------------------------------------------------------------------- */

/** UTF-8 string → base64url (no `=` padding, `+/` → `-_`). */
export function encodeBase64Url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** base64url → UTF-8 string (inverse of {@link encodeBase64Url}). */
export function decodeBase64Url(input: string): string {
  const padded = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(input.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

/* -------------------------------------------------------------------------- */
/* Sign / verify (HMAC-SHA256 over a base64url JSON payload)                    */
/* -------------------------------------------------------------------------- */

/** Raw base64url HMAC-SHA256 of `data` keyed by `secret`. */
function hmac(data: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sign a {@link TrackingToken} → `"<payloadB64url>.<sigB64url>"`. The payload is
 * the JSON token; the signature is the HMAC of that exact payload string, so
 * verification re-derives the signature from the carried payload and never
 * trusts the URL. Pure + deterministic for a given `secret`.
 */
export function signToken(payload: TrackingToken, secret: string): string {
  const body = encodeBase64Url(JSON.stringify(payload));
  return `${body}.${hmac(body, secret)}`;
}

/**
 * Verify a token produced by {@link signToken}. Returns the decoded
 * {@link TrackingToken} when the signature matches (constant-time compare), or
 * `null` for any malformed / tampered / wrong-secret input. Never throws.
 */
export function verifyToken(token: string, secret: string): TrackingToken | null {
  if (typeof token !== 'string' || !token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(body, secret);

  // Constant-time compare; length mismatch ⇒ reject before timingSafeEqual.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(decodeBase64Url(body)) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const t = parsed as Partial<TrackingToken>;
    if (typeof t.mid !== 'string' || !t.mid) return null;
    if (typeof t.pid !== 'string' || !t.pid) return null;
    if (typeof t.iat !== 'number' || !Number.isFinite(t.iat)) return null;
    return { mid: t.mid, pid: t.pid, iat: t.iat };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* URL builders                                                                 */
/* -------------------------------------------------------------------------- */

/** Normalize a base URL → no trailing slash. */
function trimBase(baseUrl: string): string {
  return (baseUrl || '').replace(/\/+$/, '');
}

/** The open-pixel URL for a signed token. */
export function openUrl(token: string, baseUrl: string): string {
  return `${trimBase(baseUrl)}${TRACK_OPEN_PATH}/${encodeURIComponent(token)}`;
}

/** The click-redirect URL wrapping an original destination. */
export function clickUrl(token: string, original: string, baseUrl: string): string {
  const base = `${trimBase(baseUrl)}${TRACK_CLICK_PATH}/${encodeURIComponent(token)}`;
  return `${base}?${CLICK_URL_PARAM}=${encodeURIComponent(original)}`;
}

/* -------------------------------------------------------------------------- */
/* HTML rewriting                                                               */
/* -------------------------------------------------------------------------- */

/**
 * True for hrefs we should NOT rewrite (non-HTTP schemes + in-page anchors).
 * Tracking a `mailto:` / `tel:` / `#section` link would break it.
 */
function isTrackableHref(href: string): boolean {
  const h = href.trim();
  if (!h) return false;
  if (h.startsWith('#')) return false;
  if (/^(mailto:|tel:|sms:|javascript:|data:)/i.test(h)) return false;
  return /^https?:\/\//i.test(h) || h.startsWith('/');
}

/** The 1×1 transparent tracking-pixel `<img>` tag for a token. */
export function pixelTag(token: string, baseUrl: string): string {
  const src = openUrl(token, baseUrl);
  return (
    `<img src="${src}" width="1" height="1" alt="" ` +
    `style="display:none;width:1px;height:1px;border:0;overflow:hidden" />`
  );
}

/** Decode the most common HTML entities so a rewritten href round-trips. */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/&#x26;/gi, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** Re-encode the characters that are unsafe inside a double-quoted attribute. */
function encodeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * Rewrite every trackable `<a href="…">` so a click is routed through the click
 * endpoint (carrying the original URL) before the 302 redirect. Untrackable
 * hrefs (mailto/tel/anchors/etc.) are left untouched. Pure string transform.
 */
export function rewriteLinks(html: string, token: string, baseUrl: string): string {
  // Match the href attribute of any anchor; supports single or double quotes.
  return html.replace(
    /(<a\b[^>]*?\bhref\s*=\s*)(["'])([\s\S]*?)\2/gi,
    (match, prefix: string, quote: string, rawHref: string) => {
      const original = decodeHtmlEntities(rawHref);
      if (!isTrackableHref(original)) return match;
      const wrapped = clickUrl(token, original, baseUrl);
      return `${prefix}${quote}${encodeAttr(wrapped)}${quote}`;
    },
  );
}

/**
 * Make an outbound HTML email observable: rewrite links to the click route and
 * append the open pixel right before `</body>` (or at the very end when the
 * markup has no `</body>`). Pure + deterministic for a given token + baseUrl.
 *
 * Empty / whitespace-only input is returned unchanged (nothing to track).
 */
export function injectTracking(
  html: string,
  token: string,
  baseUrl: string,
): string {
  if (typeof html !== 'string' || html.trim() === '') return html;
  const linked = rewriteLinks(html, token, baseUrl);
  const pixel = pixelTag(token, baseUrl);
  const bodyClose = /<\/body\s*>/i;
  if (bodyClose.test(linked)) {
    return linked.replace(bodyClose, (m) => `${pixel}${m}`);
  }
  return `${linked}${pixel}`;
}
