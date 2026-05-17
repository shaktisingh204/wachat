/**
 * CRM Public API — bearer-token authentication (Phase 7 foundation).
 *
 *   const auth = await authenticatePublicRequest(req);
 *   if ('error' in auth) return auth.error;
 *   // auth.tenantUserId / auth.scopes are now safe to use.
 *
 * Tokens are issued by tenant admins via the dashboard and stored hashed
 * in the `crm_api_tokens` Mongo collection. The plain-text token is shown
 * exactly once at creation time and never persisted.
 *
 * Token format: `sn_crm_<32-byte-base64url>` (44 chars after the prefix).
 * The prefix is purely cosmetic — the matched lookup is by sha-256 hash.
 *
 * On a successful lookup we fire-and-forget bump `lastUsedAt`. Expired or
 * revoked tokens are treated as invalid.
 */

import 'server-only';

import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';
import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';

import { ApiErrors, type ApiErrorBody } from './errors';
import { type OAuthScope, isOAuthScope, requireScope } from './oauth-scopes';

/** Stored token shape — never serialised to the client. */
export interface CrmApiTokenDoc {
    _id?: ObjectId;
    /** The owning tenant — same as `userId` on other CRM collections. */
    tenantUserId: string;
    /** Human-readable label set at creation. */
    name: string;
    /** sha-256 hex digest of the plain-text token. */
    hashedToken: string;
    /** First 12 chars of the plain token (display only, e.g. "sn_crm_4f9a"). */
    prefix: string;
    /** Granted scopes. */
    scopes: OAuthScope[];
    /** ISO timestamp — `null` means never expires. */
    expiresAt: string | null;
    /** ISO timestamp of last successful use, `null` if never. */
    lastUsedAt: string | null;
    /** True once revoked. */
    revoked: boolean;
    createdAt: string;
    createdBy?: string;
}

/** Successful authentication context returned to the handler. */
export interface PublicAuthContext {
    /** Hex id of the matched `crm_api_tokens` row. */
    tokenId: string;
    /** Owning tenant. */
    tenantUserId: string;
    /** Granted scopes. */
    scopes: OAuthScope[];
    /** Token prefix (for log correlation; never the raw token). */
    prefix: string;
}

export type PublicAuthResult =
    | PublicAuthContext
    | { error: NextResponse<ApiErrorBody> };

/** sha-256 hex digest. */
export function hashApiToken(plain: string): string {
    return createHash('sha256').update(plain).digest('hex');
}

/** Extract the bearer token from `Authorization: Bearer <token>`. */
function extractBearer(req: Request): string | null {
    const authz = req.headers.get('authorization') ?? req.headers.get('Authorization');
    if (!authz) return null;
    const m = /^Bearer\s+(.+)$/i.exec(authz.trim());
    if (!m || !m[1]) return null;
    const token = m[1].trim();
    return token.length > 0 ? token : null;
}

/**
 * Authenticate an inbound public-API request.
 *
 * Returns either a `PublicAuthContext` (success) or an `{ error }` envelope
 * carrying the appropriate `NextResponse` — callers should `return auth.error`
 * verbatim so the wire format stays consistent.
 */
export async function authenticatePublicRequest(
    req: NextRequest | Request,
): Promise<PublicAuthResult> {
    const plain = extractBearer(req);
    if (!plain) {
        return { error: ApiErrors.unauthorized() };
    }
    const hashed = hashApiToken(plain);

    let doc: CrmApiTokenDoc | null = null;
    try {
        const { db } = await connectToDatabase();
        doc = await db
            .collection<CrmApiTokenDoc>('crm_api_tokens')
            .findOne({ hashedToken: hashed, revoked: { $ne: true } });
    } catch (err) {
        console.error('[api/auth] crm_api_tokens lookup failed:', err);
        return { error: ApiErrors.internalError('Authentication backend unavailable') };
    }

    if (!doc) {
        return { error: ApiErrors.invalidToken() };
    }

    if (doc.expiresAt) {
        const exp = Date.parse(doc.expiresAt);
        if (Number.isFinite(exp) && exp < Date.now()) {
            return { error: ApiErrors.invalidToken('Token expired') };
        }
    }

    const tokenId =
        doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id ?? '');

    // Best-effort lastUsedAt bump — never block the request.
    void (async () => {
        try {
            const { db } = await connectToDatabase();
            await db
                .collection('crm_api_tokens')
                .updateOne(
                    { _id: doc!._id },
                    { $set: { lastUsedAt: new Date().toISOString() } },
                );
        } catch {
            // swallow
        }
    })();

    const scopes = Array.isArray(doc.scopes)
        ? doc.scopes.filter(isOAuthScope)
        : [];

    return {
        tokenId,
        tenantUserId: doc.tenantUserId,
        scopes,
        prefix: doc.prefix ?? '',
    };
}

/**
 * Convenience helper for route handlers: authenticate AND enforce a scope
 * in one shot. Returns either `{ ctx }` on success or `{ error }` (already
 * wrapped as a `NextResponse`) on failure.
 */
export async function authenticateAndRequireScope(
    req: NextRequest | Request,
    scope: OAuthScope,
): Promise<{ ctx: PublicAuthContext } | { error: NextResponse<ApiErrorBody> }> {
    const result = await authenticatePublicRequest(req);
    if ('error' in result) return { error: result.error };
    if (!requireScope(result.scopes, scope)) {
        return { error: ApiErrors.scopeMissing(scope) };
    }
    return { ctx: result };
}
