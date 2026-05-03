/**
 * Bring-Your-Own-Key (BYOK) envelope encryption.
 *
 * The intended production deployment delegates key wrapping to AWS
 * KMS — every tenant configures their own Customer Master Key (CMK)
 * ARN, and SabNode never sees the unwrapped CMK material.
 *
 * This file exposes the *interface* used by the rest of the codebase
 * (`wrapKey`, `unwrapKey`) plus an offline implementation backed by
 * `node:crypto` AES-256-GCM.  The offline implementation is what runs
 * during local development and tests; production swaps in the KMS
 * client by setting `BYOK_BACKEND=aws-kms`.
 *
 * Format on disk (`WrappedKey`):
 *   { kekArn, alg, iv, tag, ct }   — all binary fields base64.
 */

import {
    createCipheriv,
    createDecipheriv,
    createHash,
    randomBytes,
} from 'node:crypto';

import type { WrappedKey } from './types';

/* ── Offline KEK derivation ─────────────────────────────────────────── */

/**
 * Convert a KEK ARN into a deterministic 32-byte AES key.  In offline
 * mode the "ARN" is really just a label — we hash it with a hard-coded
 * salt so different ARNs derive different keys, but the same ARN is
 * stable across processes.
 *
 * Production callers (when `BYOK_BACKEND=aws-kms`) never reach this
 * function; the AWS SDK wraps and unwraps server-side.
 */
function deriveOfflineKek(kekArn: string): Buffer {
    const salt = 'sabnode:byok:offline:v1';
    return createHash('sha256').update(salt).update(kekArn).digest();
}

/* ── Public API ─────────────────────────────────────────────────────── */

/**
 * Wrap a plaintext data key under `kekArn`.  Returns a `WrappedKey`
 * envelope safe to persist alongside the ciphertext it protects.
 */
export async function wrapKey(
    plainKey: Buffer,
    kekArn: string,
): Promise<WrappedKey> {
    if (!Buffer.isBuffer(plainKey) || plainKey.length === 0) {
        throw new Error('wrapKey: plainKey must be a non-empty Buffer');
    }
    if (!kekArn) throw new Error('wrapKey: kekArn is required');

    const backend = process.env.BYOK_BACKEND ?? 'offline';
    if (backend === 'aws-kms') {
        // Production path — the AWS SDK is loaded lazily so the
        // offline path doesn't pay the import cost.
        const { KMSClient, EncryptCommand } = await import(
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore — optional peer dep, only present in prod images
            '@aws-sdk/client-kms'
        ).catch(() => {
            throw new Error(
                'BYOK_BACKEND=aws-kms but @aws-sdk/client-kms is not installed',
            );
        });
        const client = new KMSClient({});
        const out = await client.send(
            new EncryptCommand({ KeyId: kekArn, Plaintext: plainKey }),
        );
        return {
            kekArn,
            alg: 'aws:kms',
            iv: '',
            tag: '',
            ct: Buffer.from(out.CiphertextBlob as Uint8Array).toString(
                'base64',
            ),
        };
    }

    const kek = deriveOfflineKek(kekArn);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', kek, iv);
    const ct = Buffer.concat([cipher.update(plainKey), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
        kekArn,
        alg: 'AES-256-GCM',
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        ct: ct.toString('base64'),
    };
}

/**
 * Reverse of `wrapKey` — produces the original plaintext data key.
 * Throws if the ciphertext has been tampered with (GCM auth-tag fail).
 */
export async function unwrapKey(
    wrapped: WrappedKey,
    kekArn: string,
): Promise<Buffer> {
    if (wrapped.kekArn !== kekArn) {
        throw new Error('unwrapKey: kekArn mismatch');
    }

    if (wrapped.alg === 'aws:kms') {
        const { KMSClient, DecryptCommand } = await import(
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore — optional peer dep, only present in prod images
            '@aws-sdk/client-kms'
        ).catch(() => {
            throw new Error(
                'WrappedKey.alg=aws:kms but @aws-sdk/client-kms is not installed',
            );
        });
        const client = new KMSClient({});
        const out = await client.send(
            new DecryptCommand({
                KeyId: kekArn,
                CiphertextBlob: Buffer.from(wrapped.ct, 'base64'),
            }),
        );
        return Buffer.from(out.Plaintext as Uint8Array);
    }

    const kek = deriveOfflineKek(kekArn);
    const iv = Buffer.from(wrapped.iv, 'base64');
    const tag = Buffer.from(wrapped.tag, 'base64');
    const ct = Buffer.from(wrapped.ct, 'base64');

    const decipher = createDecipheriv('aes-256-gcm', kek, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
}

/**
 * Generate a random 256-bit data key.  Convenience helper for callers
 * that want to wrap a fresh key on the spot.
 */
export function generateDataKey(): Buffer {
    return randomBytes(32);
}

/** Exposed for tests. */
export const __internals = { deriveOfflineKek };
