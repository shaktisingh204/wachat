'use server';

/**
 * SabVault server actions.
 *
 * Thin proxies over the Rust BFF (`/v1/sabvault/*`). NEVER touch plaintext
 * — every payload that flows through here is already AES-GCM ciphertext
 * produced by `src/lib/sabvault/crypto.ts`. The server is a dumb store.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';
import {
    sabvaultSecretsApi,
    type SabvaultSecretDoc,
    type SabvaultSecretCreateInput,
    type SabvaultSecretUpdateInput,
    type SabvaultSecretListParams,
} from '@/lib/rust-client/sabvault-secrets';
import {
    sabvaultFoldersApi,
    type SabvaultFolderDoc,
    type SabvaultFolderCreateInput,
    type SabvaultFolderUpdateInput,
} from '@/lib/rust-client/sabvault-folders';
import {
    sabvaultSharesApi,
    type SabvaultShareDoc,
    type SabvaultShareCreateInput,
    type SabvaultShareUpdateInput,
    type SabvaultSharePermission,
    type SabvaultGranteeType,
} from '@/lib/rust-client/sabvault-shares';
import {
    sabvaultAuditApi,
    type SabvaultAuditEntry,
    type SabvaultAuditAction,
    type SabvaultAuditListParams,
} from '@/lib/rust-client/sabvault-audit';
import {
    sabvaultBreachAlertsApi,
    type SabvaultBreachAlertDoc,
    type SabvaultBreachStatus,
} from '@/lib/rust-client/sabvault-breach-alerts';

const ROUTES_TO_REVALIDATE = [
    '/dashboard/sabvault',
    '/dashboard/sabvault/audit',
    '/dashboard/sabvault/health',
];

function revalidateVault(secretId?: string): void {
    for (const r of ROUTES_TO_REVALIDATE) revalidatePath(r);
    if (secretId) revalidatePath(`/dashboard/sabvault/${secretId}`);
}

/* ─── Vault key bootstrap (server stores salt only) ─────────────────── */

/**
 * Bootstrap or fetch the per-user vault key record — stores the PBKDF2
 * salt and the encrypted canary used to verify the master password. The
 * MASTER PASSWORD ITSELF IS NEVER SENT TO THE SERVER.
 */
const VAULT_KEY_COLL = 'sabvault_user_keys';

export interface SabvaultUserKeyRecord {
    _id?: string;
    userId: string;
    saltB64: string;
    canaryB64: string;
    /** Iteration count snapshot — lets us re-key if we ever raise the floor. */
    pbkdf2Iterations: number;
    algorithm: string;
    createdAt: string;
    updatedAt?: string;
}

export async function getSabvaultUserKey(): Promise<SabvaultUserKeyRecord | null> {
    const session = await getSession();
    if (!session?.user) return null;
    try {
        const { db } = await connectToDatabase();
        const row = await db
            .collection(VAULT_KEY_COLL)
            .findOne({ userId: new ObjectId(session.user._id as unknown as string) });
        if (!row) return null;
        return {
            _id: row._id.toString(),
            userId: row.userId.toString(),
            saltB64: row.saltB64,
            canaryB64: row.canaryB64,
            pbkdf2Iterations: row.pbkdf2Iterations,
            algorithm: row.algorithm,
            createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
            updatedAt: row.updatedAt?.toISOString?.(),
        };
    } catch (e) {
        console.error('[getSabvaultUserKey]', e);
        return null;
    }
}

/**
 * Initialize a brand-new vault — saves the salt + encrypted canary. The
 * canary is computed CLIENT-SIDE so we can verify subsequent unlock
 * attempts without ever knowing the password.
 */
export async function setupSabvaultUserKey(input: {
    saltB64: string;
    canaryB64: string;
    pbkdf2Iterations: number;
    algorithm: string;
}): Promise<{ ok: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Not authenticated' };
    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id as unknown as string);
        const existing = await db.collection(VAULT_KEY_COLL).findOne({ userId });
        if (existing) {
            return { ok: false, error: 'Vault already initialized' };
        }
        await db.collection(VAULT_KEY_COLL).insertOne({
            userId,
            saltB64: input.saltB64,
            canaryB64: input.canaryB64,
            pbkdf2Iterations: input.pbkdf2Iterations,
            algorithm: input.algorithm,
            createdAt: new Date(),
        });
        revalidateVault();
        return { ok: true };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* ─── Secrets CRUD ───────────────────────────────────────────────────── */

