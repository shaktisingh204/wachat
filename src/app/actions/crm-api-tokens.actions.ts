'use server';

/**
 * CRM Public API — token management server actions (Phase 7 foundation).
 *
 * Backs `/dashboard/crm/settings/api-tokens` (list + new). The plain-text
 * token is shown EXACTLY ONCE in the response from `generateApiToken`; we
 * persist only the sha-256 hash. All actions are gated by the
 * `crm_settings` permission so we don't add a new RBAC key.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type Filter, type Document } from 'mongodb';
import { randomBytes } from 'node:crypto';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { requirePermission } from '@/lib/rbac-server';
import { hashApiToken } from '@/lib/api/auth';
import {
    ALL_CRM_SCOPES,
    isOAuthScope,
    type OAuthScope,
} from '@/lib/api/oauth-scopes';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';

/* ── Public DTO ─────────────────────────────────────────────────────────── */

/** What we send to the UI. Crucially, NEVER the hash or raw token. */
export interface CrmApiTokenRow {
    _id: string;
    name: string;
    prefix: string;
    scopes: OAuthScope[];
    expiresAt: string | null;
    lastUsedAt: string | null;
    createdAt: string;
    revoked: boolean;
}

export interface GenerateApiTokenResult {
    ok: true;
    /** The plain-text token — show once, never again. */
    token: string;
    row: CrmApiTokenRow;
}

export interface GenerateApiTokenError {
    ok: false;
    error: string;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

/**
 * Generate a 32-byte URL-safe random token with a stable visual prefix.
 *
 *   sn_crm_<base64url(32 bytes)>   (≈ 50 chars total)
 */
function freshTokenString(): string {
    const random = randomBytes(32).toString('base64url');
    return `sn_crm_${random}`;
}

function rowFromDoc(doc: Document & { _id: ObjectId }): CrmApiTokenRow {
    return {
        _id: doc._id.toHexString(),
        name: String(doc.name ?? ''),
        prefix: String(doc.prefix ?? ''),
        scopes: Array.isArray(doc.scopes)
            ? (doc.scopes as string[]).filter(isOAuthScope)
            : [],
        expiresAt: typeof doc.expiresAt === 'string' ? doc.expiresAt : null,
        lastUsedAt: typeof doc.lastUsedAt === 'string' ? doc.lastUsedAt : null,
        createdAt: typeof doc.createdAt === 'string' ? doc.createdAt : '',
        revoked: doc.revoked === true,
    };
}

/* ── Actions ────────────────────────────────────────────────────────────── */

/** List all API tokens for the current tenant (excluding the raw hash). */
export async function getApiTokens(): Promise<CrmApiTokenRow[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission('crm_settings', 'view');
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Document> = {
            tenantUserId: String(session.user._id),
        };
        const docs = await db
            .collection('crm_api_tokens')
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(200)
            .toArray();
        return docs.map((d) => rowFromDoc(d as Document & { _id: ObjectId }));
    } catch (e) {
        console.error('[crm-api-tokens] getApiTokens failed:', e);
        return [];
    }
}

export interface GenerateApiTokenInput {
    name: string;
    scopes: OAuthScope[];
    /** Optional duration in days. `undefined`/`null` ⇒ never expires. */
    expiresInDays?: number | null;
}

/** Generate a new token, persisting only the hash. */
export async function generateApiToken(
    input: GenerateApiTokenInput,
): Promise<GenerateApiTokenResult | GenerateApiTokenError> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Authentication required.' };

    const guard = await requirePermission('crm_settings', 'edit');
    if (!guard.ok) return { ok: false, error: guard.error };

    const name = (input.name ?? '').trim();
    if (!name) return { ok: false, error: 'Token name is required.' };

    const rawScopes = Array.isArray(input.scopes) ? input.scopes : [];
    const scopes = rawScopes.filter(isOAuthScope);
    if (scopes.length === 0) {
        return { ok: false, error: 'At least one scope is required.' };
    }
    // Defensive: reject anything outside our catalogue.
    for (const s of scopes) {
        if (s !== 'crm:*' && !(ALL_CRM_SCOPES as string[]).includes(s)) {
            return { ok: false, error: `Unknown scope: ${s}` };
        }
    }

    let expiresAt: string | null = null;
    if (input.expiresInDays != null && Number.isFinite(input.expiresInDays)) {
        const days = Math.max(1, Math.min(3650, Math.floor(input.expiresInDays)));
        expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
    }

    const plain = freshTokenString();
    const hashedToken = hashApiToken(plain);
    const prefix = plain.slice(0, 12); // "sn_crm_xxxxx"

    const now = new Date().toISOString();
    const doc: Document = {
        tenantUserId: String(session.user._id),
        name,
        hashedToken,
        prefix,
        scopes,
        expiresAt,
        lastUsedAt: null,
        revoked: false,
        createdAt: now,
        createdBy: String(session.user._id),
    };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_api_tokens').insertOne(doc);
        revalidatePath('/dashboard/crm/settings/api-tokens');
        void recordFlowAction('crm.apiToken.created', {
            userId: String(session.user._id),
            target: String(result.insertedId),
            metadata: { name, scopes, expiresAt },
        });
        return {
            ok: true,
            token: plain,
            row: rowFromDoc({ ...doc, _id: result.insertedId } as Document & {
                _id: ObjectId;
            }),
        };
    } catch (e) {
        console.error('[crm-api-tokens] generate failed:', e);
        return { ok: false, error: 'Failed to create token.' };
    }
}

