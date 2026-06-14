import 'server-only';

/**
 * SabMail OAuth glue for connecting Gmail / Outlook mailboxes.
 *
 * Reuses SabFlow's battle-tested OAuth providers (authorize-URL build + code
 * exchange + refresh) and stores only the resulting refresh token, encrypted,
 * on the `sabmail_accounts` doc — exactly the shape the Gmail/Graph provider
 * adapters already consume (`ctx.creds.refreshToken`).
 *
 * Everything is env-gated: when the per-provider client id/secret aren't set,
 * `resolveSabmailOAuthConfig` returns null and the connect routes surface a
 * friendly "not configured" message instead of failing — so the feature is
 * complete in code and lights up the moment the keys land in env.
 */

import { SignJWT, jwtVerify } from 'jose';

import { getOAuthProvider } from '@/lib/sabflow/oauth/providers';
import type { OAuthProviderConfig } from '@/lib/sabflow/oauth/types';

export type SabmailOAuthProvider = 'gmail' | 'outlook';

interface ProviderSpec {
  /** SabFlow OAuth provider id used for the actual token dance. */
  oauthId: 'google' | 'microsoft';
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
  redirectEnv: string;
}

const PROVIDERS: Record<SabmailOAuthProvider, ProviderSpec> = {
  gmail: {
    oauthId: 'google',
    // gmail.modify = read + labels + archive/trash; gmail.send = sending.
    scopes: [
      'openid',
      'email',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.send',
    ],
    clientIdEnv: 'SABMAIL_GMAIL_CLIENT_ID',
    clientSecretEnv: 'SABMAIL_GMAIL_CLIENT_SECRET',
    redirectEnv: 'SABMAIL_GMAIL_REDIRECT_URI',
  },
  outlook: {
    oauthId: 'microsoft',
    scopes: [
      'openid',
      'email',
      'offline_access',
      'User.Read',
      'Mail.ReadWrite',
      'Mail.Send',
    ],
    clientIdEnv: 'SABMAIL_MS_CLIENT_ID',
    clientSecretEnv: 'SABMAIL_MS_CLIENT_SECRET',
    redirectEnv: 'SABMAIL_MS_REDIRECT_URI',
  },
};

export function isSabmailOAuthProvider(v: unknown): v is SabmailOAuthProvider {
  return v === 'gmail' || v === 'outlook';
}

export function getSabmailProviderSpec(provider: SabmailOAuthProvider): ProviderSpec {
  return PROVIDERS[provider];
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

/** Resolve OAuth client config from env, or null when not yet configured. */
export function resolveSabmailOAuthConfig(
  provider: SabmailOAuthProvider,
): OAuthProviderConfig | null {
  const spec = PROVIDERS[provider];
  const clientId = process.env[spec.clientIdEnv];
  const clientSecret = process.env[spec.clientSecretEnv];
  if (!clientId || !clientSecret) return null;
  const redirectUri =
    process.env[spec.redirectEnv] || `${appUrl()}/api/sabmail/oauth/callback`;
  return { clientId, clientSecret, redirectUri };
}

export function getSabmailOAuthProvider(provider: SabmailOAuthProvider) {
  return getOAuthProvider(PROVIDERS[provider].oauthId);
}

/* ── Stateless signed state (multi-instance safe; no in-memory map) ──────── */

interface SabmailOAuthState {
  userId: string;
  workspaceId: string;
  provider: SabmailOAuthProvider;
  returnTo: string;
}

function stateSecret(): Uint8Array | null {
  const s = process.env.JWT_SECRET;
  return s ? new TextEncoder().encode(s) : null;
}

export async function mintSabmailOAuthState(payload: SabmailOAuthState): Promise<string | null> {
  const secret = stateSecret();
  if (!secret) return null;
  return new SignJWT({ ...payload, k: 'sabmail-oauth' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(secret);
}

export async function verifySabmailOAuthState(token: string): Promise<SabmailOAuthState | null> {
  const secret = stateSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.k !== 'sabmail-oauth') return null;
    if (!isSabmailOAuthProvider(payload.provider)) return null;
    if (typeof payload.userId !== 'string' || typeof payload.workspaceId !== 'string') return null;
    const returnTo = typeof payload.returnTo === 'string' ? payload.returnTo : '/sabmail/accounts';
    return {
      userId: payload.userId,
      workspaceId: payload.workspaceId,
      provider: payload.provider,
      returnTo,
    };
  } catch {
    return null;
  }
}

/** Look up the connected mailbox address using a freshly-minted access token. */
export async function fetchConnectedEmail(
  provider: SabmailOAuthProvider,
  accessToken: string,
): Promise<string | null> {
  try {
    if (provider === 'gmail') {
      const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { email?: string };
      return body.email?.toLowerCase() ?? null;
    }
    const res = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { mail?: string; userPrincipalName?: string };
    return (body.mail || body.userPrincipalName || '')?.toLowerCase() || null;
  } catch {
    return null;
  }
}
