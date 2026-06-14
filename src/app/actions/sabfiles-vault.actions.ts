'use server';

/**
 * Sab Vault server actions — the zero-knowledge encrypted space inside SabFiles.
 *
 * The vault master key NEVER reaches the server: the browser derives it from the
 * user's vault password (PBKDF2, see `@/lib/sabfiles/vault/crypto`) and encrypts
 * file bytes + metadata before upload. These actions only move opaque ciphertext
 * and the per-user key bootstrap (salt + encrypted canary) to/from the Rust BFF
 * (`/v1/sabfiles/vault/*`).
 *
 * Vault uploads reuse the normal three-phase upload pipeline
 * (`presignUpload` → PUT `/api/sabfiles/upload` → `confirmVaultUpload`); the only
 * difference is the bytes are ciphertext and the node is flagged `vault: true`.
 */

import { revalidatePath } from 'next/cache';

import { rustClient, RustApiError } from '@/lib/rust-client';
import { getSession } from '@/app/actions/user.actions';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';
import type { ConfirmUploadBody, VaultKeyBody } from '@/lib/rust-client/sabfiles';

function asError(e: unknown): { error: string } {
    if (e instanceof RustApiError) return { error: e.message };
    if (e instanceof Error) return { error: e.message };
    return { error: 'Unknown error' };
}

async function getActorId(): Promise<string | null> {
    const session = await getSession();
    if (!session?.user) return null;
    const u = session.user as { _id?: string | { toString(): string }; id?: string };
    const userId = u._id ?? u.id;
    if (!userId) return null;
    return typeof userId === 'string' ? userId : String(userId);
}

/** Read the caller's vault-key bootstrap (per-user salt + encrypted canary). */
export async function getVaultKey() {
    const session = await getSession();
    if (!session?.user) return { error: 'Unauthorized' };
    try {
        return await rustClient.sabfiles.vaultKeyGet();
    } catch (e) {
        return asError(e);
    }
}

/**
 * Initialize the vault for the caller (store salt + canary). Rejected by the BFF
 * if a key already exists — re-keying would orphan every encrypted file.
 */
export async function createVaultKey(body: VaultKeyBody) {
    const session = await getSession();
    if (!session?.user) return { error: 'Unauthorized' };
    try {
        const res = await rustClient.sabfiles.vaultKeyCreate(body);
        const actorId = await getActorId();
        if (actorId) {
            void recordFlowAction('sabvault.initialized', { userId: actorId });
        }
        return res;
    } catch (e) {
        return asError(e);
    }
}

/** List the caller's encrypted vault files (names are decrypted client-side). */
export async function listVaultNodes() {
    const session = await getSession();
    if (!session?.user) return { error: 'Unauthorized' };
    try {
        return await rustClient.sabfiles.vaultList();
    } catch (e) {
        return asError(e);
    }
}

/**
 * Record an uploaded vault file. `vault` is forced true; `vault_meta` carries the
 * client-encrypted name/mime envelope. The R2 object already holds ciphertext
 * (the browser encrypted it before the PUT).
 */
export async function confirmVaultUpload(body: ConfirmUploadBody) {
    const session = await getSession();
    if (!session?.user) return { error: 'Unauthorized' };
    try {
        const { node } = await rustClient.sabfiles.confirmUpload({ ...body, vault: true });
        revalidatePath('/dashboard/sabfiles/vault');
        const actorId = await getActorId();
        if (actorId) {
            void recordFlowAction('sabvault.fileAdded', {
                userId: actorId,
                target: (node as { id?: string } | undefined)?.id,
            });
        }
        return { node };
    } catch (e) {
        return asError(e);
    }
}
