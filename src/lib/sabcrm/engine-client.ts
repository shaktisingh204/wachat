import 'server-only';

/**
 * SabCRM engine client — talks to the vendored Twenty engine
 * (`services/sabcrm/`, NestJS) over HTTP. All calls are server-side only.
 *
 * Mirrors `src/lib/sabwa/engine-client.ts`.
 */

import { getSabcrmEngineConfig } from './constants';

export interface EngineRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Extra headers merged into the request. */
  headers?: Record<string, string>;
  /** AbortSignal for timeouts/cancellation. */
  signal?: AbortSignal;
  /** Skip JSON parsing and return the raw Response. */
  raw?: boolean;
}

const DEFAULT_TIMEOUT_MS = 30_000;

function buildUrl(base: string, path: string): string {
  const trimmedBase = base.replace(/\/+$/, '');
  const trimmedPath = path.replace(/^\/+/, '');
  return `${trimmedBase}/${trimmedPath}`;
}

export async function engineFetch(
  path: string,
  options: EngineRequestOptions = {},
): Promise<unknown> {
  const { engineUrl, engineToken } = getSabcrmEngineConfig();
  const url = buildUrl(engineUrl, path);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (engineToken) {
    headers['Authorization'] = `Bearer ${engineToken}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal ?? controller.signal,
    });

    if (options.raw) {
      return response;
    }

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const message =
        (data && typeof data === 'object' && 'error' in data
          ? String((data as { error: unknown }).error)
          : null) ?? `SabCRM engine request failed (${response.status})`;
      throw new Error(message);
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Liveness check for the SabCRM engine. Twenty exposes `GET /healthz`.
 * Returns true when the engine answers 2xx within the timeout.
 */
export async function isSabcrmEngineUp(): Promise<boolean> {
  try {
    const res = (await engineFetch('healthz', { raw: true })) as Response;
    return res.ok;
  } catch {
    return false;
  }
}

/** Shape of a Twenty GraphQL response envelope. */
interface EngineGraphqlEnvelope<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

/**
 * Focused GraphQL helper for the Twenty engine's `/graphql` endpoint.
 *
 * Built on top of {@link engineFetch} so it inherits the same base URL,
 * `SABCRM_ENGINE_TOKEN` bearer auth, and timeout handling. Normalizes
 * GraphQL-level `errors` into a thrown `Error` (matching `engineFetch`'s
 * throw-on-failure contract). Used by the SSO handoff (see `./sso`).
 *
 * NOTE: extra request headers (`extraHeaders`) let callers pass a privileged
 * service header IF/WHEN the confirmed SSO mint requires one beyond the
 * default bearer token — see the engine-contract TODO in `./sso`.
 */
export async function engineGraphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const envelope = (await engineFetch('graphql', {
    method: 'POST',
    body: { query, variables },
    headers: extraHeaders,
  })) as EngineGraphqlEnvelope<T>;

  if (envelope.errors && envelope.errors.length > 0) {
    throw new Error(
      `SabCRM engine GraphQL error: ${envelope.errors
        .map((e) => e.message)
        .join('; ')}`,
    );
  }

  if (envelope.data === undefined) {
    throw new Error('SabCRM engine GraphQL returned no data');
  }

  return envelope.data;
}
