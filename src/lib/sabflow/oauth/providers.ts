/**
 * Registered OAuth providers.
 *
 * Currently ships Google as the reference implementation.  Adding a new
 * provider is a five-method object plus an entry in `PROVIDERS`.
 */

import type { OAuthProvider, OAuthTokens } from './types';

const PROVIDERS = new Map<string, OAuthProvider>();

export function getOAuthProvider(id: string): OAuthProvider | undefined {
  return PROVIDERS.get(id);
}

export function listOAuthProviders(): OAuthProvider[] {
  return Array.from(PROVIDERS.values());
}

/* ── Google ─────────────────────────────────────────────────────────────── */

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';

const googleProvider: OAuthProvider = {
  id: 'google',
  label: 'Google',
  defaultScopes: [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],

  buildAuthorizeUrl({ config, state, scopes, extraParams }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      access_type: 'offline',      // ensures refresh_token comes back
      prompt: 'consent',           // forces consent so refresh_token is issued on re-auth
      include_granted_scopes: 'true',
      state,
      scope: (scopes ?? googleProvider.defaultScopes).join(' '),
      ...(extraParams ?? {}),
    });
    return `${GOOGLE_AUTH}?${params.toString()}`;
  },

  async exchangeCode({ code, config }) {
    return tokenRequest({
      url: GOOGLE_TOKEN,
      body: {
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      },
    });
  },

  async refreshAccessToken({ refreshToken, config }) {
    const tokens = await tokenRequest({
      url: GOOGLE_TOKEN,
      body: {
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'refresh_token',
      },
    });
    // Google does not re-issue the refresh_token unless it changes; preserve
    // the original when the response doesn't include one.
    if (!tokens.refreshToken) tokens.refreshToken = refreshToken;
    return tokens;
  },
};

PROVIDERS.set(googleProvider.id, googleProvider);

/* ── Slack ──────────────────────────────────────────────────────────────── */

const slackProvider: OAuthProvider = {
  id: 'slack',
  label: 'Slack',
  defaultScopes: ['chat:write', 'channels:read', 'users:read'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state,
      // Slack uses both `scope` (bot) and `user_scope` (user-token); we treat
      // the supplied scopes as bot scopes — most automations want that.
      scope: (scopes ?? slackProvider.defaultScopes).join(','),
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://slack.com/api/oauth.v2.access',
      body: {
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      },
    }),
  async refreshAccessToken({ refreshToken, config }) {
    // Slack rotating refresh tokens — token_rotation feature must be enabled
    // on the app for refresh to work.  Apps without it use long-lived tokens.
    return tokenRequest({
      url: 'https://slack.com/api/oauth.v2.access',
      body: {
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'refresh_token',
      },
    });
  },
};
PROVIDERS.set(slackProvider.id, slackProvider);

/* ── GitHub ─────────────────────────────────────────────────────────────── */

const githubProvider: OAuthProvider = {
  id: 'github',
  label: 'GitHub',
  defaultScopes: ['repo', 'read:user'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state,
      scope: (scopes ?? githubProvider.defaultScopes).join(' '),
      allow_signup: 'false',
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://github.com/login/oauth/access_token',
      body: {
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      },
      acceptJson: true,
    }),
  // GitHub OAuth Apps don't issue refresh tokens; GitHub Apps with
  // refresh-token rotation do.  When called for an OAuth App this errors out.
  async refreshAccessToken({ refreshToken, config }) {
    if (!refreshToken) {
      throw new Error('GitHub OAuth App tokens do not expire — no refresh needed.');
    }
    return tokenRequest({
      url: 'https://github.com/login/oauth/access_token',
      body: {
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'refresh_token',
      },
      acceptJson: true,
    });
  },
};
PROVIDERS.set(githubProvider.id, githubProvider);

/* ── Microsoft Graph ────────────────────────────────────────────────────── */

