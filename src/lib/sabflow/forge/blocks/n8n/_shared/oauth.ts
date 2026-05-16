/**
 * Shared OAuth 2.0 refresh-token helper for ported n8n forge blocks.
 *
 * Generalises the per-call refresh pattern that `crm/zoho_crm.ts` ships:
 *   - POST form-urlencoded `grant_type=refresh_token` + `refresh_token`.
 *   - Optional `client_id` / `client_secret` (some providers require them,
 *     some authenticate via Basic, some skip them entirely — pass what you
 *     have).
 *   - Optional `extraFields` for provider-specific knobs (e.g. Salesforce
 *     wants the request against `/services/oauth2/token`, Box doesn't need
 *     extras, ServiceNow wants the scope echoed back, …).
 *
 * Includes a tiny in-memory cache scoped to this module. It naturally
 * disappears on serverless cold-starts — that's fine; the worst case is one
 * extra refresh per cold start. We key on `${service}:${refreshToken[:8]}`
 * so callers can keep multiple credentials in flight without colliding.
 */

import { apiRequest } from './http';

export type OAuthRefreshInput = {
  /** Service tag for error messages. */
  service: string;
  /** Token endpoint URL. */
  tokenUrl: string;
  /** Long-lived refresh token from the credential. */
  refreshToken: string;
  /** Client id (some providers require it on refresh). */
  clientId?: string;
  /** Client secret (some providers require it on refresh). */
  clientSecret?: string;
  /** Additional form fields (e.g. Salesforce wants `grant_type` already set; you set it). */
  extraFields?: Record<string, string>;
};

export type OAuthRefreshResult = {
  accessToken: string;
  expiresIn?: number;
  raw: Record<string, unknown>;
};

export async function refreshAccessToken(input: OAuthRefreshInput): Promise<OAuthRefreshResult> {
  const { service, tokenUrl, refreshToken, clientId, clientSecret, extraFields } = input;
  if (!refreshToken) throw new Error(`${service}: refreshToken is required to refresh access token`);

  const form: Record<string, string> = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  };
  if (clientId) form.client_id = clientId;
  if (clientSecret) form.client_secret = clientSecret;
  if (extraFields) {
    for (const [k, v] of Object.entries(extraFields)) {
      if (v !== undefined && v !== null) form[k] = v;
    }
  }

  const body = new URLSearchParams(form).toString();
  const res = await apiRequest({
    service,
    method: 'POST',
    url: tokenUrl,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const raw =
    res.data && typeof res.data === 'object' && !Array.isArray(res.data)
      ? (res.data as Record<string, unknown>)
      : {};
  const accessToken = typeof raw.access_token === 'string' ? (raw.access_token as string) : '';
  if (!accessToken) {
    const err = typeof raw.error === 'string' ? raw.error : 'no access_token in response';
    throw new Error(`${service}: token refresh failed — ${err}`);
  }
  const expiresInRaw = raw.expires_in;
  const expiresIn =
    typeof expiresInRaw === 'number'
      ? expiresInRaw
      : typeof expiresInRaw === 'string' && Number.isFinite(Number(expiresInRaw))
        ? Number(expiresInRaw)
        : undefined;

  return { accessToken, expiresIn, raw };
}

// ── In-memory token cache (per-process) ─────────────────────────────────────

type CacheEntry = { token: string; expiresAt: number };

const tokenCache = new Map<string, CacheEntry>();

/** Build a stable cache key from a service tag and the refresh token (prefix-truncated). */
export function cacheKeyFor(service: string, refreshToken: string): string {
  return `${service}:${refreshToken.slice(0, 8)}`;
}

/** Returns a cached access token if one is still valid (with a 30-second safety margin). */
export function getCachedToken(key: string): string | null {
  const entry = tokenCache.get(key);
  if (!entry) return null;
  if (Date.now() + 30_000 >= entry.expiresAt) {
    tokenCache.delete(key);
    return null;
  }
  return entry.token;
}

/** Store a token in the cache. `expiresInSeconds` defaults to 3000 (~50 min). */
export function setCachedToken(key: string, token: string, expiresInSeconds?: number): void {
  const ttl = typeof expiresInSeconds === 'number' && expiresInSeconds > 0 ? expiresInSeconds : 3000;
  tokenCache.set(key, { token, expiresAt: Date.now() + ttl * 1000 });
}

/** Test-only helper: drop everything from the cache. */
export function _clearTokenCacheForTests(): void {
  tokenCache.clear();
}
