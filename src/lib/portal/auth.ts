/**
 * Portal authentication helpers — magic-link mint/verify + session cookie
 * mint/verify for the public-facing `/portal/[tenantSlug]/*` routes.
 *
 * These run on a SEPARATE secret pair from the main CRM admin session:
 *   - `PORTAL_MAGIC_LINK_SECRET` — HMAC key for the 15-minute single-use link
 *   - `PORTAL_SESSION_SECRET`    — HMAC key for the 7-day session cookie
 *
 * Token format (magic link, one line):
 *   v1.<base64url(tenantSlug.email.issuedAt)>.<base64url(hmacSha256)>
 *
 * Session cookie format (one line, stored opaquely in `portal_session`):
 *   v1.<base64url(userId.tenantId.issuedAt)>.<base64url(hmacSha256)>
 *
 * Notes:
 *   - The cookie path is scoped to `/portal/${tenantSlug}` so it never leaks
 *     into the CRM admin surface and vice-versa.
 *   - Single-use semantics for the magic link live in the verifier's caller
 *     (it inserts a row into `crm_portal_magic_link_uses` keyed on the MAC).
 *   - All helpers return discriminated unions; never throw on bad input.
 */

import 'server-only';

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { getCookieSecureFlag } from '@/lib/cookies';

export const PORTAL_TOKEN_VERSION = 'v1';
export const PORTAL_MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
export const PORTAL_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const PORTAL_SESSION_COOKIE_NAME = 'portal_session';

function getMagicLinkSecret(): string {
    const s = process.env.PORTAL_MAGIC_LINK_SECRET;
    if (!s || s.length < 16) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('PORTAL_MAGIC_LINK_SECRET is not configured.');
        }
        return 'sabnode-dev-portal-magic-link-secret-change-me-32+chars';
    }
    return s;
}

function getSessionSecret(): string {
    const s = process.env.PORTAL_SESSION_SECRET;
    if (!s || s.length < 16) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('PORTAL_SESSION_SECRET is not configured.');
        }
        return 'sabnode-dev-portal-session-secret-change-me-32+chars';
    }
    return s;
}

function b64url(input: Buffer | string): string {
    const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
    return buf
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function b64urlDecodeToString(input: string): string {
    const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
    const std = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
    return Buffer.from(std, 'base64').toString('utf8');
}

function macForMagicLink(tenantSlug: string, email: string, issuedAt: number): string {
    const msg = `${tenantSlug}|${email}|${issuedAt}`;
    return b64url(
        crypto.createHmac('sha256', getMagicLinkSecret()).update(msg).digest(),
    );
}

function macForSession(userId: string, tenantId: string, issuedAt: number): string {
    const msg = `${userId}|${tenantId}|${issuedAt}`;
    return b64url(
        crypto.createHmac('sha256', getSessionSecret()).update(msg).digest(),
    );
}

/* ─── Magic link ─────────────────────────────────────────────────── */

export interface MintMagicLinkArgs {
    /** URL-safe tenant slug — the value in `/portal/[tenantSlug]/...`. */
    tenantSlug: string;
    /** Recipient email (lower-cased internally). */
    email: string;
    /** Override `Date.now()` (testing). */
    nowMs?: number;
}

export interface MintMagicLinkResult {
    token: string;
    issuedAt: number;
    expiresAt: Date;
}

export function mintPortalMagicLink(args: MintMagicLinkArgs): MintMagicLinkResult {
    const slug = (args.tenantSlug || '').trim();
    const email = (args.email || '').trim().toLowerCase();
    if (!slug || !email) {
        throw new Error('tenantSlug and email are required to mint a portal magic link.');
    }
    const issuedAt = args.nowMs ?? Date.now();
    const payload = `${slug}.${email}.${issuedAt}`;
    const mac = macForMagicLink(slug, email, issuedAt);
    return {
        token: `${PORTAL_TOKEN_VERSION}.${b64url(payload)}.${mac}`,
        issuedAt,
        expiresAt: new Date(issuedAt + PORTAL_MAGIC_LINK_TTL_MS),
    };
}

export type VerifyPortalMagicLinkResult =
    | {
          ok: true;
          email: string;
          tenantSlug: string;
          issuedAt: number;
          /** Stable fingerprint of the MAC suitable for single-use bookkeeping. */
          tokenFingerprint: string;
      }
    | { ok: false; error: string };

export interface VerifyMagicLinkArgs {
    tenantSlug: string;
    token: string;
    nowMs?: number;
}

export function verifyPortalMagicLink(args: VerifyMagicLinkArgs): VerifyPortalMagicLinkResult {
    const slug = (args.tenantSlug || '').trim();
    const token = args.token;
    if (!slug) return { ok: false, error: 'Missing tenant.' };
    if (!token || typeof token !== 'string') return { ok: false, error: 'Missing token.' };

    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== PORTAL_TOKEN_VERSION) {
        return { ok: false, error: 'Unsupported token format.' };
    }

    let decoded: string;
    try {
        decoded = b64urlDecodeToString(parts[1]);
    } catch {
        return { ok: false, error: 'Malformed token.' };
    }
    const segs = decoded.split('.');
    if (segs.length !== 3) return { ok: false, error: 'Malformed token payload.' };
    const [tokSlug, email, issuedAtStr] = segs;
    const issuedAt = Number(issuedAtStr);
    if (!Number.isFinite(issuedAt) || issuedAt <= 0) {
        return { ok: false, error: 'Invalid token timestamp.' };
    }
    if (tokSlug !== slug) {
        return { ok: false, error: 'Token bound to a different tenant.' };
    }

    const expectedMac = macForMagicLink(tokSlug, email, issuedAt);
    const got = Buffer.from(parts[2]);
    const want = Buffer.from(expectedMac);
    if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) {
        return { ok: false, error: 'Token signature mismatch.' };
    }

    const now = args.nowMs ?? Date.now();
    if (now - issuedAt > PORTAL_MAGIC_LINK_TTL_MS) {
        return { ok: false, error: 'Token has expired.' };
    }

    // SHA-256 of the MAC is the stable single-use bookkeeping key. We
    // hash the MAC rather than store it raw to avoid keeping a verifier
    // in plaintext at rest in `crm_portal_magic_link_uses`.
    const tokenFingerprint = crypto
        .createHash('sha256')
        .update(expectedMac)
        .digest('hex');

    return { ok: true, email, tenantSlug: slug, issuedAt, tokenFingerprint };
}