const microsoftProvider: OAuthProvider = {
  id: 'microsoft',
  label: 'Microsoft (Graph)',
  defaultScopes: [
    'offline_access',
    'User.Read',
    'Mail.ReadWrite',
    'Mail.Send',
    'Calendars.ReadWrite',
  ],
  buildAuthorizeUrl({ config, state, scopes }) {
    const tenant = process.env.MICROSOFT_OAUTH_TENANT ?? 'common';
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      response_mode: 'query',
      scope: (scopes ?? microsoftProvider.defaultScopes).join(' '),
      state,
    });
    return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize?${params.toString()}`;
  },
  exchangeCode({ code, config }) {
    const tenant = process.env.MICROSOFT_OAUTH_TENANT ?? 'common';
    return tokenRequest({
      url: `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
      body: {
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      },
    });
  },
  refreshAccessToken({ refreshToken, config }) {
    const tenant = process.env.MICROSOFT_OAUTH_TENANT ?? 'common';
    return tokenRequest({
      url: `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
      body: {
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'refresh_token',
      },
    });
  },
};
PROVIDERS.set(microsoftProvider.id, microsoftProvider);

/* ── Notion ─────────────────────────────────────────────────────────────── */

const notionProvider: OAuthProvider = {
  id: 'notion',
  label: 'Notion',
  defaultScopes: [], // Notion uses workspace-level approval, not scope strings.
  buildAuthorizeUrl({ config, state }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      owner: 'user',
      state,
    });
    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
  },
  async exchangeCode({ code, config }) {
    const basic = Buffer.from(
      `${config.clientId}:${config.clientSecret}`,
    ).toString('base64');
    const res = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Notion token request ${res.status}: ${text.slice(0, 400)}`);
    }
    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      bot_id?: string;
      workspace_id?: string;
      workspace_name?: string;
      token_type?: string;
    };
    if (!json.access_token) {
      throw new Error('Notion token response missing access_token');
    }
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt:
        typeof json.expires_in === 'number'
          ? new Date(Date.now() + json.expires_in * 1000).toISOString()
          : undefined,
      tokenType: json.token_type,
    };
  },
  async refreshAccessToken() {
    // Notion OAuth tokens currently don't expire and there's no refresh
    // endpoint.  Surface a clear error so callers know to re-authorise.
    throw new Error(
      'Notion access tokens do not expire — re-authorise the integration to rotate.',
    );
  },
};
PROVIDERS.set(notionProvider.id, notionProvider);

/* ── Linear ─────────────────────────────────────────────────────────────── */

const linearProvider: OAuthProvider = {
  id: 'linear',
  label: 'Linear',
  defaultScopes: ['read', 'write'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: (scopes ?? linearProvider.defaultScopes).join(' '),
      state,
      prompt: 'consent',
    });
    return `https://linear.app/oauth/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://api.linear.app/oauth/token',
      body: {
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      },
    }),
  async refreshAccessToken() {
    // Linear OAuth tokens are long-lived; rotation is via re-authorise.
    throw new Error(
      'Linear access tokens are long-lived — re-authorise to rotate.',
    );
  },
};
PROVIDERS.set(linearProvider.id, linearProvider);

/* ── Shared token-endpoint helper ───────────────────────────────────────── */

async function tokenRequest(opts: {
  url: string;
  body: Record<string, string>;
  /** Send `Accept: application/json` (GitHub returns form-encoded by default). */
  acceptJson?: boolean;
}): Promise<OAuthTokens> {
  const body = new URLSearchParams(opts.body).toString();
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (opts.acceptJson) headers.Accept = 'application/json';
  const res = await fetch(opts.url, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OAuth token request ${res.status}: ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    id_token?: string;
  };
  if (!json.access_token) {
    throw new Error('OAuth token response missing access_token');
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt:
      typeof json.expires_in === 'number'
        ? new Date(Date.now() + json.expires_in * 1000).toISOString()
        : undefined,
    scope: json.scope,
    tokenType: json.token_type,
    idToken: json.id_token,
  };
}
