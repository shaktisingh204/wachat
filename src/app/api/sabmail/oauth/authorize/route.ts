/**
 * SabMail OAuth — start the Gmail/Outlook connect flow.
 *
 * GET /api/sabmail/oauth/authorize?provider=gmail|outlook[&returnTo=/sabmail/accounts]
 *
 * Resolves the active SabMail workspace (cookie) + the signed-in user, mints a
 * short-lived signed state, and 302s to the provider's consent screen. The
 * callback finishes the dance and stores the encrypted refresh token on a
 * `sabmail_accounts` doc. Degrades to a friendly redirect when OAuth isn't
 * configured for this provider yet.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getSession } from '@/app/actions/user.actions';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import {
  isSabmailOAuthProvider,
  resolveSabmailOAuthConfig,
  getSabmailOAuthProvider,
  getSabmailProviderSpec,
  mintSabmailOAuthState,
  safeReturnPath,
} from '@/lib/sabmail/oauth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function appBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function back(path: string, params: Record<string, string>): NextResponse {
  const safe = path.startsWith('/') && !path.startsWith('//') ? path : '/sabmail/accounts';
  const url = new URL(safe, appBase());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get('provider');
  const returnTo = safeReturnPath(req.nextUrl.searchParams.get('returnTo'));

  if (!isSabmailOAuthProvider(provider)) {
    return back('/sabmail/accounts', { error: 'bad-provider' });
  }

  try {
    const session = await getSession();
    if (!session?.user?._id) {
      // Bounce back into the connect flow after login (preserve provider + returnTo).
      const next = `/api/sabmail/oauth/authorize?provider=${provider}&returnTo=${encodeURIComponent(returnTo)}`;
      return back('/login', { next });
    }

    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return back('/sabmail/projects', {});

    const config = resolveSabmailOAuthConfig(provider);
    if (!config) return back(returnTo, { error: 'oauth-not-configured', provider });

    const oauthProvider = getSabmailOAuthProvider(provider);
    if (!oauthProvider) return back(returnTo, { error: 'oauth-provider-missing', provider });

    const state = await mintSabmailOAuthState({
      userId: String(session.user._id),
      workspaceId,
      provider,
      returnTo,
    });
    if (!state) return back(returnTo, { error: 'oauth-state-unavailable' });

    const built = oauthProvider.buildAuthorizeUrl({
      config,
      state,
      scopes: getSabmailProviderSpec(provider).scopes,
      // Force account choice on Outlook so a re-connect can pick a different
      // mailbox / recover a refresh token (Google already sets prompt=consent).
      extraParams: provider === 'outlook' ? { prompt: 'select_account' } : undefined,
    });
    const url = typeof built === 'string' ? built : built.url;
    return NextResponse.redirect(url);
  } catch {
    return back(returnTo, { error: 'oauth-start-failed', provider });
  }
}
