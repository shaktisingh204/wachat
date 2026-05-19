/**
 * SabFlow OAuth — provider callback.
 *
 *   GET /api/sabflow/oauth/callback?code=...&state=...
 *
 * Consumes the one-time state nonce, exchanges the code for tokens, and
 * either creates a new credential or updates an existing one with the
 * tokens stashed in `credential.data`.  Redirects the user back to
 * `returnTo` on success or to the credentials page with an `oauth_error`
 * query param on failure.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { consumeOAuthState } from '@/lib/sabflow/oauth/stateStore';
import { getOAuthProvider } from '@/lib/sabflow/oauth/providers';
import type { OAuthTokens } from '@/lib/sabflow/oauth/types';
import type { CredentialType } from '@/lib/sabflow/credentials/types';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  console.log('[SABFLOW OAUTH CALLBACK] request received');
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errParam = url.searchParams.get('error');

  if (errParam) {
    console.warn(`[SABFLOW OAUTH CALLBACK] provider returned error=${errParam}`);
    return redirectWithError(errParam);
  }
  if (!code || !state) {
    return redirectWithError('missing_code_or_state');
  }

  const stateEntry = consumeOAuthState(state);
  if (!stateEntry) {
    return redirectWithError('invalid_or_expired_state');
  }

  const provider = getOAuthProvider(stateEntry.providerId);
  if (!provider) {
    return redirectWithError(`unknown_provider:${stateEntry.providerId}`);
  }

  const config = resolveProviderConfig(stateEntry.providerId);
  if (!config) {
    return redirectWithError(`provider_not_configured:${stateEntry.providerId}`);
  }

  try {
    const tokens = await provider.exchangeCode({
      code,
      config,
      codeVerifier: stateEntry.codeVerifier,
      subdomain: stateEntry.subdomain,
    });
    const persisted = await persistOAuthCredential({
      userId: stateEntry.userId,
      providerId: stateEntry.providerId,
      credentialId: stateEntry.credentialId,
      label: stateEntry.label,
      scopes: stateEntry.scopes ?? provider.defaultScopes,
      subdomain: stateEntry.subdomain,
      credentialType: stateEntry.credentialType,
      tokens,
    });
    console.log(
      `[SABFLOW OAUTH CALLBACK] success provider=${stateEntry.providerId} user=${stateEntry.userId}`,
    );
    void recordFlowAction('credential.oauth.granted', {
      userId: stateEntry.userId,
      target: persisted.credentialId,
      metadata: {
        provider: stateEntry.providerId,
        scopes: stateEntry.scopes ?? provider.defaultScopes,
        created: persisted.created,
      },
      request: req,
    });
    const returnTo =
      stateEntry.returnTo && stateEntry.returnTo.startsWith('/')
        ? stateEntry.returnTo
        : '/dashboard/sabflow/connections';
    return NextResponse.redirect(new URL(returnTo, url));
  } catch (err) {
    console.error('[SABFLOW OAUTH CALLBACK] exchange error:', err);
    const msg = err instanceof Error ? err.message : 'exchange_failed';
    return redirectWithError(encodeURIComponent(msg));
  }
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function redirectWithError(reason: string): NextResponse {
  return NextResponse.redirect(
    new URL(
      `/dashboard/sabflow/connections?oauth_error=${encodeURIComponent(reason)}`,
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    ),
  );
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

async function persistOAuthCredential(opts: {
  userId: string;
  providerId: string;
  credentialId?: string;
  label?: string;
  scopes: string[];
  subdomain?: string;
  credentialType?: string;
  tokens: OAuthTokens;
}): Promise<{ credentialId: string; created: boolean }> {
  const { db } = await connectToDatabase();
  const col = db.collection('sabflow_credentials');

  // Map provider id → CredentialType slug.  If the dialog passed an explicit
  // credentialType (the user picked one in the picker) honour it; otherwise
  // fall back to the per-provider default.
  const credentialType: CredentialType =
    (opts.credentialType as CredentialType | undefined) ??
    (opts.providerId === 'google' ? 'google_sheets' : ('oauth_generic' as CredentialType));

  const tokenBag: Record<string, string> = {
    oauthProvider: opts.providerId,
    accessToken: opts.tokens.accessToken,
    refreshToken: opts.tokens.refreshToken ?? '',
    expiresAt: opts.tokens.expiresAt ?? '',
    scope: opts.tokens.scope ?? opts.scopes.join(' '),
    tokenType: opts.tokens.tokenType ?? 'Bearer',
    idToken: opts.tokens.idToken ?? '',
    subdomain: opts.subdomain ?? '',
  };

  const now = new Date();
  if (opts.credentialId && ObjectId.isValid(opts.credentialId)) {
    await col.updateOne(
      { _id: new ObjectId(opts.credentialId), workspaceId: opts.userId },
      {
        $set: {
          data: tokenBag,
          updatedAt: now,
        },
      },
    );
    return { credentialId: opts.credentialId, created: false };
  }

  const newId = new ObjectId();
  await col.insertOne({
    _id: newId,
    workspaceId: opts.userId,
    type: credentialType,
    name: opts.label || `${opts.providerId} OAuth`,
    data: tokenBag,
    createdAt: now,
    updatedAt: now,
  });
  return { credentialId: newId.toHexString(), created: true };
}
