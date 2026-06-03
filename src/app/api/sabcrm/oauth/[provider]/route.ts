import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';

/**
 * SabCRM connected-account OAuth — initiation (Twenty-style mail + calendar link).
 *
 * GET /api/sabcrm/oauth/<provider>
 *   provider ∈ google | microsoft | imap
 *
 * Mirrors Twenty's "connected account" connect flow: the accounts settings page
 * (`/sabcrm/settings/accounts`) kicks a user here, and we hand back a real
 * provider authorization URL so the browser can complete the consent dance.
 *
 * HONEST behaviour: if the provider's OAuth credentials aren't present in the
 * environment we do NOT fabricate a redirect. We return a plain JSON object that
 * says so (HTTP 200, `{ ok: false, error }`) so the caller can surface a truthful
 * "not configured" state instead of bouncing the user to a broken consent screen.
 *
 *   - google     → needs GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET
 *   - microsoft  → needs MS_OAUTH_CLIENT_ID + MS_OAUTH_CLIENT_SECRET
 *   - imap       → never has an OAuth dance; manual IMAP isn't wired yet, so we
 *                  always return the honest "not wired" message.
 *
 * The matching token exchange + persistence lives in `./callback/route.ts`.
 */

type Provider = 'google' | 'microsoft' | 'imap';

const SUPPORTED: ReadonlySet<string> = new Set(['google', 'microsoft', 'imap']);

// Scopes: read-only mail + read-only calendar, plus the email/profile claims we
// need to label the connected account. Kept minimal on purpose.
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
];

const MICROSOFT_SCOPES = [
  'openid',
  'email',
  'profile',
  'offline_access',
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/Calendars.Read',
];

function isProvider(value: string): value is Provider {
  return SUPPORTED.has(value);
}

/** Absolute callback URL for this provider, derived from the incoming request. */
function callbackUrl(req: NextRequest, provider: Provider): string {
  const explicit = process.env.SABCRM_OAUTH_REDIRECT_BASE;
  const origin = explicit ? explicit.replace(/\/$/, '') : req.nextUrl.origin;
  return `${origin}/api/sabcrm/oauth/${provider}/callback`;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider: rawProvider } = await context.params;

  if (!isProvider(rawProvider)) {
    return NextResponse.json(
      { ok: false, error: `Unknown provider "${rawProvider}".` },
      { status: 200 },
    );
  }
  const provider: Provider = rawProvider;

  // IMAP has no OAuth handshake. Be honest: the manual IMAP flow isn't built.
  if (provider === 'imap') {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Manual IMAP is not wired yet — IMAP needs host/credentials capture and the sync engine, neither of which is connected.',
      },
      { status: 200 },
    );
  }

  // CSRF/state token. Stored in a short-lived httpOnly cookie so the callback
  // can verify the round-trip. We also stash an optional projectId passthrough.
  const projectId = req.nextUrl.searchParams.get('projectId') ?? '';
  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = callbackUrl(req, provider);

  if (provider === 'google') {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { ok: false, error: 'google OAuth is not configured' },
        { status: 200 },
      );
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('include_granted_scopes', 'true');
    authUrl.searchParams.set('state', state);

    return withStateCookie(NextResponse.redirect(authUrl), state, projectId);
  }

  // provider === 'microsoft'
  const clientId = process.env.MS_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MS_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { ok: false, error: 'microsoft OAuth is not configured' },
      { status: 200 },
    );
  }

  const tenant = process.env.MS_OAUTH_TENANT || 'common';
  const authUrl = new URL(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
  );
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('scope', MICROSOFT_SCOPES.join(' '));
  authUrl.searchParams.set('state', state);

  return withStateCookie(NextResponse.redirect(authUrl), state, projectId);
}

/** Attach the CSRF state (and optional projectId) as short-lived httpOnly cookies. */
function withStateCookie(
  res: NextResponse,
  state: string,
  projectId: string,
): NextResponse {
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/sabcrm/oauth',
    maxAge: 600, // 10 minutes — long enough for consent, short enough to be safe.
  };
  res.cookies.set('sabcrm_oauth_state', state, cookieOpts);
  if (projectId) {
    res.cookies.set('sabcrm_oauth_project', projectId, cookieOpts);
  }
  return res;
}
