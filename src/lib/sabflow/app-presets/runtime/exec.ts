/**
 * SabFlow — App preset execution helpers.
 *
 * Used by the `forge_app_preset` block to:
 *   1. Take an endpoint template + user inputs and produce a concrete URL +
 *      query / header / body buckets.
 *   2. Build auth headers (and query-string token) from a preset's auth shape
 *      and the chosen credential — including AWS Signature V4 signing
 *      (`signAwsRequest`) and credential-sourced base URLs
 *      (`resolvePresetBaseUrl`).
 *   3. Project a response payload through a minimal JSONPath (`$`, `$.foo`,
 *      `$.foo[0].bar`).
 *
 * Pure functions (no I/O) — but SigV4 needs `node:crypto`, so this module is
 * Node-runtime only (it is consumed exclusively by the server-side dispatcher
 * in `forge/blocks/generic/app_preset.ts`).
 */

import { createHash, createHmac } from 'node:crypto';

import type {
  AppPresetAuth,
  AppPresetEndpoint,
  AppPresetField,
  AppPresetFieldLocation,
} from '../types';

/* ── Field-location resolution ────────────────────────────────────────────── */

/**
 * Decide where a field lives in the HTTP request. Honors `field.in` first,
 * falls back to: path (when `{id}` appears), body (for write methods), query.
 */
export function resolveFieldLocation(
  field: AppPresetField,
  endpoint: Pick<AppPresetEndpoint, 'method' | 'path'>,
): AppPresetFieldLocation {
  if (field.in) return field.in;
  if (endpoint.path.includes(`{${field.id}}`)) return 'path';
  if (endpoint.method === 'POST' || endpoint.method === 'PATCH' || endpoint.method === 'PUT') {
    return 'body';
  }
  return 'query';
}

/* ── Input normalisation / validation ─────────────────────────────────────── */

/**
 * Parse string values supplied for `json`-typed fields into real values so
 * they land in the request body as objects/arrays instead of quoted strings.
 * Non-string values (already structured) and blank strings pass through
 * untouched. Throws naming the field on invalid JSON. Pure — returns a new
 * object only when something actually changed.
 */
export function coerceJsonInputs(
  fields: AppPresetField[],
  inputs: Record<string, unknown>,
): Record<string, unknown> {
  let out = inputs;
  for (const field of fields) {
    if (field.type !== 'json') continue;
    const raw = inputs[field.id];
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (out === inputs) out = { ...inputs };
      out[field.id] = parsed;
    } catch (err) {
      throw new Error(
        `field '${field.label}' is not valid JSON — ${(err as Error).message}`,
      );
    }
  }
  return out;
}

/**
 * Required fields with no usable value (after `defaultValue` fallback).
 * Empty string / null / undefined count as missing — mirrors the skip logic
 * in `resolvePath`, which would silently drop those values from the request.
 */
export function findMissingRequiredFields(
  fields: AppPresetField[],
  inputs: Record<string, unknown>,
): AppPresetField[] {
  const isEmpty = (v: unknown) => v === undefined || v === null || v === '';
  return fields.filter((field) => {
    if (!field.required) return false;
    const provided = Object.prototype.hasOwnProperty.call(inputs, field.id);
    const value = provided && !isEmpty(inputs[field.id]) ? inputs[field.id] : field.defaultValue;
    return isEmpty(value);
  });
}

/* ── Path / query / body resolution ──────────────────────────────────────── */

export type ResolvedRequest = {
  url: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: Record<string, unknown> | undefined;
};

