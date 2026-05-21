/**
 * QuickBooks Online — OAuth helpers.
 *
 * Implements the bits we need without the official SDK:
 *   - Build the authorize URL
 *   - Exchange `code` → tokens
 *   - Refresh `access_token` using `refresh_token`
 *   - Cached `getValidAccessToken(userId)` that auto-refreshes when the
 *     in-DB access token is within 5 minutes of expiry.
 *
 * Credentials at rest:
 *   - `client_secret` is encrypted with `encryptData()` from
 *     `@/lib/sabflow/credentials/encryption` (AES-256-GCM)
 *   - Tokens themselves are stored in plaintext for now (matches existing
 *     CRM integration storage patterns) — TODO: encrypt at rest.
 */
import 'server-only';

import { ObjectId } from 'mongodb';
import { headers } from 'next/headers';
import {
  decryptData,
  encryptData,
} from '@/lib/sabflow/credentials/encryption';
import { appendSyncLog, getSettings, upsertSettings } from './db';
import type { QuickBooksEnvironment, QuickBooksSettingDoc } from './types';

/* ── Constants ──────────────────────────────────────────────────────────── */

const OAUTH_AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2';
const OAUTH_TOKEN_URL =
  'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

/** Default scope for accounting (customers + invoices + items). */
export const QUICKBOOKS_SCOPE = 'com.intuit.quickbooks.accounting';

/** Refresh access token if it expires within this window (ms). */
const REFRESH_WINDOW_MS = 5 * 60 * 1000;

/* ── Helpers ────────────────────────────────────────────────────────────── */

export function getApiBase(environment: QuickBooksEnvironment): string {
  return environment === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';
}

/**
 * Resolve the public-facing redirect URI. Order:
 *   1. `QUICKBOOKS_REDIRECT_URI` env var (recommended)
 *   2. `NEXT_PUBLIC_APP_URL` + `/api/integrations/quickbooks/callback`
 *   3. Request-time `Host`/`X-Forwarded-Proto` headers (last resort)
 */
export async function resolveRedirectUri(): Promise<string> {
  const explicit = process.env.QUICKBOOKS_REDIRECT_URI;
  if (explicit && explicit.length > 0) return explicit;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && appUrl.length > 0) {
    return `${appUrl.replace(/\/$/, '')}/api/integrations/quickbooks/callback`;
  }

  try {
    const h = await headers();
    const proto = h.get('x-forwarded-proto') ?? 'https';
    const host = h.get('host');
    if (host) {
      return `${proto}://${host}/api/integrations/quickbooks/callback`;
    }
  } catch {
    // headers() throws outside a request context — ignore.
  }
  return 'http://localhost:3000/api/integrations/quickbooks/callback';
}

export function decryptClientSecret(setting: QuickBooksSettingDoc): string {
  if (!setting.client_secret_enc) return '';
  try {
    return decryptData(setting.client_secret_enc);
  } catch (err) {
    console.error(
      '[quickbooks/auth] failed to decrypt client_secret:',
      err instanceof Error ? err.message : err,
    );
    return '';
  }
}

export function encryptClientSecret(plain: string): string {
  return encryptData(plain);
}

/**
 * Construct the Intuit authorize URL. The caller must persist `state` in a
 * short-lived cookie so the callback can verify it.
 */
export function buildAuthorizeUrl(args: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}): string {
  const params = new URLSearchParams({
    client_id: args.clientId,
    response_type: 'code',
    scope: args.scope ?? QUICKBOOKS_SCOPE,
    redirect_uri: args.redirectUri,
    state: args.state,
  });
  return `${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  /** seconds until access_token expiry, typically 3600. */
  expires_in: number;
  /** seconds until refresh_token expiry, typically 100 days (8640000). */
  x_refresh_token_expires_in: number;
  token_type: string;
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const raw = `${clientId}:${clientSecret}`;
  return `Basic ${Buffer.from(raw, 'utf8').toString('base64')}`;
}

async function postToTokenEndpoint(
  body: URLSearchParams,
  clientId: string,
  clientSecret: string,
): Promise<TokenResponse> {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: basicAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `QuickBooks token endpoint ${res.status}: ${text.slice(0, 300)}`,
    );
  }
  const json = (await res.json()) as TokenResponse;
  return json;
}

/**
 * Exchange an authorization `code` for a token bundle.
 */
export async function exchangeCodeForTokens(args: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: args.code,
    redirect_uri: args.redirectUri,
  });
  return postToTokenEndpoint(body, args.clientId, args.clientSecret);
}

/**
 * Refresh an `access_token` using the stored `refresh_token`.
 */
export async function refreshAccessToken(args: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: args.refreshToken,
  });
  return postToTokenEndpoint(body, args.clientId, args.clientSecret);
}

/**
 * Mark the tenant's connection as revoked. Called when a refresh fails
 * with a permanent error (e.g. the user revoked access in QBO).
 */
export async function markConnectionRevoked(
  userId: ObjectId,
  reason: string,
): Promise<void> {
  await upsertSettings(userId, {
    connected: false,
    access_token: undefined,
    refresh_token: undefined,
    expires_at: undefined,
    refresh_token_expires_at: undefined,
  });
  await appendSyncLog(userId, {
    action: 'refresh',
    entity: 'token',
    status: 'failure',
    error: reason.slice(0, 500),
  });
}

/**
 * Return a valid `access_token` for the tenant, refreshing it if needed.
 * Returns `null` when:
 *   - the tenant has no settings doc, or
 *   - the tenant isn't connected, or
 *   - the refresh attempt failed (in which case `connected` is set to false).
 */
export async function getValidAccessToken(
  userId: string | ObjectId,
): Promise<string | null> {
  const uid = typeof userId === 'string' ? new ObjectId(userId) : userId;
  const setting = await getSettings(uid);
  if (!setting || !setting.connected) return null;
  if (!setting.access_token || !setting.refresh_token) return null;

  const now = Date.now();
  const expiresAt = setting.expires_at ?? 0;

  // Still valid for at least the refresh window — return as-is.
  if (expiresAt - now > REFRESH_WINDOW_MS) {
    return setting.access_token;
  }

  // Need to refresh. Make sure the refresh token itself hasn't expired.
  if (
    setting.refresh_token_expires_at &&
    setting.refresh_token_expires_at <= now
  ) {
    await markConnectionRevoked(uid, 'refresh_token expired');
    return null;
  }

  const clientSecret = decryptClientSecret(setting);
  if (!setting.client_id || !clientSecret) {
    await markConnectionRevoked(uid, 'missing client credentials');
    return null;
  }

  try {
    const tokens = await refreshAccessToken({
      refreshToken: setting.refresh_token,
      clientId: setting.client_id,
      clientSecret,
    });
    const nowMs = Date.now();
    await upsertSettings(uid, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: nowMs + tokens.expires_in * 1000,
      refresh_token_expires_at:
        nowMs + tokens.x_refresh_token_expires_in * 1000,
    });
    await appendSyncLog(uid, {
      action: 'refresh',
      entity: 'token',
      status: 'success',
    });
    return tokens.access_token;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[quickbooks/auth] refresh failed:', msg);
    await markConnectionRevoked(uid, msg);
    return null;
  }
}
