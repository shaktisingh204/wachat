/**
 * SHA-256 hex hashing helpers for SabCatalyst secrets (passwords + API
 * keys). The plaintext never reaches the Rust surface — TS hashes it
 * client-side of the Rust boundary before forwarding.
 */
import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

export function sha256Hex(input: string): string {
    return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Generate a high-entropy API key secret. Format: `sabk_<32 url-safe bytes>`. */
export function generateApiKeySecret(): { plaintext: string; hash: string } {
    const raw = randomBytes(24).toString('base64url');
    const plaintext = `sabk_${raw}`;
    return { plaintext, hash: sha256Hex(plaintext) };
}

/** Generate a session token (returned to client, stored hashed). */
export function generateSessionToken(): { plaintext: string; hash: string } {
    const raw = randomBytes(32).toString('base64url');
    const plaintext = `sabs_${raw}`;
    return { plaintext, hash: sha256Hex(plaintext) };
}