function toQueryValue(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

/**
 * Substitute `{param}` placeholders from path-located fields, then bucket
 * remaining fields into query / body / headers honoring their `in` location.
 *
 * `auth` is consulted for `query_token` — its `queryParam` is reserved (we do
 * NOT collide with it). The caller is responsible for injecting the actual
 * credential value via `buildAuthHeaders` + downstream query merge.
 */
export function resolvePath(
  template: string,
  fields: AppPresetField[],
  inputs: Record<string, unknown>,
  endpoint: Pick<AppPresetEndpoint, 'method' | 'path'>,
  // `auth` is reserved for future use (e.g. body-form OAuth flows). Kept in
  // the signature so callers can pass it without churn when we extend.
  _auth?: AppPresetAuth,
): ResolvedRequest {
  let url = template;
  const query: Record<string, string> = {};
  const headers: Record<string, string> = {};
  const body: Record<string, unknown> = {};
  let hasBody = false;

  for (const field of fields) {
    const provided = Object.prototype.hasOwnProperty.call(inputs, field.id);
    const value = provided ? inputs[field.id] : field.defaultValue;
    if (value === undefined || value === null || value === '') continue;

    const loc = resolveFieldLocation(field, endpoint);
    if (loc === 'path') {
      const placeholder = `{${field.id}}`;
      const str = toQueryValue(value) ?? '';
      url = url.split(placeholder).join(encodeURIComponent(str));
      continue;
    }
    if (loc === 'query') {
      const str = toQueryValue(value);
      if (str !== undefined) query[field.id] = str;
      continue;
    }
    if (loc === 'header') {
      const str = toQueryValue(value);
      if (str !== undefined) headers[field.id] = str;
      continue;
    }
    if (loc === 'body') {
      body[field.id] = value;
      hasBody = true;
    }
  }

  return { url, query, headers, body: hasBody ? body : undefined };
}

/* ── Base URL resolution ─────────────────────────────────────────────────── */

/**
 * Resolve the effective base URL for a preset:
 *   1. A concrete `https?://` `preset.baseUrl` wins (templated hosts like
 *      `https://{subdomain}.zendesk.com` also pass through — their tokens are
 *      substituted by path-located fields in `resolvePath`).
 *   2. `aws_sigv4` presets with `auth.awsService` template the AWS host from
 *      the credential's `region` (default `us-east-1`).
 *   3. `auth.baseUrlFromCredential` reads the instance URL from the credential
 *      data (trailing slashes trimmed; must parse as an http(s) URL).
 *
 * Throws a clear, preset-labelled error when a required credential value is
 * missing or unusable.
 */
export function resolvePresetBaseUrl(
  preset: { name?: string; baseUrl: string; auth: AppPresetAuth },
  credential: Record<string, string> | undefined,
): string {
  const label = preset.name || 'App preset';
  const auth = preset.auth ?? { type: 'none' as const };
  const staticBase = (preset.baseUrl ?? '').trim();
  const hasStatic = /^https?:\/\//i.test(staticBase);
  if (hasStatic) return staticBase;

  if (auth.type === 'aws_sigv4' && auth.awsService) {
    const region = (credential?.region ?? '').trim() || 'us-east-1';
    return `https://${auth.awsService}.${region}.amazonaws.com`;
  }

  if (auth.baseUrlFromCredential) {
    const key = auth.baseUrlFromCredential;
    const raw = (credential?.[key] ?? '').trim();
    if (!raw) {
      throw new Error(
        `${label}: credential is missing '${key}' (instance URL) — set it on the connection`,
      );
    }
    const cleaned = raw.replace(/\/+$/, '');
    let parsed: URL;
    try {
      parsed = new URL(cleaned);
    } catch {
      throw new Error(`${label}: credential '${key}' is not a valid URL: '${raw}'`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`${label}: credential '${key}' must be an http(s) URL, got '${raw}'`);
    }
    return cleaned;
  }

  return staticBase;
}

/* ── AWS Signature V4 ────────────────────────────────────────────────────── */

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf-8').digest();
}

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf-8').digest('hex');
}

