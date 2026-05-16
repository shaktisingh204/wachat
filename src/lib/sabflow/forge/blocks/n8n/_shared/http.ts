/**
 * Shared HTTP helpers used by ported n8n forge blocks.
 *
 * Goals:
 *   - Consistent error shaping: every failed request throws an Error whose
 *     message includes service, method, path and a clipped response body.
 *   - JSON-by-default with safe parse, but pass-through for non-JSON.
 *   - No SDK dependencies — every call is a `fetch` so blocks stay
 *     edge/runtime-portable (we still target Node.js for the engine, but
 *     keeping the surface minimal means agents don't need to remember which
 *     adapter to import).
 */

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'HEAD';

export type ApiRequestInput = {
  /** Service tag for error messages, e.g. "Linear" or "MongoDB". */
  service: string;
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  /** When provided, JSON-stringified and a `Content-Type: application/json` header added. */
  json?: unknown;
  /** Raw body; ignored when `json` is also provided. */
  body?: string;
  /** Throw when the response is non-2xx (default true). */
  throwOnError?: boolean;
};

export type ApiRequestResult = {
  ok: boolean;
  status: number;
  /** Parsed JSON if the response was JSON, otherwise the raw text. */
  data: unknown;
  text: string;
  headers: Headers;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export async function apiRequest(input: ApiRequestInput): Promise<ApiRequestResult> {
  const { service, method, url, json, body } = input;
  const throwOnError = input.throwOnError ?? true;
  const headers: Record<string, string> = { ...(json !== undefined ? JSON_HEADERS : {}), ...(input.headers ?? {}) };

  const res = await fetch(url, {
    method,
    headers,
    body: json !== undefined ? JSON.stringify(json) : body,
  });

  const text = await res.text();
  const ct = res.headers.get('content-type') ?? '';
  const data: unknown = ct.includes('json') && text ? safeParse(text) : text;

  if (!res.ok && throwOnError) {
    const clip = text.length > 300 ? `${text.slice(0, 300)}…` : text;
    throw new Error(`${service} ${method} ${redactUrl(url)} failed (${res.status}): ${clip}`);
  }

  return { ok: res.ok, status: res.status, data, text, headers: res.headers };
}

function safeParse(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

/** Hide query-string secrets like `?token=…` from error logs. */
function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const key of ['token', 'access_token', 'apikey', 'api_key', 'key']) {
      if (u.searchParams.has(key)) u.searchParams.set(key, '***');
    }
    return u.toString();
  } catch {
    return url;
  }
}

/** Coerce unknown into a non-null string (treats null/undefined as ""). */
export const asString = (v: unknown): string =>
  typeof v === 'string' ? v : v == null ? '' : String(v);

/** Coerce unknown into a finite number or undefined. */
export const asNumber = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : Number(asString(v));
  return Number.isFinite(n) ? n : undefined;
};

/** Coerce unknown into a boolean. Strings "true"/"1"/"yes" count as true. */
export const asBoolean = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  const s = asString(v).toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
};

/** Require a credential to be present and return it; throw otherwise. */
export function requireCredential(
  service: string,
  credential: Record<string, string> | undefined,
): Record<string, string> {
  if (!credential || Object.keys(credential).length === 0) {
    throw new Error(`${service}: missing credential — select one from SabFlow Connections`);
  }
  return credential;
}