/* ─── Session cookie ─────────────────────────────────────────────── */

export interface MintSessionArgs {
    userId: string;
    tenantId: string;
    nowMs?: number;
}

export interface MintSessionResult {
    token: string;
    issuedAt: number;
    expiresAt: Date;
}

export function mintPortalSessionToken(args: MintSessionArgs): MintSessionResult {
    const userId = (args.userId || '').trim();
    const tenantId = (args.tenantId || '').trim();
    if (!userId || !tenantId) {
        throw new Error('userId and tenantId are required to mint a portal session.');
    }
    const issuedAt = args.nowMs ?? Date.now();
    const payload = `${userId}.${tenantId}.${issuedAt}`;
    const mac = macForSession(userId, tenantId, issuedAt);
    return {
        token: `${PORTAL_TOKEN_VERSION}.${b64url(payload)}.${mac}`,
        issuedAt,
        expiresAt: new Date(issuedAt + PORTAL_SESSION_TTL_MS),
    };
}

export type VerifyPortalSessionResult =
    | { ok: true; userId: string; tenantId: string; issuedAt: number }
    | { ok: false; error: string };

export function verifyPortalSessionToken(
    token: string | undefined | null,
    opts: { nowMs?: number } = {},
): VerifyPortalSessionResult {
    if (!token || typeof token !== 'string') {
        return { ok: false, error: 'Missing session.' };
    }
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== PORTAL_TOKEN_VERSION) {
        return { ok: false, error: 'Unsupported session format.' };
    }
    let decoded: string;
    try {
        decoded = b64urlDecodeToString(parts[1]);
    } catch {
        return { ok: false, error: 'Malformed session.' };
    }
    const segs = decoded.split('.');
    if (segs.length !== 3) return { ok: false, error: 'Malformed session payload.' };
    const [userId, tenantId, issuedAtStr] = segs;
    const issuedAt = Number(issuedAtStr);
    if (!Number.isFinite(issuedAt) || issuedAt <= 0) {
        return { ok: false, error: 'Invalid session timestamp.' };
    }

    const expectedMac = macForSession(userId, tenantId, issuedAt);
    const got = Buffer.from(parts[2]);
    const want = Buffer.from(expectedMac);
    if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) {
        return { ok: false, error: 'Session signature mismatch.' };
    }

    const now = opts.nowMs ?? Date.now();
    if (now - issuedAt > PORTAL_SESSION_TTL_MS) {
        return { ok: false, error: 'Session has expired.' };
    }
    return { ok: true, userId, tenantId, issuedAt };
}

/* ─── Cookie wiring ──────────────────────────────────────────────── */

export function portalCookiePath(tenantSlug: string): string {
    // The cookie path attribute must be a static-string prefix; this is
    // intentionally NOT site-wide. Browsers will only attach the cookie
    // on requests under `/portal/<slug>/...`.
    return `/portal/${encodeURIComponent(tenantSlug)}`;
}

function portalCookieOptions(tenantSlug: string, maxAgeSeconds: number) {
    return {
        httpOnly: true as const,
        secure: getCookieSecureFlag(),
        sameSite: 'lax' as const,
        path: portalCookiePath(tenantSlug),
        maxAge: maxAgeSeconds,
    };
}

export async function setPortalSessionCookie(args: {
    userId: string;
    tenantId: string;
    tenantSlug: string;
}): Promise<void> {
    const { token } = mintPortalSessionToken({
        userId: args.userId,
        tenantId: args.tenantId,
    });
    const cookieStore = await cookies();
    cookieStore.set(
        PORTAL_SESSION_COOKIE_NAME,
        token,
        portalCookieOptions(args.tenantSlug, Math.floor(PORTAL_SESSION_TTL_MS / 1000)),
    );
}

/**
 * Reads the portal session cookie and verifies the HMAC. Returns the
 * verified `{ userId, tenantId }` payload, or `null` if no cookie / bad MAC
 * / expired. Caller is responsible for looking up the user row.
 */
export async function getPortalSession(): Promise<{
    userId: string;
    tenantId: string;
    issuedAt: number;
} | null> {
    try {
        const cookieStore = await cookies();
        const raw = cookieStore.get(PORTAL_SESSION_COOKIE_NAME)?.value;
        if (!raw) return null;
        const v = verifyPortalSessionToken(raw);
        if (!v.ok) return null;
        return { userId: v.userId, tenantId: v.tenantId, issuedAt: v.issuedAt };
    } catch {
        return null;
    }
}

export async function clearPortalSessionCookie(tenantSlug: string): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(PORTAL_SESSION_COOKIE_NAME, '', {
        httpOnly: true,
        secure: getCookieSecureFlag(),
        sameSite: 'lax',
        path: portalCookiePath(tenantSlug),
        maxAge: 0,
    });
}
