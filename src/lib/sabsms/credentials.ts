import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * SabSMS provider-credential cipher — v1.
 *
 * Wire format (shared contract with the Rust engine in
 * `services/sabsms-engine/` — do NOT change without bumping the version):
 *
 *   credentialsCipher = "v1." + base64(nonce) + "." + base64(ciphertext || authTag)
 *
 *   - Standard base64 WITH padding, dot separators, literal "v1" prefix.
 *   - AES-256-GCM. Key = `SABSMS_CREDS_KEY` env, exactly 64 hex chars
 *     (32 bytes). Nonce = 12 random bytes.
 *   - The 16-byte GCM auth tag is APPENDED to the ciphertext (the Rust
 *     `aes-gcm` crate convention).
 *   - AAD = the account's `workspaceId` as UTF-8 — binds the blob to its
 *     workspace so ciphers can't be copied between tenants.
 *   - Plaintext = provider-specific JSON
 *     (twilio: {"accountSid","authToken"}).
 *
 * Pure functions — no DB, no logging of secrets.
 */

const VERSION = 'v1';
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const KEY_HEX_RE = /^[0-9a-fA-F]{64}$/;

function resolveKey(keyHex?: string): Buffer {
  const hex = keyHex ?? process.env.SABSMS_CREDS_KEY;
  if (!hex) {
    throw new Error(
      'SabSMS credentials cipher: SABSMS_CREDS_KEY is not set (expected 64 hex chars).',
    );
  }
  if (!KEY_HEX_RE.test(hex)) {
    throw new Error(
      'SabSMS credentials cipher: SABSMS_CREDS_KEY is malformed — expected exactly 64 hex characters (32 bytes).',
    );
  }
  return Buffer.from(hex, 'hex');
}

/** Strict base64 decode — rejects strings Node would silently truncate. */
function b64decodeStrict(s: string, label: string): Buffer {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length % 4 !== 0) {
    throw new Error(`SabSMS credentials cipher: ${label} is not valid base64.`);
  }
  return Buffer.from(s, 'base64');
}

/**
 * Encrypt a provider credential blob for a workspace.
 * Returns the `v1.<nonceB64>.<ctB64>` cipher string.
 */
export function encryptProviderCreds(
  workspaceId: string,
  blob: Record<string, unknown>,
  keyHex?: string,
): string {
  if (!workspaceId) {
    throw new Error('SabSMS credentials cipher: workspaceId is required (used as AAD).');
  }
  if (!blob || typeof blob !== 'object' || Array.isArray(blob)) {
    throw new Error('SabSMS credentials cipher: blob must be a plain object.');
  }
  const key = resolveKey(keyHex);
  const nonce = randomBytes(NONCE_BYTES);

  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(workspaceId, 'utf8'));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(blob), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag(); // 16 bytes

  const ct = Buffer.concat([ciphertext, tag]); // tag APPENDED (aes-gcm crate convention)
  return `${VERSION}.${nonce.toString('base64')}.${ct.toString('base64')}`;
}

/**
 * Decrypt a `v1.<nonceB64>.<ctB64>` cipher string for a workspace.
 * Throws on bad format, wrong key, wrong workspaceId (AAD mismatch) or
 * tampered ciphertext.
 */
export function decryptProviderCreds(
  workspaceId: string,
  cipherText: string,
  keyHex?: string,
): Record<string, unknown> {
  if (!workspaceId) {
    throw new Error('SabSMS credentials cipher: workspaceId is required (used as AAD).');
  }
  if (typeof cipherText !== 'string') {
    throw new Error('SabSMS credentials cipher: cipher must be a string.');
  }
  const parts = cipherText.split('.');
  if (parts.length !== 3) {
    throw new Error(
      'SabSMS credentials cipher: bad format — expected "v1.<nonceB64>.<ctB64>".',
    );
  }
  const [version, nonceB64, ctB64] = parts;
  if (version !== VERSION) {
    throw new Error(
      `SabSMS credentials cipher: unsupported version "${version}" (expected "${VERSION}").`,
    );
  }

  const key = resolveKey(keyHex);
  const nonce = b64decodeStrict(nonceB64, 'nonce');
  if (nonce.length !== NONCE_BYTES) {
    throw new Error(
      `SabSMS credentials cipher: nonce must be ${NONCE_BYTES} bytes, got ${nonce.length}.`,
    );
  }
  const ct = b64decodeStrict(ctB64, 'ciphertext');
  if (ct.length < TAG_BYTES) {
    throw new Error('SabSMS credentials cipher: ciphertext too short to contain auth tag.');
  }

  const ciphertext = ct.subarray(0, ct.length - TAG_BYTES);
  const tag = ct.subarray(ct.length - TAG_BYTES);

  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(Buffer.from(workspaceId, 'utf8'));
  decipher.setAuthTag(tag);

  let plaintext: string;
  try {
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    throw new Error(
      'SabSMS credentials cipher: authentication failed — wrong key, wrong workspaceId, or tampered ciphertext.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new Error('SabSMS credentials cipher: decrypted payload is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('SabSMS credentials cipher: decrypted payload is not a JSON object.');
  }
  return parsed as Record<string, unknown>;
}
