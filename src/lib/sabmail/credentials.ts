import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * SabMail mailbox-credential cipher — v1.
 *
 * Identical wire format to the SabSMS provider cipher
 * (`src/lib/sabsms/credentials.ts`) so the future Rust SabMail engine can
 * share the implementation:
 *
 *   credentialsCipher = "v1." + base64(nonce) + "." + base64(ciphertext || authTag)
 *
 *   - AES-256-GCM. Key = `SABMAIL_CREDS_KEY` (falls back to
 *     `SABSMS_CREDS_KEY` so a single deployment secret can serve both
 *     messaging modules), exactly 64 hex chars (32 bytes). Nonce = 12 bytes.
 *   - 16-byte GCM auth tag APPENDED to the ciphertext.
 *   - AAD = the account's `workspaceId` (binds the blob to its tenant).
 *   - Plaintext = mailbox secrets JSON
 *     ({ imapUser, imapPass, smtpUser, smtpPass } or { refreshToken }).
 *
 * Pure functions — no DB, no logging of secrets.
 */

const VERSION = 'v1';
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const KEY_HEX_RE = /^[0-9a-fA-F]{64}$/;

function resolveKey(keyHex?: string): Buffer {
  const hex = keyHex ?? process.env.SABMAIL_CREDS_KEY ?? process.env.SABSMS_CREDS_KEY;
  if (!hex) {
    throw new Error(
      'SabMail credentials cipher: set SABMAIL_CREDS_KEY (64 hex chars / 32 bytes) to connect mailboxes.',
    );
  }
  if (!KEY_HEX_RE.test(hex)) {
    throw new Error(
      'SabMail credentials cipher: SABMAIL_CREDS_KEY is malformed — expected exactly 64 hex characters (32 bytes).',
    );
  }
  return Buffer.from(hex, 'hex');
}

/** Strict base64 decode — rejects strings Node would silently truncate. */
function b64decodeStrict(s: string, label: string): Buffer {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length % 4 !== 0) {
    throw new Error(`SabMail credentials cipher: ${label} is not valid base64.`);
  }
  return Buffer.from(s, 'base64');
}

/**
 * Encrypt a mailbox-credential blob for a workspace.
 * Returns the `v1.<nonceB64>.<ctB64>` cipher string.
 */
export function encryptMailboxCreds(
  workspaceId: string,
  blob: Record<string, unknown>,
  keyHex?: string,
): string {
  if (!workspaceId) {
    throw new Error('SabMail credentials cipher: workspaceId is required (used as AAD).');
  }
  if (!blob || typeof blob !== 'object' || Array.isArray(blob)) {
    throw new Error('SabMail credentials cipher: blob must be a plain object.');
  }
  const key = resolveKey(keyHex);
  const nonce = randomBytes(NONCE_BYTES);

  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(workspaceId, 'utf8'));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(blob), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const ct = Buffer.concat([ciphertext, tag]); // tag APPENDED
  return `${VERSION}.${nonce.toString('base64')}.${ct.toString('base64')}`;
}

/**
 * Decrypt a `v1.<nonceB64>.<ctB64>` cipher string for a workspace.
 * Throws on bad format, wrong key, wrong workspaceId (AAD mismatch) or
 * tampered ciphertext.
 */
export function decryptMailboxCreds(
  workspaceId: string,
  cipherText: string,
  keyHex?: string,
): Record<string, unknown> {
  if (!workspaceId) {
    throw new Error('SabMail credentials cipher: workspaceId is required (used as AAD).');
  }
  if (typeof cipherText !== 'string') {
    throw new Error('SabMail credentials cipher: cipher must be a string.');
  }
  const parts = cipherText.split('.');
  if (parts.length !== 3) {
    throw new Error('SabMail credentials cipher: bad format — expected "v1.<nonceB64>.<ctB64>".');
  }
  const [version, nonceB64, ctB64] = parts;
  if (version !== VERSION) {
    throw new Error(
      `SabMail credentials cipher: unsupported version "${version}" (expected "${VERSION}").`,
    );
  }

  const key = resolveKey(keyHex);
  const nonce = b64decodeStrict(nonceB64, 'nonce');
  if (nonce.length !== NONCE_BYTES) {
    throw new Error(
      `SabMail credentials cipher: nonce must be ${NONCE_BYTES} bytes, got ${nonce.length}.`,
    );
  }
  const ct = b64decodeStrict(ctB64, 'ciphertext');
  if (ct.length < TAG_BYTES) {
    throw new Error('SabMail credentials cipher: ciphertext too short to contain auth tag.');
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
      'SabMail credentials cipher: authentication failed — wrong key, wrong workspaceId, or tampered ciphertext.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new Error('SabMail credentials cipher: decrypted payload is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('SabMail credentials cipher: decrypted payload is not a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

/** True when a credentials key is configured (lets callers fail fast with a clear message). */
export function hasMailboxCredsKey(): boolean {
  const hex = process.env.SABMAIL_CREDS_KEY ?? process.env.SABSMS_CREDS_KEY;
  return !!hex && KEY_HEX_RE.test(hex);
}
