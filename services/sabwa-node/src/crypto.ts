/**
 * AES-256-GCM at-rest encryption for Baileys `auth_state` blobs.
 *
 * Wire format (must match `services/sabwa-engine/src/crypto.rs`):
 *
 *   [ 12-byte nonce ][ ciphertext ][ 16-byte GCM tag ]
 *
 * The Rust `aes-gcm` crate appends the 16-byte tag to the ciphertext during
 * `encrypt`, then splits it back off during `decrypt`. Node's `createCipheriv`
 * keeps the ciphertext and tag separate, so we have to manually assemble the
 * same byte layout here — otherwise existing rows in `sabwa_sessions` written
 * by the Rust engine cannot be decrypted by this service (and vice versa).
 *
 * Key sourcing: `process.env.AUTH_STATE_KEY` (preferred) or, for backwards
 * compatibility with the Rust env name, `SABWA_AUTH_ENCRYPTION_KEY`. Accepts
 * either base64 of 32 bytes or 64 hex chars (optionally `0x`-prefixed),
 * mirroring `AuthStateCrypto::from_key_string`.
 *
 * In `NODE_ENV === 'production'` we throw if the key is missing. In
 * development we emit a warning and use a deterministic dev-only key so the
 * service still boots locally without secrets configured.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const KEY_LEN = 32; // AES-256
const NONCE_LEN = 12; // GCM nonce
const TAG_LEN = 16; // GCM auth tag

/** Deterministic 32-byte key used only when NODE_ENV !== 'production'. */
const DEV_KEY: Buffer = Buffer.alloc(KEY_LEN, 0xab);

/**
 * Parse a key string the same way the Rust side does:
 *   1. Try 64-char hex (optionally `0x`-prefixed).
 *   2. Fall back to base64 of exactly 32 bytes.
 *
 * Returns the raw 32 bytes or throws on any parse / length failure.
 */
export function parseKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error(
      'AUTH_STATE_KEY is empty — must be 32 bytes (64 hex chars or base64)',
    );
  }

  const hexCandidate = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;
  if (hexCandidate.length === KEY_LEN * 2 && /^[0-9a-fA-F]+$/.test(hexCandidate)) {
    return Buffer.from(hexCandidate, 'hex');
  }

  // Fall back to base64. Node tolerates URL-safe variants automatically.
  let decoded: Buffer;
  try {
    decoded = Buffer.from(trimmed, 'base64');
  } catch (err) {
    throw new Error(
      `AUTH_STATE_KEY is neither 64 hex chars nor valid base64: ${(err as Error).message}`,
    );
  }
  if (decoded.length !== KEY_LEN) {
    throw new Error(
      `AUTH_STATE_KEY must decode to exactly ${KEY_LEN} bytes (got ${decoded.length})`,
    );
  }
  return decoded;
}

/** Lazily resolve the key. Cached so we only parse / warn once per process. */
let cachedKey: Buffer | null = null;

function resolveKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.AUTH_STATE_KEY ?? process.env.SABWA_AUTH_ENCRYPTION_KEY;
  if (raw && raw.trim().length > 0) {
    cachedKey = parseKey(raw);
    return cachedKey;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'AUTH_STATE_KEY is required in production (base64-encoded 32 bytes)',
    );
  }

  // Dev fallback — never used in prod, key is constant so devs can roundtrip.
  // eslint-disable-next-line no-console
  console.warn(
    '[sabwa-node/crypto] AUTH_STATE_KEY not set — using insecure dev key. ' +
      'Set AUTH_STATE_KEY before deploying.',
  );
  cachedKey = DEV_KEY;
  return cachedKey;
}

/**
 * Encrypt `plaintext` with AES-256-GCM.
 *
 * Returns `[nonce(12) | ciphertext | tag(16)]` — byte-for-byte compatible
 * with blobs produced by the Rust engine's `AuthStateCrypto::encrypt`.
 */
export function encrypt(plaintext: Buffer): Buffer {
  const key = resolveKey();
  const nonce = randomBytes(NONCE_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  if (tag.length !== TAG_LEN) {
    // Should be unreachable — Node always emits a 16-byte tag for GCM.
    throw new Error(`unexpected GCM tag length: ${tag.length}`);
  }
  return Buffer.concat([nonce, ciphertext, tag]);
}

/**
 * Decrypt a blob produced by [`encrypt`] (or by the Rust engine using the
 * same key). Throws on truncation, wrong key, or tampered ciphertext.
 */
export function decrypt(blob: Buffer): Buffer {
  if (blob.length < NONCE_LEN + TAG_LEN) {
    throw new Error(
      `encrypted blob too short: ${blob.length} bytes (need >= ${NONCE_LEN + TAG_LEN})`,
    );
  }
  const key = resolveKey();
  const nonce = blob.subarray(0, NONCE_LEN);
  const tag = blob.subarray(blob.length - TAG_LEN);
  const ciphertext = blob.subarray(NONCE_LEN, blob.length - TAG_LEN);

  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (err) {
    throw new Error(
      `AES-256-GCM decryption failed (corrupt or wrong key): ${(err as Error).message}`,
    );
  }
}

/**
 * Reset the cached key. Test-only helper; lets `crypto.test.ts` swap
 * `process.env.AUTH_STATE_KEY` between cases without process restart.
 */
export function __resetKeyCacheForTests(): void {
  cachedKey = null;
}
