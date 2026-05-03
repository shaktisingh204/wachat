/**
 * Web Push helpers — pure Web Crypto (no native deps like `web-push`).
 *
 * - {@link createSubscription} normalises a browser PushSubscription JSON
 *   into our {@link PushNotificationToken} shape.
 * - {@link sendPush} signs a VAPID JWT using ECDSA P-256 and POSTs the
 *   payload to the push service. Payload encryption (aes128gcm) is left as
 *   a separate concern — most notifications are sent without payload, and
 *   payload encryption requires shared-secret negotiation per subscription
 *   that we handle in a worker.
 */

import type { PushNotificationToken } from './types';

/** Base64-url encode raw bytes. */
function b64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else {
    bytes = new Uint8Array(input);
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 =
    typeof btoa === 'function'
      ? btoa(bin)
      : Buffer.from(bytes).toString('base64');
  return b64.replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(input: string): Uint8Array {
  const pad = '='.repeat((4 - (input.length % 4)) % 4);
  const b64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin =
    typeof atob === 'function'
      ? atob(b64)
      : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function getSubtle(): SubtleCrypto {
  const g = globalThis as unknown as { crypto?: Crypto };
  if (!g.crypto || !g.crypto.subtle) {
    throw new Error('Web Crypto subtle is unavailable');
  }
  return g.crypto.subtle;
}

/** Browser-style PushSubscription object (matches `subscription.toJSON()`). */
export interface BrowserPushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

/**
 * Normalise a browser PushSubscription into our persisted shape.
 */
export function createSubscription(
  raw: BrowserPushSubscription,
  meta: { workspaceId: string; userId?: string | null; topics?: string[] },
): PushNotificationToken {
  if (!raw?.endpoint || !raw?.keys?.p256dh || !raw?.keys?.auth) {
    throw new Error('createSubscription: invalid PushSubscription');
  }
  return {
    endpoint: raw.endpoint,
    expirationTime: raw.expirationTime ?? null,
    keys: { p256dh: raw.keys.p256dh, auth: raw.keys.auth },
    workspaceId: meta.workspaceId,
    userId: meta.userId ?? null,
    topics: meta.topics ?? [],
    createdAt: new Date().toISOString(),
  };
}

/** VAPID key pair — public key is uncompressed P-256 (b64url, 65 bytes). */
export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  /** Subject — must be a `mailto:` or `https:` URL per RFC 8292. */
  subject: string;
}

interface JoseSignatureRaw {
  r: Uint8Array;
  s: Uint8Array;
}

function splitEcdsaSignature(sig: ArrayBuffer): JoseSignatureRaw {
  // Web Crypto already returns the JOSE/IEEE-P1363 r||s format (64 bytes for P-256).
  const bytes = new Uint8Array(sig);
  if (bytes.length !== 64) {
    throw new Error('Unexpected ECDSA signature length: ' + bytes.length);
  }
  return { r: bytes.slice(0, 32), s: bytes.slice(32) };
}

async function importVapidPrivateKey(
  privateKeyB64Url: string,
  publicKeyB64Url: string,
): Promise<CryptoKey> {
  const subtle = getSubtle();
  const d = b64url(b64urlDecode(privateKeyB64Url));
  const pub = b64urlDecode(publicKeyB64Url);
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error('VAPID public key must be 65-byte uncompressed P-256');
  }
  const x = b64url(pub.slice(1, 33));
  const y = b64url(pub.slice(33, 65));
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    d,
    x,
    y,
    ext: true,
  };
  return subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

/** Build a signed VAPID Authorization header value. */
async function buildVapidAuth(
  audience: string,
  keys: VapidKeys,
  expSeconds = 12 * 60 * 60,
): Promise<string> {
  const subtle = getSubtle();
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + expSeconds,
    sub: keys.subject,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(
    JSON.stringify(payload),
  )}`;
  const key = await importVapidPrivateKey(keys.privateKey, keys.publicKey);
  const sig = await subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );
  const { r, s } = splitEcdsaSignature(sig);
  const concat = new Uint8Array(64);
  concat.set(r, 0);
  concat.set(s, 32);
  const jwt = `${signingInput}.${b64url(concat)}`;
  return `vapid t=${jwt}, k=${keys.publicKey}`;
}

export interface SendPushOptions {
  vapid: VapidKeys;
  /** TTL in seconds (default 60). */
  ttl?: number;
  /** Urgency hint per RFC 8030. */
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
  /** Optional topic for replacing prior queued messages. */
  topic?: string;
  /** Custom fetch implementation (mainly for tests). */
  fetchImpl?: typeof fetch;
}

export interface SendPushResult {
  ok: boolean;
  status: number;
  statusText: string;
  /** Push service body (often empty). */
  body: string;
}

/**
 * Send a push notification to a single subscription.
 *
 * NOTE: this implementation transmits only headers + an optional plaintext
 * body; encrypted payloads (aes128gcm with the subscriber's keys) are
 * delegated to the worker because they require per-message ECDH which is
 * heavier than what most call-sites need.
 */
export async function sendPush(
  subscription: PushNotificationToken,
  payload: string | Uint8Array | null,
  options: SendPushOptions,
): Promise<SendPushResult> {
  if (!subscription?.endpoint) {
    throw new Error('sendPush: subscription.endpoint is required');
  }
  if (!options?.vapid) throw new Error('sendPush: vapid keys are required');

  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const auth = await buildVapidAuth(audience, options.vapid);
  const headers: Record<string, string> = {
    Authorization: auth,
    TTL: String(options.ttl ?? 60),
    'Content-Length': '0',
  };
  if (options.urgency) headers.Urgency = options.urgency;
  if (options.topic) headers.Topic = options.topic;

  let body: BodyInit | null = null;
  let bodyLen = 0;
  if (payload != null) {
    headers['Content-Type'] = 'application/octet-stream';
    headers['Content-Encoding'] = 'aes128gcm';
    const bytes =
      typeof payload === 'string'
        ? new TextEncoder().encode(payload)
        : payload;
    bodyLen = bytes.byteLength;
    // Copy into a fresh ArrayBuffer so the type widens cleanly to BlobPart.
    const ab = new ArrayBuffer(bodyLen);
    new Uint8Array(ab).set(bytes);
    body = new Blob([ab], { type: 'application/octet-stream' });
    headers['Content-Length'] = String(bodyLen);
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const res = await fetchImpl(subscription.endpoint, {
    method: 'POST',
    headers,
    body,
  });
  const respBody = await res.text().catch(() => '');
  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    body: respBody,
  };
}

/**
 * Generate a fresh VAPID keypair using Web Crypto.
 *
 * Returned keys are base64url-encoded as required by RFC 8292.
 */
export async function generateVapidKeys(
  subject: string,
): Promise<VapidKeys> {
  const subtle = getSubtle();
  const pair = await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const jwk = (await subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey;
  if (!jwk.d || !jwk.x || !jwk.y) {
    throw new Error('generateVapidKeys: missing JWK components');
  }
  const x = b64urlDecode(jwk.x);
  const y = b64urlDecode(jwk.y);
  const uncompressed = new Uint8Array(65);
  uncompressed[0] = 0x04;
  uncompressed.set(x, 1);
  uncompressed.set(y, 33);
  return {
    subject,
    publicKey: b64url(uncompressed),
    privateKey: jwk.d,
  };
}
