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
    const tokens = await provider.exchangeCode({ code, config });
    await persistOAuthCredential({
      userId: stateEntry.userId,
      providerId: stateEntry.providerId,
      credentialId: stateEntry.credentialId,
      label: stateEntry.label,
      scopes: stateEntry.scopes ?? provider.defaultScopes,
      tokens,
    });
    console.log(
      `[SABFLOW OAUTH CALLBACK] success provider=${stateEntry.providerId} user=${stateEntry.userId}`,
    );
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
  tokens: OAuthTokens;
}): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection('sabflow_credentials');

  // Map provider id → CredentialType slug.  Google OAuth credentials are
  // categorised as "google_sheets" by default since that's the most-likely
  // first use case; users can rebind via the credential editor.
  const credentialType: CredentialType =
    opts.providerId === 'google' ? 'google_sheets' : ('oauth_generic' as CredentialType);

  const tokenBag: Record<string, string> = {
    oauthProvider: opts.providerId,
    accessToken: opts.tokens.accessToken,
    refreshToken: opts.tokens.refreshToken ?? '',
    expiresAt: opts.tokens.expiresAt ?? '',
    scope: opts.tokens.scope ?? opts.scopes.join(' '),
    tokenType: opts.tokens.tokenType ?? 'Bearer',
    idToken: opts.tokens.idToken ?? '',
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
    return;
  }

  await col.insertOne({
    _id: new ObjectId(),
    workspaceId: opts.userId,
    type: credentialType,
    name: opts.label || `${opts.providerId} OAuth`,
    data: tokenBag,
    createdAt: now,
    updatedAt: now,
  });
}
