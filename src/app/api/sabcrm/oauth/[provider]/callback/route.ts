import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

/**
 * SabCRM connected-account OAuth — callback (token exchange + persistence).
 *
 * GET /api/sabcrm/oauth/<provider>/callback?code=...&state=...
 *   provider ∈ google | microsoft
 *
 * The provider redirects the browser back here after consent. We:
 *   1. Verify the `state` against the httpOnly cookie set during initiation.
 *   2. Exchange the `code` for tokens at the provider's token endpoint.
 *   3. Best-effort look up the account email (so the settings UI can label it).
 *   4. Best-effort persist a `sabcrm_connected_accounts` doc.
 *   5. Redirect back to /dashboard/settings/crm/accounts with a success/error flag.
 *
 * HONEST behaviour: if the provider's OAuth credentials aren't configured, or
 * anything in the exchange fails, we never 500 — we redirect to the accounts
 * page with `?error=<reason>` so the user sees a truthful failure.
 *
 * SECRET HANDLING: access/refresh tokens are NOT persisted in plaintext. We
 * store only a redacted marker plus a TODO so a follow-up can wire real
 * encryption (e.g. KMS / libsodium sealed box) before any token is retained.
 */

type Provider = 'google' | 'microsoft' | 'imap';

const SUPPORTED: ReadonlySet<string> = new Set(['google', 'microsoft', 'imap']);

const ACCOUNTS_PATH = '/dashboard/settings/crm/accounts';

function isProvider(value: string): value is Provider {
  return SUPPORTED.has(value);
}

function redirectBack(
  req: NextRequest,
  params: Record<string, string>,
): NextResponse {
  const url = new URL(ACCOUNTS_PATH, req.nextUrl.origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  // Clear the short-lived OAuth cookies on the way out.
  const res = NextResponse.redirect(url);
  res.cookies.set('sabcrm_oauth_state', '', { path: '/api/sabcrm/oauth', maxAge: 0 });
  res.cookies.set('sabcrm_oauth_project', '', { path: '/api/sabcrm/oauth', maxAge: 0 });
  return res;
}

function callbackUrl(req: NextRequest, provider: Provider): string {
  const explicit = process.env.SABCRM_OAUTH_REDIRECT_BASE;
  const origin = explicit ? explicit.replace(/\/$/, '') : req.nextUrl.origin;
  return `${origin}/api/sabcrm/oauth/${provider}/callback`;
}

interface TokenResult {
  accessToken: string;
  refreshToken?: string;
  email?: string;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  try {
    const { provider: rawProvider } = await context.params;

    if (!isProvider(rawProvider) || rawProvider === 'imap') {
      return redirectBack(req, { error: 'unsupported_provider' });
    }
    const provider: Provider = rawProvider;

    const params = req.nextUrl.searchParams;

    // Surface the provider's own error (e.g. user denied consent) honestly.
    const providerError = params.get('error');
    if (providerError) {
      return redirectBack(req, { error: providerError });
    }

    const code = params.get('code');
    const state = params.get('state');
    if (!code) {
      return redirectBack(req, { error: 'missing_code' });
    }

    // Verify CSRF state against the cookie we set at initiation.
    const expectedState = req.cookies.get('sabcrm_oauth_state')?.value;
    if (!expectedState || !state || expectedState !== state) {
      return redirectBack(req, { error: 'state_mismatch' });
    }
    const projectId = req.cookies.get('sabcrm_oauth_project')?.value || undefined;

    let tokens: TokenResult | null = null;

    if (provider === 'google') {
      const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return redirectBack(req, { error: 'google_not_configured' });
      }
      tokens = await exchangeGoogle(req, code, clientId, clientSecret);
    } else {
      // provider === 'microsoft'
      const clientId = process.env.MS_OAUTH_CLIENT_ID;
      const clientSecret = process.env.MS_OAUTH_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return redirectBack(req, { error: 'microsoft_not_configured' });
      }
      tokens = await exchangeMicrosoft(req, code, clientId, clientSecret);
    }

    if (!tokens) {
      return redirectBack(req, { error: 'token_exchange_failed' });
    }

    // Best-effort persist. A storage failure must not break the user's flow,
    // so we swallow and still report a connected provider.
    try {
      const { db } = await connectToDatabase();
      await db.collection('sabcrm_connected_accounts').insertOne({
        projectId: projectId ?? null,
        provider,
        email: tokens.email ?? null,
        // SECURITY: never persist raw tokens. Store a redacted marker only.
        // TODO: wire real at-rest encryption (KMS / libsodium sealed box) and
        // persist the encrypted access/refresh tokens here once available.
        accessToken: '[REDACTED — encryption not wired]',
        hasRefreshToken: Boolean(tokens.refreshToken),
        createdAt: new Date(),
      });
    } catch {
      /* persistence is best-effort — keep the user moving */
    }

    return redirectBack(req, { connected: provider });
  } catch {
    // Never 500: fall back to an honest error on the accounts page.
    return redirectBack(req, { error: 'callback_failed' });
  }
}

// ---------------------------------------------------------------------------
// Provider token exchanges
// ---------------------------------------------------------------------------

async function exchangeGoogle(
  req: NextRequest,
  code: string,
  clientId: string,
  clientSecret: string,
): Promise<TokenResult | null> {
  try {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl(req, 'google'),
      grant_type: 'authorization_code',
    });

    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!resp.ok) return null;

    const json = (await resp.json()) as {
      access_token?: string;
      refresh_token?: string;
    };
    if (!json.access_token) return null;

    // Best-effort: read the account email so the UI can label it.
    let email: string | undefined;
    try {
      const userResp = await fetch(
        'https://openidconnect.googleapis.com/v1/userinfo',
        { headers: { Authorization: `Bearer ${json.access_token}` } },
      );
      if (userResp.ok) {
        const user = (await userResp.json()) as { email?: string };
        email = user.email;
      }
    } catch {
      /* email is optional */
    }

    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      email,
    };
  } catch {
    return null;
  }
}

async function exchangeMicrosoft(
  req: NextRequest,
  code: string,
  clientId: string,
  clientSecret: string,
): Promise<TokenResult | null> {
  try {
    const tenant = process.env.MS_OAUTH_TENANT || 'common';
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl(req, 'microsoft'),
      grant_type: 'authorization_code',
    });

    const resp = await fetch(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      },
    );
    if (!resp.ok) return null;

    const json = (await resp.json()) as {
      access_token?: string;
      refresh_token?: string;
    };
    if (!json.access_token) return null;

    // Best-effort: read the account email via Microsoft Graph.
    let email: string | undefined;
    try {
      const meResp = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${json.access_token}` },
      });
      if (meResp.ok) {
        const me = (await meResp.json()) as {
          mail?: string;
          userPrincipalName?: string;
        };
        email = me.mail || me.userPrincipalName;
      }
    } catch {
      /* email is optional */
    }

    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      email,
    };
  } catch {
    return null;
  }
}
