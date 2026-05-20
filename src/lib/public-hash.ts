/**
 * Public hash utility for unauthenticated portal URLs.
 *
 * Used by:
 *  - `/share/invoice/[hash]`
 *  - `/share/estimate/[hash]`
 *  - `/share/proposal/[hash]`
 *  - `/share/contract/[hash]`
 *  - `/share/lead-form/[formId]` (lead forms use the raw ObjectId)
 *
 * Hash format: 32-char lowercase hex (16 bytes). Stored in the
 * record's `publicHash` field. Collisions are vanishingly rare at
 * 2^128 entropy; no retry loop is required.
 */

import { randomBytes } from 'crypto';

export function generatePublicHash(): string {
  return randomBytes(16).toString('hex'); // 32 chars
}

/**
 * Validates a hash string is the right shape before hitting Mongo.
 * Reject malformed input early so attackers can't probe with garbage.
 */
export function isValidPublicHash(hash: unknown): hash is string {
  return typeof hash === 'string' && /^[a-f0-9]{32}$/.test(hash);
}
