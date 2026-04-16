/**
 * SabFlow — Credentials encryption helpers
 *
 * AES-256-GCM symmetric encryption using Node's built-in `crypto`.
 *
 * Format of the encrypted string:
 *   `base64(iv):base64(ciphertext):base64(authTag)`
 *
 * The key is sourced from `process.env.CREDENTIALS_ENCRYPTION_KEY` and falls
 * back to a SHA-256 hash of `NEXTAUTH_SECRET` when the dedicated env var is
 * missing. This keeps local dev working without extra setup while still
 * producing a 32-byte key suitable for AES-256.
 */

import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/* ── Constants ──────────────────────────────────────────────────────────── */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV is the recommended size for GCM
const KEY_LENGTH = 32; // 256 bits

/* ── Key derivation ─────────────────────────────────────────────────────── */

/**
 * Coerce an arbitrary string secret into a 32-byte key via SHA-256.
 * SHA-256 is deterministic so the same secret always yields the same key,
 * which is required for decryption to work across restarts.
 */
function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

/**
 * Resolve the encryption key used by this process.
 *
 * Priority:
 *   1. `CREDENTIALS_ENCRYPTION_KEY`   — preferred dedicated env var
 *   2. `NEXTAUTH_SECRET`              — fallback for environments that only
 *                                        have the NextAuth secret provisioned
 *   3. Throws when neither is set.
 */
function resolveDefaultKey(): Buffer {
  const primary = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (primary && primary.length > 0) return deriveKey(primary);

  const fallback = process.env.NEXTAUTH_SECRET;
  if (fallback && fallback.length > 0) return deriveKey(fallback);

  throw new Error(
    '[sabflow/credentials] CREDENTIALS_ENCRYPTION_KEY (or NEXTAUTH_SECRET fallback) is not set',
  );
}

/**
 * Accepts either a caller-supplied key string or falls back to the process
 * default.  A hex-encoded 64-character string is used verbatim; anything else
 * is run through SHA-256.
 */
function toKeyBuffer(key?: string): Buffer {
  if (!key) return resolveDefaultKey();

  // A 64-char hex string encodes exactly 32 bytes → use as-is.
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex');
  }
  return deriveKey(key);
}

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * Encrypt a UTF-8 plaintext string and return a base64-encoded
 * `iv:ciphertext:authTag` triplet.
 *
 * @param plain  The plaintext to encrypt.
 * @param key    Optional override for the encryption key (otherwise the
 *               process-level default is used).
 */
export function encryptData(plain: string, key?: string): string {
  if (typeof plain !== 'string') {
    throw new TypeError('encryptData: `plain` must be a string');
  }

  const keyBuf = toKeyBuffer(key);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, keyBuf, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${ciphertext.toString('base64')}:${authTag.toString('base64')}`;
}

/**
 * Decrypt a string previously produced by {@link encryptData}.
 *
 * @param encrypted The `iv:ciphertext:authTag` string.
 * @param key       Optional override for the encryption key.
 */
export function decryptData(encrypted: string, key?: string): string {
  if (typeof encrypted !== 'string' || encrypted.length === 0) {
    throw new TypeError('decryptData: `encrypted` must be a non-empty string');
  }

  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('decryptData: invalid payload shape (expected iv:ciphertext:tag)');
  }

  const [ivB64, dataB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const ciphertext = Buffer.from(dataB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');

  if (iv.length !== IV_LENGTH) {
    throw new Error('decryptData: unexpected IV length');
  }

  const keyBuf = toKeyBuffer(key);
  if (keyBuf.length !== KEY_LENGTH) {
    throw new Error('decryptData: derived key has unexpected length');
  }

  const decipher = createDecipheriv(ALGORITHM, keyBuf, iv);
  decipher.setAuthTag(authTag);

  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
}

/**
 * Encrypt every value of a flat key/value map.
 * Useful when persisting `Credential.data`.
 */
export function encryptRecord(
  data: Record<string, string>,
  key?: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(data)) {
    out[k] = encryptData(data[k] ?? '', key);
  }
  return out;
}

/**
 * Decrypt every value of a flat key/value map produced by
 * {@link encryptRecord}.  Silently skips values that fail to decrypt so that
 * a partially corrupted record is still usable.
 */
export function decryptRecord(
  data: Record<string, string>,
  key?: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(data)) {
    const raw = data[k];
    try {
      out[k] = decryptData(raw, key);
    } catch {
      // Corrupt or plaintext-legacy value — preserve as empty string rather
      // than throwing, so the row can still be edited in the UI.
      out[k] = '';
    }
  }
  return out;
}
