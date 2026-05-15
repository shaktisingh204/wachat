/**
 * SabWa engine HTTP client.
 *
 * Thin wrapper around `fetch()` for talking to the Rust SabWa engine
 * (the long-lived Baileys session-pool worker) over HTTP.
 *
 * The engine lives at `services/sabwa-engine` in this monorepo. The
 * Next.js process never holds a Baileys socket itself — every action
 * proxies through this client.
 *
 * Configuration:
 *   - `SABWA_ENGINE_URL`   — base URL (default `http://localhost:4001`)
 *   - `SABWA_ENGINE_TOKEN` — service-to-service auth token, sent in the
 *                            `X-Sabwa-Service-Token` header.
 */

const DEFAULT_ENGINE_URL = 'http://localhost:4001';

/** Resolve the engine base URL at call time so env overrides are honoured. */
function getEngineBaseUrl(): string {
  return (process.env.SABWA_ENGINE_URL ?? DEFAULT_ENGINE_URL).replace(/\/+$/, '');
}

/** Resolve the engine service token at call time. */
function getEngineToken(): string {
  return process.env.SABWA_ENGINE_TOKEN ?? '';
}

/** Typed error thrown for any non-2xx response from the SabWa engine. */
export class SabwaEngineError extends Error {
  public readonly status: number;
  public readonly path: string;
  public readonly body: unknown;

  constructor(message: string, status: number, path: string, body: unknown) {
    super(message);
    this.name = 'SabwaEngineError';
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

export interface EngineFetchInit extends Omit<RequestInit, 'body' | 'headers'> {
  /** JSON body — will be `JSON.stringify`ed and `Content-Type` set. */
  json?: unknown;
  /** Raw body — pass-through to underlying fetch. */
  body?: BodyInit;
  /** Extra headers merged on top of the defaults. */
  headers?: Record<string, string>;
  /** Per-request timeout in ms (default 15s). */
  timeoutMs?: number;
  /**
   * When true, a 404 response resolves to `null` instead of throwing.
   * Use this on list endpoints that may not yet be implemented in the
   * Rust engine — callers can fall back to an empty result.
   */
  treatNotFoundAsEmpty?: boolean;
}

/**
 * Module-level set tracking 404 paths we've already warned about, so a
 * not-yet-implemented endpoint doesn't spam the logs on every refresh poll.
 */
const warned404Paths = new Set<string>();

/** Strip the query string so polling with different cursors only warns once. */
function pathKey(path: string): string {
  const q = path.indexOf('?');
  return q === -1 ? path : path.slice(0, q);
}

/**
 * Perform an authenticated request against the SabWa engine and return
 * the parsed JSON response typed as `T`.
 *
 * Throws `SabwaEngineError` on any non-2xx response, except when
 * `treatNotFoundAsEmpty` is `true` and the engine returns 404 — in that
 * case the call resolves to `null` (logged as a one-shot `console.warn`).
 */
export async function engineFetch<T = unknown>(
  path: string,
  init: EngineFetchInit & { treatNotFoundAsEmpty: true },
): Promise<T | null>;
export async function engineFetch<T = unknown>(
  path: string,
  init?: EngineFetchInit,
): Promise<T>;
export async function engineFetch<T = unknown>(
  path: string,
  init: EngineFetchInit = {},
): Promise<T | null> {
  const baseUrl = getEngineBaseUrl();
  const token = getEngineToken();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Sabwa-Service-Token': token,
    ...(init.headers ?? {}),
  };

  let body: BodyInit | undefined = init.body;
  if (init.json !== undefined) {
    body = JSON.stringify(init.json);
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  const controller = new AbortController();
  const timeoutMs = init.timeoutMs ?? 15_000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      body,
      signal: init.signal ?? controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new SabwaEngineError(
        `SabWa engine request timed out after ${timeoutMs}ms`,
        0,
        path,
        null,
      );
    }
    throw new SabwaEngineError(
      err instanceof Error ? err.message : 'SabWa engine fetch failed',
      0,
      path,
      null,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload: unknown = isJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    // Soft-handle 404 for endpoints that may not be wired up yet.
    if (res.status === 404 && init.treatNotFoundAsEmpty) {
      const key = pathKey(path);
      if (!warned404Paths.has(key)) {
        warned404Paths.add(key);
        console.warn(
          `[sabwa.engine] 404 ${key} — treating as empty (endpoint not implemented?)`,
        );
      }
      return null;
    }
    let message = `SabWa engine ${res.status} ${res.statusText}`;
    if (
      isJson &&
      payload &&
      typeof payload === 'object' &&
      'error' in (payload as Record<string, unknown>) &&
      typeof (payload as { error: unknown }).error === 'string'
    ) {
      message = (payload as { error: string }).error;
    }
    throw new SabwaEngineError(message, res.status, path, payload);
  }

  return payload as T;
}