export async function listSabvaultSecrets(
    params?: SabvaultSecretListParams,
): Promise<{ items: SabvaultSecretDoc[]; hasMore: boolean; page: number; limit: number }> {
    const session = await getSession();
    if (!session?.user)
        return { items: [], hasMore: false, page: 0, limit: 20 };
    try {
        const res = await sabvaultSecretsApi.list(params);
        return res;
    } catch (e) {
        console.error('[listSabvaultSecrets]', e);
        return { items: [], hasMore: false, page: 0, limit: 20 };
    }
}

export async function getSabvaultSecret(id: string): Promise<SabvaultSecretDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    try {
        return await sabvaultSecretsApi.getById(id);
    } catch (e) {
        console.error('[getSabvaultSecret]', e);
        return null;
    }
}

export async function createSabvaultSecret(
    input: SabvaultSecretCreateInput,
): Promise<{ id: string; entity: SabvaultSecretDoc | null; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { id: '', entity: null, error: 'Not authenticated' };
    try {
        const out = await sabvaultSecretsApi.create(input);
        revalidateVault(out.id);
        return out;
    } catch (e) {
        return { id: '', entity: null, error: getErrorMessage(e) };
    }
}

export async function updateSabvaultSecret(
    id: string,
    patch: SabvaultSecretUpdateInput,
): Promise<{ entity: SabvaultSecretDoc | null; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { entity: null, error: 'Not authenticated' };
    try {
        const entity = await sabvaultSecretsApi.update(id, patch);
        revalidateVault(id);
        return { entity };
    } catch (e) {
        return { entity: null, error: getErrorMessage(e) };
    }
}

export async function deleteSabvaultSecret(
    id: string,
): Promise<{ deleted: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { deleted: false, error: 'Not authenticated' };
    try {
        const out = await sabvaultSecretsApi.delete(id);
        revalidateVault(id);
        return out;
    } catch (e) {
        return { deleted: false, error: getErrorMessage(e) };
    }
}

/* ─── Folders ────────────────────────────────────────────────────────── */

export async function listSabvaultFolders(): Promise<SabvaultFolderDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const res = await sabvaultFoldersApi.list({ limit: 100 });
        return res.items;
    } catch (e) {
        console.error('[listSabvaultFolders]', e);
        return [];
    }
}

export async function createSabvaultFolder(
    input: SabvaultFolderCreateInput,
): Promise<{ id: string; entity: SabvaultFolderDoc | null; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { id: '', entity: null, error: 'Not authenticated' };
    try {
        const out = await sabvaultFoldersApi.create(input);
        revalidateVault();
        return out;
    } catch (e) {
        return { id: '', entity: null, error: getErrorMessage(e) };
    }
}

export async function updateSabvaultFolder(
    id: string,
    patch: SabvaultFolderUpdateInput,
): Promise<{ entity: SabvaultFolderDoc | null; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { entity: null, error: 'Not authenticated' };
    try {
        const entity = await sabvaultFoldersApi.update(id, patch);
        revalidateVault();
        return { entity };
    } catch (e) {
        return { entity: null, error: getErrorMessage(e) };
    }
}

export async function deleteSabvaultFolder(
    id: string,
): Promise<{ deleted: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { deleted: false, error: 'Not authenticated' };
    try {
        const out = await sabvaultFoldersApi.delete(id);
        revalidateVault();
        return out;
    } catch (e) {
        return { deleted: false, error: getErrorMessage(e) };
    }
}

/* ─── Sharing ────────────────────────────────────────────────────────── */

