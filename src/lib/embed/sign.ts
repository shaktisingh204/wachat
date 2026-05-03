/**
 * HMAC-SHA256 signing helpers for embed configs / tokens.
 *
 * Uses Web Crypto only so it runs on Edge, Node, and Workers without
 * a native dependency.
 */

import type { WidgetConfig } from './types';

/** Produce a stable JSON canonicalisation (deterministic key order). */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k]))
      .join(',') +
    '}'
  );
}

function getSubtle(): SubtleCrypto {
  const g = globalThis as unknown as { crypto?: Crypto };
  if (!g.crypto || !g.crypto.subtle) {
    throw new Error('Web Crypto subtle is unavailable in this runtime');
  }
  return g.crypto.subtle;
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

async function hmac(secret: string, message: string): Promise<string> {
  const subtle = getSubtle();
  const enc = new TextEncoder();
  const key = await subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await subtle.sign('HMAC', key, enc.encode(message));
  return toHex(sig);
}

/**
 * Sign a widget config (or any embed payload) with an HMAC-SHA256 secret.
 *
 * Returns a hex-encoded signature of the canonical JSON form so signatures
 * are stable across key-order differences.
 */
export async function signEmbed(
  config: WidgetConfig | Record<string, unknown>,
  secret: string,
): Promise<string> {
  if (!secret) throw new Error('signEmbed: secret is required');
  return hmac(secret, canonicalize(config));
}

/** Verify a signature produced by {@link signEmbed}. Constant-time compare. */
export async function verifyEmbedSignature(
  config: WidgetConfig | Record<string, unknown>,
  signature: string,
  secret: string,
): Promise<boolean> {
  const expected = await signEmbed(config, secret);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}