/** Strict RFC 3986 percent-encoding (AWS canonical form). */
function awsUriEncode(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export type AwsSignInput = {
  method: string;
  /** Fully-resolved request URL, query string included. */
  url: string;
  /** Exact request body string that will be sent (omit for body-less calls). */
  body?: string;
  /** AWS service signing name, e.g. `dynamodb`, `s3`, `comprehend`. */
  service: string;
  /** Credential data: accessKeyId + secretAccessKey + region (+ sessionToken). */
  credential: Record<string, string> | undefined;
  /** Label used in error messages (usually the preset name). */
  serviceLabel?: string;
};

/**
 * AWS Signature Version 4 (header-based), implemented from the spec with the
 * `node:crypto` HMAC chain — no SDK dependency.
 *
 * Signs `host`, `x-amz-date`, `x-amz-content-sha256` (always included — it is
 * mandatory for S3 and harmless elsewhere) and, when the credential carries a
 * `sessionToken`, `x-amz-security-token`. Returns the headers to merge into
 * the outgoing request (the `Host` header itself is set by fetch from the URL,
 * which matches the signed value).
 */
export function signAwsRequest(input: AwsSignInput): Record<string, string> {
  const label = input.serviceLabel ?? 'AWS preset';
  const cred = input.credential ?? {};
  const accessKeyId = (cred.accessKeyId ?? '').trim();
  const secretAccessKey = (cred.secretAccessKey ?? '').trim();
  const region = (cred.region ?? '').trim() || 'us-east-1';
  const sessionToken = (cred.sessionToken ?? '').trim();
  if (!input.service) {
    throw new Error(`${label}: preset auth is missing 'awsService' — cannot sign request`);
  }
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      `${label}: AWS credential needs accessKeyId + secretAccessKey — set them on the connection`,
    );
  }

  let url: URL;
  try {
    url = new URL(input.url);
  } catch {
    throw new Error(`${label}: cannot sign invalid URL '${input.url}'`);
  }

  // 20260101T000000Z / 20260101
  const amzDate = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = sha256Hex(input.body ?? '');

  // Canonical query string: keys+values strictly RFC3986-encoded, sorted.
  const params: Array<[string, string]> = [];
  url.searchParams.forEach((v, k) => params.push([awsUriEncode(k), awsUriEncode(v)]));
  params.sort(([ak, av], [bk, bv]) => (ak < bk ? -1 : ak > bk ? 1 : av < bv ? -1 : av > bv ? 1 : 0));
  const canonicalQuery = params.map(([k, v]) => `${k}=${v}`).join('&');

  // Canonical URI: the (already percent-encoded) request path.
  const canonicalUri = url.pathname || '/';

  const headersToSign: Array<[string, string]> = [
    ['host', url.host],
    ['x-amz-content-sha256', payloadHash],
    ['x-amz-date', amzDate],
  ];
  if (sessionToken) headersToSign.push(['x-amz-security-token', sessionToken]);
  headersToSign.sort(([a], [b]) => (a < b ? -1 : 1));
  const canonicalHeaders = headersToSign.map(([k, v]) => `${k}:${v}\n`).join('');
  const signedHeaders = headersToSign.map(([k]) => k).join(';');

  const canonicalRequest = [
    input.method.toUpperCase(),
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${region}/${input.service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');

  // HMAC chain: kSecret → kDate → kRegion → kService → kSigning
  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, input.service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf-8').digest('hex');

  const out: Record<string, string> = {
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
  if (sessionToken) out['x-amz-security-token'] = sessionToken;
  return out;
}

/* ── Auth ────────────────────────────────────────────────────────────────── */

function toBase64(s: string): string {
  // Browser / runtime portable. `Buffer` exists in Node + edge runtimes.
  if (typeof Buffer !== 'undefined') return Buffer.from(s, 'utf-8').toString('base64');
  if (typeof btoa !== 'undefined') return btoa(s);
  throw new Error('app-preset auth: no base64 implementation available');
}

/**
 * Build the auth headers dictated by `auth.type`.
 *
 * For `query_token`, returns `{}` — the dispatcher is expected to merge
 * `{ [auth.queryParam]: credential.apiKey }` into the query bucket separately
 * (use `buildAuthQuery`).
 *
 * For `oauth2`, if the credential already carries `accessToken`, we emit a
 * Bearer header directly. Refresh integration via `_shared/oauth.ts` is a
 * follow-up TODO — see `SABFLOW_1000_APPS_PLAN.md` §6.
 */
export function buildAuthHeaders(
  auth: AppPresetAuth,
  credential: Record<string, string> | undefined,
): Record<string, string> {
  const cred = credential ?? {};
  switch (auth.type) {
    case 'none':
      return {};
    case 'bearer': {
      const header = auth.header ?? 'Authorization';
      const scheme = auth.scheme ?? 'Bearer';
      const token = cred.apiKey || cred.token || cred.accessToken || '';
      if (!token) return {};
      return { [header]: `${scheme} ${token}` };
    }
    case 'basic': {
      const user = cred.username ?? '';
      const pass = cred.password ?? '';
      if (!user && !pass) return {};
      return { Authorization: `Basic ${toBase64(`${user}:${pass}`)}` };
    }
    case 'header': {
      const header = auth.header ?? 'X-API-Key';
      const token = cred.apiKey || cred.token || '';
      if (!token) return {};
      return { [header]: token };
    }
    case 'query_token':
      return {};
    case 'oauth2': {
      // TODO: integrate `_shared/oauth.ts` refresh flow once the credential
      // record carries `refreshToken` + token endpoint metadata.
      const token = cred.accessToken || cred.token || '';
      if (!token) return {};
      return { Authorization: `Bearer ${token}` };
    }
    case 'aws_sigv4':
      // SigV4 needs the full request (method/url/body), not just the
      // credential — the dispatcher calls `signAwsRequest` instead.
      return {};
    default:
      return {};
  }
}

/** Build the query-string tokens this auth shape wants to add (for `query_token`). */
export function buildAuthQuery(
  auth: AppPresetAuth,
  credential: Record<string, string> | undefined,
): Record<string, string> {
  if (auth.type !== 'query_token') return {};
  const param = auth.queryParam || 'api_key';
  const token = credential?.apiKey || credential?.token || '';
  if (!token) return {};
  return { [param]: token };
}

/* ── Output projection ──────────────────────────────────────────────────── */

/**
 * Minimal JSONPath. Supports:
 *   - `$`            → entire payload
 *   - `$.foo`        → field access
 *   - `$.foo.bar`    → nested access
 *   - `$.foo[0]`     → array index
 *   - `$.foo[0].bar` → combined
 *
 * Anything else logs a warning and returns the payload unchanged.
 */
export function projectOutput(data: unknown, path?: string): unknown {
  if (!path || path === '$' || path === '') return data;
  if (!path.startsWith('$')) {
    console.warn(`[app-presets] outputPath '${path}' must start with '$' — returning raw data`);
    return data;
  }
  let cursor: unknown = data;
  // Split on '.' and '[…]' segments.
  // Examples: `$.foo[0].bar` → ['foo', '[0]', 'bar']
  const rest = path.slice(1); // strip leading $
  const tokens = rest.match(/\.[^.[\]]+|\[\d+\]/g);
  if (!tokens) return data;
  for (const tok of tokens) {
    if (tok.startsWith('.')) {
      const key = tok.slice(1);
      if (cursor && typeof cursor === 'object') {
        cursor = (cursor as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    } else if (tok.startsWith('[')) {
      const idx = Number(tok.slice(1, -1));
      if (Array.isArray(cursor)) {
        cursor = cursor[idx];
      } else {
        return undefined;
      }
    }
  }
  return cursor;
}

/* ── URL helpers ─────────────────────────────────────────────────────────── */

export function appendQuery(url: string, query: Record<string, string>): string {
  const entries = Object.entries(query);
  if (entries.length === 0) return url;
  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`;
}
