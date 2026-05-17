/**
 * AWS Signature Version 4 signer (pure TypeScript, no external SDK).
 *
 * Implements the SigV4 spec for HTTPS API requests:
 *   https://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html
 *
 * Why hand-rolled?  The only forge blocks that need SigV4 today are the two
 * Bedrock executors.  Pulling in `@aws-sdk/client-bedrock-runtime` would add
 * ~50 MB of transitive deps for two HTTP endpoints — this signer is < 4 KB.
 *
 * Scope:
 *   - POST/GET/etc. against `*.amazonaws.com` REST endpoints
 *   - Body signing with x-amz-content-sha256 (required for Bedrock invoke)
 *   - Optional STS session tokens (`x-amz-security-token`)
 *
 * Out of scope:
 *   - Streaming/chunked payload signing (`STREAMING-AWS4-HMAC-SHA256-PAYLOAD`)
 *   - Pre-signed query-string URLs (we sign request headers only)
 *
 * Self-test: this module exports `__signV4_selfTest()` which validates the
 * canonical request + string-to-sign + signing-key derivation against the
 * worked example from the SigV4 spec ("GET object" reference).  Imported
 * lazily so it never runs in production.
 */

import { createHash, createHmac } from 'node:crypto';

export type SigV4Input = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
  service: string;
  method: string;
  /** Absolute URL — host, path, and query are parsed from this. */
  url: string;
  /** Caller-supplied headers (case-insensitive). `host` is auto-added. */
  headers?: Record<string, string>;
  /** Raw request body bytes (string or Buffer). Empty string for GET/DELETE is fine. */
  body?: string | Buffer;
  /** Optional override for the signing time — used by the self-test. */
  signingDate?: Date;
};

export type SigV4Result = {
  /** Headers to send with the request (includes original headers + signature). */
  headers: Record<string, string>;
  /** The Authorization header value, in case the caller wants to log/redact it. */
  authorization: string;
};

const ALGO = 'AWS4-HMAC-SHA256';

/* ── Public API ─────────────────────────────────────────────────────────── */

