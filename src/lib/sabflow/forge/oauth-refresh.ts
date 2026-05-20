/**
 * Forge — OAuth 2.0 refresh-token helper.
 *
 * Reusable mintAccessToken utility for blocks that authenticate via OAuth2
 * refresh tokens (Google, Microsoft, Salesforce, …). Per RFC 6749 §6, calls
 * the provider's `tokenUrl` with `grant_type=refresh_token` and the
 * credential's client id/secret/refresh-token, then returns the minted
 * `access_token` string ready to drop into a `Bearer` Authorization header.
 *
 * The minted token is cached in a module-level Map keyed by the refresh
 * token, honouring the server's `expires_in` with a 60-second safety margin.
 * This is best-effort: warm fluid-compute invocations reuse the cache; cold
 * starts re-mint. There is intentionally no DB/Redis persistence — the token
 * is short-lived and easy to re-mint.
 *
 * Sensitive material (access tokens, refresh tokens, client secrets) is
 * never logged, even on failure. Error messages quote the provider's error
 * payload but redact bearer/refresh tokens.
 */

const DEFAULT_CLIENT_ID_FIELD = 'clientId';
const DEFAULT_CLIENT_SECRET_FIELD = 'clientSecret';
const DEFAULT_REFRESH_TOKEN_FIELD = 'refreshToken';

/** Safety margin (ms) deducted from the server-supplied `expires_in`. */
const EXPIRY_SAFETY_MARGIN_MS = 60_000;
/** Fallback TTL when the token endpoint doesn't return `expires_in`. */
const FALLBACK_TTL_SECONDS = 3600;

type CacheEntry = { token: string; expiresAt: number };

const tokenCache = new Map<string, CacheEntry>();

export type MintOAuthAccessTokenConfig = {
  /** OAuth2 token endpoint URL. */
  tokenUrl: string;
  /** Credential field that holds the OAuth client id. Default `'clientId'`. */
  clientIdField?: string;
  /** Credential field that holds the OAuth client secret. Default `'clientSecret'`. */
  clientSecretField?: string;
  /** Credential field that holds the refresh token. Default `'refreshToken'`. */
  refreshTokenField?: string;
};

/**
 * Mint (or return a cached) OAuth2 access token from a long-lived refresh
 * token. The returned string is the bare access token — callers should use
 * it as `Authorization: Bearer <token>` themselves (or drop it into a
 * credential override).
 */
export async function mintOAuthAccessToken(
  credential: Record<string, string>,
  config: MintOAuthAccessTokenConfig,
): Promise<string> {
  const clientIdField = config.clientIdField ?? DEFAULT_CLIENT_ID_FIELD;
  const clientSecretField = config.clientSecretField ?? DEFAULT_CLIENT_SECRET_FIELD;
  const refreshTokenField = config.refreshTokenField ?? DEFAULT_REFRESH_TOKEN_FIELD;

  const clientId = credential[clientIdField];
  const clientSecret = credential[clientSecretField];
  const refreshToken = credential[refreshTokenField];

  if (!clientId) {
    throw new Error(
      `mintOAuthAccessToken: credential missing field "${clientIdField}"`,
    );
  }
  if (!clientSecret) {
    throw new Error(
      `mintOAuthAccessToken: credential missing field "${clientSecretField}"`,
    );
  }
  if (!refreshToken) {
    throw new Error(
      `mintOAuthAccessToken: credential missing field "${refreshTokenField}"`,
    );
  }

  const cached = tokenCache.get(refreshToken);
  if (cached && cached.expiresAt > Date.now() + EXPIRY_SAFETY_MARGIN_MS) {
    return cached.token;
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  }).toString();

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    // Read the body for diagnostics but DO NOT include any token material.
    // Provider error payloads typically look like:
    //   { "error": "invalid_grant", "error_description": "…" }
    let errMsg = `HTTP ${res.status}`;
    try {
      const text = await res.text();
      // Strip any bearer/refresh tokens that may have echoed back (defensive).
      const safe = text.replace(/(access_token|refresh_token)"\s*:\s*"[^"]+"/g, '$1":"[REDACTED]"');
      if (safe) errMsg += `: ${safe}`;
    } catch {
      // ignore body read failures — status alone is enough
    }
    throw new Error(`mintOAuthAccessToken: token endpoint returned ${errMsg}`);
  }

  const raw: unknown = await res.json().catch(() => null);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('mintOAuthAccessToken: token endpoint returned non-JSON body');
  }
  const obj = raw as Record<string, unknown>;
  const accessToken = typeof obj.access_token === 'string' ? obj.access_token : '';
  if (!accessToken) {
    throw new Error('mintOAuthAccessToken: response missing access_token');
  }

  const expiresInRaw = obj.expires_in;
  const expiresInSeconds =
    typeof expiresInRaw === 'number' && Number.isFinite(expiresInRaw) && expiresInRaw > 0
      ? expiresInRaw
      : typeof expiresInRaw === 'string' && Number.isFinite(Number(expiresInRaw)) && Number(expiresInRaw) > 0
        ? Number(expiresInRaw)
        : FALLBACK_TTL_SECONDS;

  tokenCache.set(refreshToken, {
    token: accessToken,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  });

  return accessToken;
}

/** Test-only helper: drop everything from the cache. */
export function _clearOAuthTokenCacheForTests(): void {
  tokenCache.clear();
}
