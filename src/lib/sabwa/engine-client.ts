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
}

/**
 * Perform an authenticated request against the SabWa engine and return
 * the parsed JSON response typed as `T`.
 *
 * Throws `SabwaEngineError` on any non-2xx response.
 */
export async function engineFetch<T = unknown>(
  path: string,
  init: EngineFetchInit = {},
): Promise<T> {
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
