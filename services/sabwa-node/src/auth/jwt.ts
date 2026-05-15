/**
 * Short-lived HS256 stream tokens.
 *
 * These tokens authenticate browser-side WebSocket / SSE streams that the
 * Next.js app opens against sabwa-node. The Next.js app mints a token
 * server-side (after authorizing the user owns `projectId`/`sessionId`), then
 * hands the token to the browser. The browser includes it as a query string
 * or `Sec-WebSocket-Protocol` value when opening the stream; sabwa-node
 * verifies it before subscribing the client.
 *
 * Format: standard JWT (header.payload.sig) with the HS256 alg and the
 * secret from `process.env.SABWA_JWT_SECRET`. We implement sign/verify with
 * Node's built-in `crypto` instead of pulling in `jsonwebtoken` to keep the
 * dependency surface minimal — the format on the wire is identical.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface StreamTokenClaims {
  projectId: string;
  sessionId: string;
}

export interface SignStreamTokenInput extends StreamTokenClaims {
  /** Time-to-live in milliseconds. */
  ttlMs: number;
}

interface JwtPayload extends StreamTokenClaims {
  /** Issued-at (seconds since epoch). */
  iat: number;
  /** Expiry (seconds since epoch). */
  exp: number;
}

const HEADER_B64 = base64UrlEncode(
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
);

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(s: string): Buffer {
  // Re-pad to a multiple of 4 chars and translate URL-safe alphabet back.
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, 'base64');
}

function resolveSecret(): Buffer {
  const raw = process.env.SABWA_JWT_SECRET;
  if (!raw || raw.trim().length === 0) {
    throw new Error('SABWA_JWT_SECRET is required to sign / verify stream tokens');
  }
  return Buffer.from(raw, 'utf8');
}

/**
 * Sign a stream token. Returns the encoded `header.payload.sig` JWT string.
 *
 * `ttlMs` is clamped to a positive integer at second granularity (JWT `exp`
 * is in seconds). Callers should keep TTL short — minutes, not hours — since
 * possession of the token grants stream access.
 */
export function signStreamToken(input: SignStreamTokenInput): string {
  if (!input.projectId || !input.sessionId) {
    throw new Error('signStreamToken requires non-empty projectId and sessionId');
  }
  if (!Number.isFinite(input.ttlMs) || input.ttlMs <= 0) {
    throw new Error(`signStreamToken: ttlMs must be > 0 (got ${input.ttlMs})`);
  }

  const secret = resolveSecret();
  const nowSec = Math.floor(Date.now() / 1000);
  const ttlSec = Math.max(1, Math.floor(input.ttlMs / 1000));
  const payload: JwtPayload = {
    projectId: input.projectId,
    sessionId: input.sessionId,
    iat: nowSec,
    exp: nowSec + ttlSec,
  };

  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${HEADER_B64}.${payloadB64}`;
  const sig = createHmac('sha256', secret).update(signingInput).digest();
  const sigB64 = base64UrlEncode(sig);
  return `${signingInput}.${sigB64}`;
}

/**
 * Verify a stream token. Returns the decoded claims on success; throws on
 * any structural / signature / expiry failure.
 *
 * The signature comparison is constant-time. We also reject tokens whose
 * header `alg` is anything other than `HS256` to defeat the classic
 * `alg: none` downgrade attack.
 */
export function verifyStreamToken(jwt: string): StreamTokenClaims {
  if (typeof jwt !== 'string' || jwt.length === 0) {
    throw new Error('verifyStreamToken: token is empty');
  }
  const parts = jwt.split('.');
  if (parts.length !== 3) {
    throw new Error('verifyStreamToken: malformed JWT (expected 3 segments)');
  }
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  // Header check — must be HS256.
  let header: { alg?: unknown; typ?: unknown };
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString('utf8'));
  } catch {
    throw new Error('verifyStreamToken: header is not valid JSON');
  }
  if (header.alg !== 'HS256') {
    throw new Error(`verifyStreamToken: unsupported alg ${String(header.alg)}`);
  }

  // Recompute signature and constant-time compare.
  const secret = resolveSecret();
  const expectedSig = createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const providedSig = base64UrlDecode(sigB64);
  if (
    providedSig.length !== expectedSig.length ||
    !timingSafeEqual(providedSig, expectedSig)
  ) {
    throw new Error('verifyStreamToken: bad signature');
  }

  // Decode payload.
  let payload: Partial<JwtPayload>;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));
  } catch {
    throw new Error('verifyStreamToken: payload is not valid JSON');
  }

  const { projectId, sessionId, exp } = payload;
  if (typeof projectId !== 'string' || projectId.length === 0) {
    throw new Error('verifyStreamToken: missing projectId claim');
  }
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('verifyStreamToken: missing sessionId claim');
  }
  if (typeof exp !== 'number' || !Number.isFinite(exp)) {
    throw new Error('verifyStreamToken: missing exp claim');
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec >= exp) {
    throw new Error('verifyStreamToken: token expired');
  }

  return { projectId, sessionId };
}
