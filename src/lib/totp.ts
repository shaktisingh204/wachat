/**
 * RFC 6238 TOTP (HMAC-SHA1, 30s window, 6 digits) — pure Node `crypto`.
 *
 * No external deps. Used by the 2FA setup flow. Verification accepts
 * the current 30-second step ±1 (so a code generated up to ~30s before
 * or after still works), giving us clock-drift tolerance.
 */
import { createHmac, randomBytes } from 'node:crypto';

const STEP_SECONDS = 30;
const DIGITS = 6;

/* ---------- base32 (RFC 4648, no padding) ---------- */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function bytesToBase32(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < buf.length; i += 1) {
    value = (value << 8) | buf[i]!;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

function base32ToBytes(input: string): Buffer {
  const clean = input.replace(/=+$/g, '').toUpperCase().replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) {
      throw new Error(`Invalid base32 character: ${char}`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/* ---------- TOTP core ---------- */

function hotp(secret: Buffer, counter: number): string {
  // 8-byte big-endian counter
  const buf = Buffer.alloc(8);
  let c = counter;
  for (let i = 7; i >= 0; i -= 1) {
    buf[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const hmac = createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (code % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

/* ---------- Public API ---------- */

/**
 * Generate a fresh base32 TOTP secret (20 random bytes → 32 char base32).
 * Store this encrypted on the user document.
 */
export function generateSecret(): string {
  return bytesToBase32(randomBytes(20));
}

/**
 * Build the `otpauth://` URL that authenticator apps consume. Pass the
 * result to a QR-code renderer.
 */
export function generateOtpauthUrl(
  secret: string,
  accountName: string,
  issuer = 'SabNode',
): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

import * as QRCode from 'qrcode';

/**
 * Convenience: build a data URI QR URL pointing at the otpauth
 * payload using a secure backend-generated data URI.
 */
export async function generateQrUrl(secret: string, accountName: string): Promise<string> {
  const otpauth = generateOtpauthUrl(secret, accountName);
  try {
    return await QRCode.toDataURL(otpauth, { width: 200, margin: 2 });
  } catch (error) {
    console.error('Failed to generate QR code data URI', error);
    // fallback or throw
    throw new Error('Could not generate QR code');
  }
}

/**
 * Verify a 6-digit code against the secret. Accepts the current step
 * and ±1 step for clock drift (so within ~30 seconds either side).
 */
export function verifyTotpCode(secret: string, code: string): boolean {
  if (!code || !/^\d{6}$/.test(code)) return false;
  let bytes: Buffer;
  try {
    bytes = base32ToBytes(secret);
  } catch {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / STEP_SECONDS);
  for (const offset of [-1, 0, 1]) {
    if (hotp(bytes, counter + offset) === code) return true;
  }
  return false;
}

/**
 * Produce N cryptographically-random backup codes (10 chars,
 * uppercase alphanumeric, dashed in the middle for readability).
 * The caller hashes these before storing.
 */
export function generateBackupCodes(count = 8): string[] {
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // skip easily-confused chars
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const bytes = randomBytes(10);
    let s = '';
    for (let j = 0; j < 10; j += 1) {
      s += alpha[bytes[j]! % alpha.length];
    }
    out.push(`${s.slice(0, 5)}-${s.slice(5)}`);
  }
  return out;
}