export async function shareSabvaultSecret(input: {
    secretId: string;
    granteeType: SabvaultGranteeType;
    granteeId: string;
    permission?: SabvaultSharePermission;
    expiresAt?: string;
    rewrappedPayloadB64?: string;
}): Promise<{ id: string; entity: SabvaultShareDoc | null; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { id: '', entity: null, error: 'Not authenticated' };
    try {
        const out = await sabvaultSharesApi.create({
            secretId: input.secretId,
            granteeType: input.granteeType,
            granteeId: input.granteeId,
            permission: input.permission ?? 'read',
            expiresAt: input.expiresAt,
            rewrappedPayloadB64: input.rewrappedPayloadB64,
        });
        revalidateVault(input.secretId);
        return out;
    } catch (e) {
        return { id: '', entity: null, error: getErrorMessage(e) };
    }
}

export async function revokeSabvaultShare(
    shareId: string,
): Promise<{ revoked: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { revoked: false, error: 'Not authenticated' };
    try {
        const out = await sabvaultSharesApi.revoke(shareId);
        revalidateVault();
        return out;
    } catch (e) {
        return { revoked: false, error: getErrorMessage(e) };
    }
}

export async function listSabvaultSharesForSecret(
    secretId: string,
): Promise<SabvaultShareDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const res = await sabvaultSharesApi.list({ secretId, status: 'active', limit: 100 });
        return res.items;
    } catch (e) {
        console.error('[listSabvaultSharesForSecret]', e);
        return [];
    }
}

export async function updateSabvaultShare(
    id: string,
    patch: SabvaultShareUpdateInput,
): Promise<{ entity: SabvaultShareDoc | null; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { entity: null, error: 'Not authenticated' };
    try {
        const entity = await sabvaultSharesApi.update(id, patch);
        revalidateVault();
        return { entity };
    } catch (e) {
        return { entity: null, error: getErrorMessage(e) };
    }
}

/* ─── Audit ──────────────────────────────────────────────────────────── */

export async function listSabvaultAudit(
    params?: SabvaultAuditListParams,
): Promise<{ items: SabvaultAuditEntry[]; hasMore: boolean; page: number; limit: number }> {
    const session = await getSession();
    if (!session?.user) return { items: [], hasMore: false, page: 0, limit: 20 };
    try {
        return await sabvaultAuditApi.list(params);
    } catch (e) {
        console.error('[listSabvaultAudit]', e);
        return { items: [], hasMore: false, page: 0, limit: 20 };
    }
}

/**
 * Log a client-driven access event (view/copy/reveal/unlock).
 * Called from client components after a successful reveal/copy so the
 * audit trail reflects real user behavior.
 */
export async function logSabvaultAccess(input: {
    secretId?: string;
    action: SabvaultAuditAction;
    meta?: Record<string, unknown>;
}): Promise<{ id: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { id: '', error: 'Not authenticated' };
    try {
        return await sabvaultAuditApi.log({
            secretId: input.secretId,
            action: input.action,
            meta: input.meta,
        });
    } catch (e) {
        return { id: '', error: getErrorMessage(e) };
    }
}

/* ─── Breach alerts ──────────────────────────────────────────────────── */

/**
 * Record the result of a client-side HIBP k-anonymity check. The
 * cleartext credential is hashed and queried in the browser
 * (`hibpKAnonymityHash` in `crypto.ts`); only the verdict reaches the
 * server.
 */
export async function checkSabvaultBreach(input: {
    secretId: string;
    status: SabvaultBreachStatus;
    breachCount?: number;
    source?: string;
}): Promise<{ id: string; entity: SabvaultBreachAlertDoc | null; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { id: '', entity: null, error: 'Not authenticated' };
    try {
        const out = await sabvaultBreachAlertsApi.upsert({
            secretId: input.secretId,
            status: input.status,
            breachCount: input.breachCount,
            source: input.source ?? 'hibp',
        });
        revalidateVault(input.secretId);
        return out;
    } catch (e) {
        return { id: '', entity: null, error: getErrorMessage(e) };
    }
}

export async function getSabvaultBreachForSecret(
    secretId: string,
): Promise<SabvaultBreachAlertDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    try {
        return await sabvaultBreachAlertsApi.getForSecret(secretId);
    } catch (e) {
        console.error('[getSabvaultBreachForSecret]', e);
        return null;
    }
}
