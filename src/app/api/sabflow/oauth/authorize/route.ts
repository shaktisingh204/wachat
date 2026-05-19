/**
 * SabFlow OAuth — start the authorise dance.
 *
 *   GET /api/sabflow/oauth/authorize?provider=google&label=My+key&returnTo=/dashboard/sabflow/connections
 *
 * Redirects the user to the provider's authorise URL with a one-time state
 * nonce bound to their session.  The callback at `/oauth/callback` will
 * exchange the resulting code for tokens and persist them on a new (or
 * existing) credential.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { getOAuthProvider } from '@/lib/sabflow/oauth/providers';
import {
  mintOAuthState,
  updateOAuthState,
} from '@/lib/sabflow/oauth/stateStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  console.log('[SABFLOW OAUTH AUTHORIZE] request received');
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = (session.user as { _id: { toString(): string } })._id.toString();

    const url = new URL(req.url);
    const providerId = url.searchParams.get('provider') ?? '';
    const provider = getOAuthProvider(providerId);
    if (!provider) {
      return NextResponse.json(
        { error: `Unknown OAuth provider: ${providerId}` },
        { status: 400 },
      );
    }

    const config = resolveProviderConfig(providerId);
    if (!config) {
      return NextResponse.json(
        {
          error: `OAuth not configured for ${providerId}. Set the ${envVarsHint(providerId)} env vars.`,
        },
        { status: 500 },
      );
    }

    const scopesParam = url.searchParams.get('scopes');
    const scopes = scopesParam
      ? scopesParam.split(/[\s,]+/).filter(Boolean)
      : undefined;
    const label = url.searchParams.get('label') ?? undefined;
    const credentialId = url.searchParams.get('credentialId') ?? undefined;
    const returnTo = url.searchParams.get('returnTo') ?? undefined;
    const credentialType = url.searchParams.get('credentialType') ?? undefined;
    const subdomain = url.searchParams.get('subdomain')?.trim() || undefined;

    if (provider.requiresSubdomain && !subdomain) {
      return NextResponse.json(
        { error: `Provider "${providerId}" requires a workspace subdomain (?subdomain=...).` },
        { status: 400 },
      );
    }

    const state = mintOAuthState({
      userId,
      providerId,
      scopes,
      label,
      credentialId,
      returnTo,
      subdomain,
      credentialType,
    });

    const built = provider.buildAuthorizeUrl({
      config,
      state,
      scopes,
      subdomain,
    });
    const authorizeUrl = typeof built === 'string' ? built : built.url;
    if (typeof built !== 'string' && built.codeVerifier) {
      updateOAuthState(state, { codeVerifier: built.codeVerifier });
    }

    console.log(
      `[SABFLOW OAUTH AUTHORIZE] provider=${providerId} user=${userId} state=${state.slice(0, 8)}…`,
    );
    return NextResponse.redirect(authorizeUrl);
  } catch (err) {
    console.error('[SABFLOW OAUTH AUTHORIZE] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function resolveProviderConfig(providerId: string) {
  // Default callback is the URL of the callback route on the current host.
  // The user can override with PROVIDER_REDIRECT_URI if they want a vanity
  // URL or a separate domain.
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

function envVarsHint(providerId: string): string {
  const prefix = providerId.toUpperCase();
  return `${prefix}_OAUTH_CLIENT_ID, ${prefix}_OAUTH_CLIENT_SECRET, ${prefix}_OAUTH_REDIRECT_URI`;
}