export function signV4(input: SigV4Input): SigV4Result {
  const url = new URL(input.url);
  const method = input.method.toUpperCase();
  const bodyBuf = toBuffer(input.body);
  const payloadHash = sha256Hex(bodyBuf);

  const now = input.signingDate ?? new Date();
  const amzDate = isoBasic(now); // 20240517T120000Z
  const dateStamp = amzDate.slice(0, 8); // 20240517

  // Merge headers (case-preserving keys, but we lowercase for canonicalisation).
  const merged: Record<string, string> = { ...(input.headers ?? {}) };
  if (!hasHeader(merged, 'host')) merged.host = url.host;
  if (!hasHeader(merged, 'x-amz-date')) merged['x-amz-date'] = amzDate;
  if (!hasHeader(merged, 'x-amz-content-sha256')) merged['x-amz-content-sha256'] = payloadHash;
  if (input.sessionToken && !hasHeader(merged, 'x-amz-security-token')) {
    merged['x-amz-security-token'] = input.sessionToken;
  }

  // Canonical headers + signed header list.
  const lowerEntries = Object.entries(merged)
    .map(([k, v]) => [k.toLowerCase(), String(v).trim().replace(/\s+/g, ' ')])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const canonicalHeaders = lowerEntries.map(([k, v]) => `${k}:${v}\n`).join('');
  const signedHeaders = lowerEntries.map(([k]) => k).join(';');

  const canonicalUri = canonicalUriFromPath(url.pathname);
  const canonicalQuery = canonicalQueryFromSearchParams(url.searchParams);

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [
    ALGO,
    amzDate,
    credentialScope,
    sha256Hex(Buffer.from(canonicalRequest, 'utf8')),
  ].join('\n');

  const signingKey = deriveSigningKey(input.secretAccessKey, dateStamp, input.region, input.service);
  const signature = hmacHex(signingKey, stringToSign);

  const authorization =
    `${ALGO} Credential=${input.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    headers: { ...merged, Authorization: authorization },
    authorization,
  };
}

/* ── Canonical-request helpers ──────────────────────────────────────────── */

/**
 * AWS requires each path segment to be URI-encoded *once* (twice for S3 — not
 * relevant here; Bedrock is a "single-encode" service).  Reserved chars
 * `-_.~` and `/` are left alone; everything else is percent-encoded.
 */
function canonicalUriFromPath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname
    .split('/')
    .map((seg) => awsUriEncode(seg, false))
    .join('/');
}

/**
 * Canonical query: sorted by name (then value), each name/value AWS-encoded.
 */
function canonicalQueryFromSearchParams(params: URLSearchParams): string {
  const pairs: Array<[string, string]> = [];
  params.forEach((value, name) => {
    pairs.push([awsUriEncode(name, true), awsUriEncode(value, true)]);
  });
  pairs.sort(([a, av], [b, bv]) => (a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0));
  return pairs.map(([k, v]) => `${k}=${v}`).join('&');
}

/**
 * AWS URI encoding rules:
 *   - Unreserved chars  A-Z a-z 0-9 - _ . ~  are NOT encoded
 *   - The forward slash `/` is encoded in query/form values but NOT in path
 *     segments (handled by the caller — we never pass a `/` here when
 *     `encodeSlash` is false).
 *   - Space is encoded as `%20`, never `+`.
 *   - Everything else: uppercase hex `%XX`.
 */
function awsUriEncode(value: string, encodeSlash: boolean): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    const code = value.charCodeAt(i);
    const unreserved =
      (code >= 0x41 && code <= 0x5a) || // A-Z
      (code >= 0x61 && code <= 0x7a) || // a-z
      (code >= 0x30 && code <= 0x39) || // 0-9
      ch === '-' ||
      ch === '_' ||
      ch === '.' ||
      ch === '~';
    if (unreserved) {
      out += ch;
    } else if (ch === '/' && !encodeSlash) {
      out += '/';
    } else {
      // Use encodeURIComponent then uppercase hex digits.
      out += encodeURIComponent(ch).replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A');
    }
  }
  return out;
}

/* ── Signing-key derivation ─────────────────────────────────────────────── */

function deriveSigningKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmacBuf(`AWS4${secret}`, dateStamp);
  const kRegion = hmacBuf(kDate, region);
  const kService = hmacBuf(kRegion, service);
  return hmacBuf(kService, 'aws4_request');
}

/* ── Crypto primitives ──────────────────────────────────────────────────── */

function sha256Hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function hmacBuf(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function hmacHex(key: Buffer, data: string): string {
  return createHmac('sha256', key).update(data, 'utf8').digest('hex');
}

/* ── Utility helpers ────────────────────────────────────────────────────── */

function toBuffer(body: string | Buffer | undefined): Buffer {
  if (body === undefined || body === null) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  return Buffer.from(body, 'utf8');
}

function isoBasic(d: Date): string {
  // 20240517T120000Z — ISO8601 basic, UTC, no separators.
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
}

function hasHeader(map: Record<string, string>, name: string): boolean {
  const target = name.toLowerCase();
  for (const k of Object.keys(map)) {
    if (k.toLowerCase() === target) return true;
  }
  return false;
}

/* ── Self-test (run during dev, not in production) ──────────────────────── */

/**
 * Validates the signer against the worked example from the SigV4 spec
 * (Authentication Reference → "GET object" test vector).
 *
 *   Region:   us-east-1
 *   Service:  s3
 *   Access:   AKIAIOSFODNN7EXAMPLE
 *   Secret:   wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
 *   Date:     20130524T000000Z
 *   URL:      https://examplebucket.s3.amazonaws.com/test.txt
 *   Body:     "" (GET)
 *
 * Expected signature: f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41
 *
 * If anything in the canonical-request / string-to-sign / signing-key path
 * regresses, this function throws — call it from a Vitest spec or just at
 * boot in dev to verify.
 */
export function __signV4_selfTest(): { ok: true; signature: string } {
  const result = signV4({
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1',
    service: 's3',
    method: 'GET',
    url: 'https://examplebucket.s3.amazonaws.com/test.txt',
    headers: {
      Range: 'bytes=0-9',
    },
    body: '',
    signingDate: new Date('2013-05-24T00:00:00Z'),
  });
  const expected = 'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41';
  const match = result.authorization.match(/Signature=([0-9a-f]+)/);
  const signature = match ? match[1] : '';
  if (signature !== expected) {
    throw new Error(
      `SigV4 self-test failed.\n  expected: ${expected}\n  got:      ${signature}\n  auth:     ${result.authorization}`,
    );
  }
  return { ok: true, signature };
}
