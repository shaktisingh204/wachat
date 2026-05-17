/**
 * Per-tenant IRP / EWB credentials store (§6.10).
 *
 * Collections:
 *   • `crm_india_tax_credentials` — keyed on `tenantUserId`. Holds the
 *     encrypted IRP + EWB credentials plus a sandbox flag and the
 *     selected provider id.
 *
 * Encryption: AES-256-GCM with `INDIA_TAX_ENCRYPTION_KEY` (hex- or
 * base64-encoded, must decode to exactly 32 bytes). We never persist
 * plaintext secrets; the encrypted record stores `{ iv, tag, ciphertext }`
 * triplets. If the env var is missing we fall back to a clearly-marked
 * `'unencrypted'` envelope so dev still works — but `getTenantIrpCredentials`
 * warns once per process and the production deploy gate is the env var.
 *
 * Decryption never crashes the request; if it fails we return `null`
 * and let the caller fall through to `InternalProvider`.
 */
import 'server-only';

import crypto from 'node:crypto';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';

import type { EInvoiceCredentials } from './e-invoice-providers';
import type { EWayBillCredentials } from './eway-bill-providers';

// ──────────────────────────────────────────────────────────────────
// Encryption helpers
// ──────────────────────────────────────────────────────────────────

export interface SecretEnvelope {
    /** `aes-256-gcm` for encrypted values, `unencrypted` for dev fallback. */
    alg: 'aes-256-gcm' | 'unencrypted';
    /** Base64-encoded IV (12 bytes for GCM). Empty for `unencrypted`. */
    iv: string;
    /** Base64-encoded auth tag. Empty for `unencrypted`. */
    tag: string;
    /** Base64-encoded ciphertext, or plain UTF-8 for `unencrypted`. */
    ct: string;
}

let warnedNoKey = false;

function loadKey(): Buffer | null {
    const raw = process.env.INDIA_TAX_ENCRYPTION_KEY;
    if (!raw) {
        if (!warnedNoKey) {
            console.warn(
                '[india-tax] INDIA_TAX_ENCRYPTION_KEY not set — credentials will be stored unencrypted. ' +
                'Set a 32-byte hex/base64 key before production use.',
            );
            warnedNoKey = true;
        }
        return null;
    }
    // Accept either hex (64 chars) or base64.
    let buf: Buffer;
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
        buf = Buffer.from(raw, 'hex');
    } else {
        buf = Buffer.from(raw, 'base64');
    }
    if (buf.length !== 32) {
        throw new Error(
            `INDIA_TAX_ENCRYPTION_KEY must decode to 32 bytes (got ${buf.length}).`,
        );
    }
    return buf;
}

export function encryptSecret(plaintext: string): SecretEnvelope {
    if (typeof plaintext !== 'string') plaintext = String(plaintext ?? '');
    const key = loadKey();
    if (!key) {
        return {
            alg: 'unencrypted',
            iv: '',
            tag: '',
            ct: Buffer.from(plaintext, 'utf8').toString('base64'),
        };
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        alg: 'aes-256-gcm',
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        ct: ct.toString('base64'),
    };
}

export function decryptSecret(env: SecretEnvelope | null | undefined): string | null {
    if (!env || typeof env !== 'object') return null;
    if (env.alg === 'unencrypted') {
        try {
            return Buffer.from(env.ct, 'base64').toString('utf8');
        } catch {
            return null;
        }
    }
    const key = loadKey();
    if (!key) return null;
    try {
        const iv = Buffer.from(env.iv, 'base64');
        const tag = Buffer.from(env.tag, 'base64');
        const ct = Buffer.from(env.ct, 'base64');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
        return pt.toString('utf8');
    } catch (e) {
        console.error('[india-tax] decrypt failed:', e);
        return null;
    }
}

// ──────────────────────────────────────────────────────────────────
// Stored credential document
// ──────────────────────────────────────────────────────────────────

export interface StoredTenantTaxCredentials {
    _id?: ObjectId;
    userId: ObjectId;
    /** Provider id for e-invoice — defaults to `'internal'` in the UI. */
    eInvoiceProvider?: string;
    /** Provider id for e-way bill — defaults to `'internal'`. */
    eWayBillProvider?: string;
    gstin?: string;
    sandboxMode?: boolean;

    irpUsername?: SecretEnvelope | null;
    irpPassword?: SecretEnvelope | null;
    irpClientId?: SecretEnvelope | null;
    irpClientSecret?: SecretEnvelope | null;

    ewbUsername?: SecretEnvelope | null;
    ewbPassword?: SecretEnvelope | null;

    createdAt?: Date;
    updatedAt?: Date;
}

export async function getTenantTaxCredentialDoc(
    tenantUserId: string,
): Promise<StoredTenantTaxCredentials | null> {
    if (!tenantUserId || !ObjectId.isValid(tenantUserId)) return null;
    const { db } = await connectToDatabase();
    const doc = await db
        .collection<StoredTenantTaxCredentials>('crm_india_tax_credentials')
        .findOne({ userId: new ObjectId(tenantUserId) });
    return doc ?? null;
}

/**
 * Returns decrypted IRP credentials, or `null` if not configured.
 * The action layer falls through to `InternalProvider` on null.
 */
export async function getTenantIrpCredentials(
    tenantUserId: string,
): Promise<EInvoiceCredentials | null> {
    const doc = await getTenantTaxCredentialDoc(tenantUserId);
    if (!doc) return null;
    const irpUsername = decryptSecret(doc.irpUsername);
    const irpPassword = decryptSecret(doc.irpPassword);
    if (!irpUsername || !irpPassword || !doc.gstin) return null;
    return {
        irpUsername,
        irpPassword,
        irpClientId: decryptSecret(doc.irpClientId) ?? undefined,
        irpClientSecret: decryptSecret(doc.irpClientSecret) ?? undefined,
        gstin: doc.gstin,
        sandboxMode: doc.sandboxMode ?? true,
    };
}

export async function getTenantEwbCredentials(
    tenantUserId: string,
): Promise<EWayBillCredentials | null> {
    const doc = await getTenantTaxCredentialDoc(tenantUserId);
    if (!doc) return null;
    const ewbUsername = decryptSecret(doc.ewbUsername);
    const ewbPassword = decryptSecret(doc.ewbPassword);
    if (!ewbUsername || !ewbPassword || !doc.gstin) return null;
    return {
        ewbUsername,
        ewbPassword,
        gstin: doc.gstin,
        sandboxMode: doc.sandboxMode ?? true,
    };
}

export async function getTenantProviderIds(
    tenantUserId: string,
): Promise<{ eInvoice: string; eWayBill: string }> {
    const doc = await getTenantTaxCredentialDoc(tenantUserId);
    return {
        eInvoice: doc?.eInvoiceProvider || 'internal',
        eWayBill: doc?.eWayBillProvider || 'internal',
    };
}
