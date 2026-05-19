/**
 * Server-side OAuth refresh helper.
 *
 * Call `refreshIfExpired(credential)` before using an OAuth credential to
 * make an outbound request.  When the stored `expiresAt` is within 60s of
 * now (or already past) the refresh-token is used to mint a new access
 * token, persisted back to the credential document.
 *
 * No-op for non-OAuth credentials (those without `oauthProvider` in
 * `credential.data`).
 */

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getOAuthProvider } from './providers';
import type { OAuthTokens } from './types';

const EXPIRY_SAFETY_WINDOW_MS = 60_000;

type CredentialRecord = {
  _id: ObjectId;
  workspaceId?: string;
  data: Record<string, string>;
};

export async function refreshIfExpired(
  credentialId: string,
): Promise<{ accessToken: string; refreshed: boolean } | null> {
  if (!ObjectId.isValid(credentialId)) return null;

  const { db } = await connectToDatabase();
  const col = db.collection<CredentialRecord>('sabflow_credentials');
  const cred = await col.findOne({ _id: new ObjectId(credentialId) });
  if (!cred) return null;

  const data = cred.data ?? {};
  const providerId = data.oauthProvider;
  if (!providerId) {
    // Not an OAuth credential — fall back to whatever apiKey it has.
    const accessToken = data.accessToken ?? data.apiKey;
    return accessToken ? { accessToken, refreshed: false } : null;
  }

  const provider = getOAuthProvider(providerId);
  if (!provider) {
    // Unknown provider — return the stored access token verbatim.
    return data.accessToken
      ? { accessToken: data.accessToken, refreshed: false }
      : null;
  }

  // Within the safety window?  Skip the refresh.
  if (data.expiresAt) {
    const ms = Date.parse(data.expiresAt);
    if (!Number.isNaN(ms) && ms > Date.now() + EXPIRY_SAFETY_WINDOW_MS) {
      return { accessToken: data.accessToken, refreshed: false };
    }
  } else {
    // No expiry recorded — trust the stored access token.
    return data.accessToken
      ? { accessToken: data.accessToken, refreshed: false }
      : null;
  }

  if (!data.refreshToken) {
    // Expired and no refresh token — caller must re-authorise.
    throw new Error('OAuth access token expired and no refresh token available');
  }

  const config = resolveProviderConfig(providerId);
  if (!config) {
    throw new Error(`OAuth not configured for ${providerId}`);
  }

  const fresh: OAuthTokens = await provider.refreshAccessToken({
    refreshToken: data.refreshToken,
    config,
    subdomain: data.subdomain || undefined,
  });

  const patch: Record<string, string> = {
    accessToken: fresh.accessToken,
    refreshToken: fresh.refreshToken ?? data.refreshToken,
    expiresAt: fresh.expiresAt ?? '',
    scope: fresh.scope ?? data.scope ?? '',
    tokenType: fresh.tokenType ?? data.tokenType ?? 'Bearer',
  };
  await col.updateOne(
    { _id: cred._id },
    { $set: { data: { ...data, ...patch }, updatedAt: new Date() } },
  );

  return { accessToken: fresh.accessToken, refreshed: true };
}

function resolveProviderConfig(providerId: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const fallbackRedirect = base
    ? `${base.replace(/\/$/, '')}/api/sabflow/oauth/callback`
    : undefined;
  const prefix = providerId.toUpperCase();
  const clientId = process.env[`${prefix}_OAUTH_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_OAUTH_CLIENT_SECRET`];
  const redirectUri =
    process.env[`${prefix}_OAUTH_REDIRECT_URI`] ?? fallbackRedirect;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}