/* ── Bulk actions ───────────────────────────────────────────────────────── */

export type BulkResult = { ok: true; count: number } | { ok: false; error: string };

/** Bulk revoke (soft-delete) multiple tokens by id. */
export async function bulkRevokeApiTokens(ids: string[]): Promise<BulkResult> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Authentication required.' };

    const guard = await requirePermission('crm_settings', 'edit');
    if (!guard.ok) return { ok: false, error: guard.error };

    const validIds = ids.filter((id) => /^[a-fA-F0-9]{24}$/.test(id));
    if (validIds.length === 0) return { ok: false, error: 'No valid token IDs provided.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_api_tokens').updateMany(
            {
                _id: { $in: validIds.map((id) => new ObjectId(id)) },
                tenantUserId: String(session.user._id),
                revoked: { $ne: true },
            },
            { $set: { revoked: true, revokedAt: new Date().toISOString() } },
        );
        revalidatePath('/dashboard/crm/settings/api-tokens');
        return { ok: true, count: result.modifiedCount };
    } catch (e) {
        console.error('[crm-api-tokens] bulkRevoke failed:', e);
        return { ok: false, error: 'Failed to revoke tokens.' };
    }
}

/** Bulk hard-delete multiple tokens by id. */
export async function bulkDeleteApiTokens(ids: string[]): Promise<BulkResult> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Authentication required.' };

    const guard = await requirePermission('crm_settings', 'edit');
    if (!guard.ok) return { ok: false, error: guard.error };

    const validIds = ids.filter((id) => /^[a-fA-F0-9]{24}$/.test(id));
    if (validIds.length === 0) return { ok: false, error: 'No valid token IDs provided.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_api_tokens').deleteMany({
            _id: { $in: validIds.map((id) => new ObjectId(id)) },
            tenantUserId: String(session.user._id),
        });
        revalidatePath('/dashboard/crm/settings/api-tokens');
        return { ok: true, count: result.deletedCount };
    } catch (e) {
        console.error('[crm-api-tokens] bulkDelete failed:', e);
        return { ok: false, error: 'Failed to delete tokens.' };
    }
}

/** Revoke (soft-delete) a token by id. */
export async function revokeApiToken(
    id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Authentication required.' };

    const guard = await requirePermission('crm_settings', 'edit');
    if (!guard.ok) return { ok: false, error: guard.error };

    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
        return { ok: false, error: 'Invalid token id.' };
    }

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_api_tokens').updateOne(
            {
                _id: new ObjectId(id),
                tenantUserId: String(session.user._id),
            },
            { $set: { revoked: true, revokedAt: new Date().toISOString() } },
        );
        if (result.matchedCount === 0) {
            return { ok: false, error: 'Token not found.' };
        }
        revalidatePath('/dashboard/crm/settings/api-tokens');
        void recordFlowAction('crm.apiToken.revoked', {
            userId: String(session.user._id),
            target: id,
        });
        return { ok: true };
    } catch (e) {
        console.error('[crm-api-tokens] revoke failed:', e);
        return { ok: false, error: 'Failed to revoke token.' };
    }
}

export interface TestApiTokenResult {
    ok: true;
    name: string;
    scopes: OAuthScope[];
    expiresAt: string | null;
    status: 'valid' | 'expired' | 'revoked';
}

/** Test an API token to verify if it is active, not revoked, and not expired. */
export async function testApiToken(
    id: string,
): Promise<TestApiTokenResult | { ok: false; error: string }> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Authentication required.' };

    const guard = await requirePermission('crm_settings', 'view');
    if (!guard.ok) return { ok: false, error: guard.error };

    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
        return { ok: false, error: 'Invalid token id.' };
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_api_tokens').findOne({
            _id: new ObjectId(id),
            tenantUserId: String(session.user._id),
        });
        if (!doc) return { ok: false, error: 'Token not found.' };

        const isRevoked = doc.revoked === true;
        let isExpired = false;
        if (doc.expiresAt) {
            const exp = new Date(doc.expiresAt).getTime();
            if (exp < Date.now()) {
                isExpired = true;
            }
        }

        let status: 'valid' | 'expired' | 'revoked' = 'valid';
        if (isRevoked) status = 'revoked';
        else if (isExpired) status = 'expired';

        return {
            ok: true,
            name: String(doc.name ?? ''),
            scopes: Array.isArray(doc.scopes) ? (doc.scopes as string[]).filter(isOAuthScope) : [],
            expiresAt: typeof doc.expiresAt === 'string' ? doc.expiresAt : null,
            status,
        };
    } catch (e) {
        console.error('[crm-api-tokens] test failed:', e);
        return { ok: false, error: 'Failed to test token.' };
    }
}

