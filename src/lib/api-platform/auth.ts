/**
 * SabNode Developer Platform — API-key authentication.
 *
 * Verifies bearer tokens against the `api_keys` Mongo collection and
 * returns the owning tenant + granted scopes.  Hashes are sha-256 hex —
 * we never store plain-text keys.
 *
 * Usage:
 *
 *   const ctx = await verifyApiKey(req);
 *   if (!ctx) return new Response('Unauthorized', { status: 401 });
 *   if (!requireScope('contacts:read', ctx)) {
 *     return new Response('Forbidden', { status: 403 });
 *   }
 */

import 'server-only';

import { createHash } from 'node:crypto';
import { connectToDatabase } from '@/lib/mongodb';
import type { OAuthScope, RateLimitTier } from './types';

/**
 * The minimal authenticated context produced by `verifyApiKey`.
 *
 * `keyId` is the hex Mongo id of the matched key — useful for rate-limit
 * keying so each API key gets its own bucket.
 */
export interface ApiAuthContext {
  tenantId: string;
  scopes: OAuthScope[];
  tier: RateLimitTier;
  keyId: string;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** sha-256 hex digest. */
function hashKey(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

/**
 * Pull a bearer token out of an incoming request.  Accepts both the
 * standard `Authorization: Bearer …` header and an `X-Api-Key` header
 * for convenience.
 */
function extractKey(req: Request): string | null {
  const authz = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (authz) {
    const m = /^Bearer\s+(.+)$/i.exec(authz.trim());
    if (m && m[1]) return m[1].trim();
  }
  const direct = req.headers.get('x-api-key') ?? req.headers.get('X-Api-Key');
  if (direct && direct.trim()) return direct.trim();
  return null;
}

/* ── Public API ──────────────────────────────────────────────────────────── */

/**
 * Verifies an inbound request's API key.
 *
 *  - Looks up the sha-256 hash in `api_keys`
 *  - Rejects revoked keys
 *  - Bumps `lastUsedAt` (fire-and-forget)
 *
 * Returns `null` for any failure — callers should treat that as 401.
 */
export async function verifyApiKey(req: Request): Promise<ApiAuthContext | null> {
  const plain = extractKey(req);
  if (!plain) return null;

  const hashed = hashKey(plain);

  try {
    const { db } = await connectToDatabase();
    const col = db.collection('api_keys');

    const doc = await col.findOne<{
      _id: unknown;
      tenantId: string;
      key: string;
      scopes: OAuthScope[];
      tier?: RateLimitTier;
      revoked?: boolean;
    }>({ key: hashed, revoked: { $ne: true } });

    if (!doc) return null;

    // Best-effort lastUsedAt bump — never block the request on it.
    void col
      .updateOne({ _id: doc._id as never }, { $set: { lastUsedAt: new Date().toISOString() } })
      .catch(() => undefined);

    const keyId =
      typeof doc._id === 'object' && doc._id !== null && 'toHexString' in (doc._id as object)
        ? (doc._id as { toHexString(): string }).toHexString()
        : String(doc._id);

    return {
      tenantId: doc.tenantId,
      scopes: Array.isArray(doc.scopes) ? doc.scopes : [],
      tier: doc.tier ?? 'FREE',
      keyId,
    };
  } catch (err) {
    console.error('[api-platform] verifyApiKey failed:', err);
    return null;
  }
}

/**
 * Returns true when the auth context grants `scope`.  The wildcard `*`
 * scope satisfies any check.
 */
export function requireScope(scope: OAuthScope, ctx: ApiAuthContext | null): boolean {
  if (!ctx) return false;
  if (ctx.scopes.includes('*')) return true;
  return ctx.scopes.includes(scope);
}
