'use client';

/**
 * Client-side fetch wrapper for the Rust-backed CRM lookup HTTP API.
 *
 * Mirrors the existing `lookupEntity` server action signature so the
 * `<EntityPicker>` and command palette can swap implementations behind
 * the `NEXT_PUBLIC_USE_RUST_LOOKUP` env flag without any other call-site
 * churn. Returns the same `LookupResult` envelope.
 *
 * Auth-token convention:
 * Server-side calls (see `src/lib/rust-client/fetcher.ts`) mint a fresh
 * HS256 Rust JWT per request from the Next.js session cookie via
 * `issueRustJwt`. Client components don't have access to the session
 * cookie value (it's httpOnly) and `RUST_JWT_SECRET` MUST never reach
 * the browser — so we cannot mint here. Instead, the browser asks the
 * Next.js BFF for a token via `/api/auth/rust-token`; the route reads
 * the session cookie, mints a 15-minute JWT, and returns it. We cache
 * the token in module-scope memory and refresh ~30s before expiry so
 * back-to-back lookups don't each make a round trip.
 */

import type {
  EntityKey,
  LookupParams,
  LookupResult,
} from '@/lib/lookup-registry';

const RUST_TOKEN_ENDPOINT = '/api/auth/rust-token';
/** Refresh the cached token this many ms before it actually expires. */
const REFRESH_LEEWAY_MS = 30_000;

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;
let inFlight: Promise<string | null> | null = null;

/**
 * Fetch a fresh Rust JWT from the Next.js BFF route. The route reads
 * the user's httpOnly session cookie, validates it, and mints a
 * 15-minute HS256 token via `issueRustJwt`.
 */
async function fetchRustToken(): Promise<string | null> {
  try {
    const res = await fetch(RUST_TOKEN_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string; expiresAt?: number };
    if (!data?.token) return null;
    cachedToken = {
      token: data.token,
      // Default to a conservative 14-minute window if the route omits
      // `expiresAt` — still well within the JWT's 15-minute TTL.
      expiresAt: data.expiresAt ?? Date.now() + 14 * 60 * 1000,
    };
    return cachedToken.token;
  } catch {
    return null;
  }
}

/**
 * Return a valid Rust JWT for the current browser session, fetching a
 * fresh one if the cache is empty or close to expiry. Concurrent
 * callers share a single in-flight refresh.
 */
async function getClientAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  if (
    cachedToken &&
    cachedToken.expiresAt - Date.now() > REFRESH_LEEWAY_MS
  ) {
    return cachedToken.token;
  }

  if (inFlight) return inFlight;

  inFlight = fetchRustToken().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * Drop the cached token. Call this on a 401 from the Rust side so the
 * next lookup re-authenticates.
 */
function clearCachedToken(): void {
  cachedToken = null;
}

function getRustApiBase(): string {
  // Falls back to same-origin so a deploy that proxies `/v1/*` through
  // Next.js (rather than exposing the Rust port directly) still works.
  return process.env.NEXT_PUBLIC_RUST_API_BASE ?? '';
}

/**
 * Build the query string for the lookup endpoint. Mirrors the param
 * set the TS server action accepts so the Rust handler can stay
 * shape-compatible with the registry.
 */
function buildQueryString(params: LookupParams): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.page !== undefined) sp.set('page', String(params.page));
  if (params.limit !== undefined) sp.set('limit', String(params.limit));
  if (params.ids && params.ids.length > 0) sp.set('ids', params.ids.join(','));
  if (params.scope) sp.set('scope', params.scope);
  if (params.filter) {
    // Filters are entity-specific JSON blobs — encode as a single
    // querystring value to keep the request URL-safe.
    try {
      sp.set('filter', JSON.stringify(params.filter));
    } catch {
      /* unserializable filter — skip rather than throw */
    }
  }
  const qs = sp.toString();
  return qs.length > 0 ? `?${qs}` : '';
}

/**
 * Empty result envelope — returned on auth failure / network error so
 * callers never have to branch on `null`/`undefined`.
 */
function emptyResult(params: LookupParams): LookupResult {
  return {
    items: [],
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    total: 0,
    hasMore: false,
  };
}

/**
 * Drop-in replacement for `lookupEntity(entity, params)` that talks to
 * the Rust `/v1/crm/lookup/{entity}` endpoint with a Bearer JWT.
 */
export async function rustLookupEntity(
  entity: EntityKey,
  params: LookupParams = {},
): Promise<LookupResult> {
  const token = await getClientAuthToken();
  if (!token) {
    // No token available — return empty rather than firing an
    // unauthenticated request that the Rust side will 401 anyway.
    return emptyResult(params);
  }

  const base = getRustApiBase();
  const url = `${base}/v1/crm/lookup/${encodeURIComponent(entity)}${buildQueryString(params)}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (res.status === 401) {
      // Token expired or revoked mid-flight — drop it so the next call
      // mints a fresh one. Returning empty is fine for the picker.
      clearCachedToken();
      return emptyResult(params);
    }

    if (!res.ok) {
      console.warn(`[rustLookupEntity] ${entity} HTTP ${res.status}`);
      return emptyResult(params);
    }

    const data = (await res.json()) as LookupResult;
    return data;
  } catch (err) {
    console.error(`[rustLookupEntity] ${entity} failed:`, err);
    return emptyResult(params);
  }
}

/**
 * POST `/v1/crm/lookup/{entity}/recent/{itemId}` so the Rust backend
 * can populate its server-side LRU of recently-picked items. Fire-and
 * forget — picker UX never blocks on this.
 *
 * Only runs when the Rust lookup is enabled; the TS server action has
 * its own (planned) Redis-backed recents path documented in the action
 * file.
 */
export async function recordPickedRecent(
  entity: EntityKey,
  itemId: string,
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (process.env.NEXT_PUBLIC_USE_RUST_LOOKUP !== 'true') return;
  if (!entity || !itemId) return;

  const token = await getClientAuthToken();
  if (!token) return;

  const base = getRustApiBase();
  const url = `${base}/v1/crm/lookup/${encodeURIComponent(entity)}/recent/${encodeURIComponent(itemId)}`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
      // Best-effort — don't await body parsing.
      keepalive: true,
    });
  } catch {
    /* non-fatal — recents are an optimization, not a correctness path */
  }
}
