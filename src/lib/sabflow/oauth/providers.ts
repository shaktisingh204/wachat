/**
 * Registered OAuth providers.
 *
 * Currently ships Google as the reference implementation.  Adding a new
 * provider is a five-method object plus an entry in `PROVIDERS`.
 */

import { createHash, randomBytes } from 'crypto';
import type { OAuthProvider, OAuthTokens } from './types';
import { OAUTH_PROVIDER_FOR_CREDENTIAL_TYPE } from './credential-type-map';

/** PKCE helper — RFC 7636 S256 challenge derived from a 64-byte verifier. */
function pkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(64).toString('base64url');
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

export { OAUTH_PROVIDER_FOR_CREDENTIAL_TYPE } from './credential-type-map';

const PROVIDERS = new Map<string, OAuthProvider>();

export function getOAuthProvider(id: string): OAuthProvider | undefined {
  return PROVIDERS.get(id);
}

export function listOAuthProviders(): OAuthProvider[] {
  return Array.from(PROVIDERS.values());
}

export function getOAuthProviderForCredentialType(
  credentialType: string,
): OAuthProvider | undefined {
  const id = OAUTH_PROVIDER_FOR_CREDENTIAL_TYPE[credentialType];
  return id ? PROVIDERS.get(id) : undefined;
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

/* ── Discord ────────────────────────────────────────────────────────────── */

const discordProvider: OAuthProvider = {
  id: 'discord',
  label: 'Discord',
  defaultScopes: ['identify', 'guilds', 'bot'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: (scopes ?? discordProvider.defaultScopes).join(' '),
      state,
      prompt: 'consent',
    });
    return `https://discord.com/oauth2/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://discord.com/api/oauth2/token',
      body: {
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://discord.com/api/oauth2/token',
      body: {
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'refresh_token',
      },
    }),
};
PROVIDERS.set(discordProvider.id, discordProvider);

/* ── HubSpot ────────────────────────────────────────────────────────────── */

const hubspotProvider: OAuthProvider = {
  id: 'hubspot',
  label: 'HubSpot',
  defaultScopes: ['oauth', 'crm.objects.contacts.read', 'crm.objects.contacts.write'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: (scopes ?? hubspotProvider.defaultScopes).join(' '),
      state,
    });
    return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://api.hubapi.com/oauth/v1/token',
      body: {
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code,
      },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://api.hubapi.com/oauth/v1/token',
      body: {
        grant_type: 'refresh_token',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
      },
    }),
};
PROVIDERS.set(hubspotProvider.id, hubspotProvider);

/* ── Asana ──────────────────────────────────────────────────────────────── */

const asanaProvider: OAuthProvider = {
  id: 'asana',
  label: 'Asana',
  defaultScopes: ['default'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state,
      scope: (scopes ?? asanaProvider.defaultScopes).join(' '),
    });
    return `https://app.asana.com/-/oauth_authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://app.asana.com/-/oauth_token',
      body: {
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code,
      },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://app.asana.com/-/oauth_token',
      body: {
        grant_type: 'refresh_token',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
      },
    }),
};
PROVIDERS.set(asanaProvider.id, asanaProvider);

/* ── Atlassian (Jira / Confluence Cloud) ────────────────────────────────── */

const atlassianProvider: OAuthProvider = {
  id: 'atlassian',
  label: 'Atlassian',
  defaultScopes: [
    'read:jira-user',
    'read:jira-work',
    'write:jira-work',
    'offline_access',
  ],
  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: config.clientId,
      scope: (scopes ?? atlassianProvider.defaultScopes).join(' '),
      redirect_uri: config.redirectUri,
      state,
      response_type: 'code',
      prompt: 'consent',
    });
    return `https://auth.atlassian.com/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://auth.atlassian.com/oauth/token',
      body: {
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
      },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://auth.atlassian.com/oauth/token',
      body: {
        grant_type: 'refresh_token',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
      },
    }),
};
PROVIDERS.set(atlassianProvider.id, atlassianProvider);

/* ── Zoom ───────────────────────────────────────────────────────────────── */

const zoomProvider: OAuthProvider = {
  id: 'zoom',
  label: 'Zoom',
  defaultScopes: ['meeting:write', 'user:read'],
  buildAuthorizeUrl({ config, state }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state,
    });
    return `https://zoom.us/oauth/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://zoom.us/oauth/token',
      body: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://zoom.us/oauth/token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
};
PROVIDERS.set(zoomProvider.id, zoomProvider);

/* ── Spotify ────────────────────────────────────────────────────────────── */

const spotifyProvider: OAuthProvider = {
  id: 'spotify',
  label: 'Spotify',
  defaultScopes: ['user-read-email', 'user-read-private', 'playlist-read-private'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state,
      scope: (scopes ?? spotifyProvider.defaultScopes).join(' '),
      show_dialog: 'true',
    });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://accounts.spotify.com/api/token',
      body: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
  async refreshAccessToken({ refreshToken, config }) {
    const tokens = await tokenRequest({
      url: 'https://accounts.spotify.com/api/token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    });
    // Spotify often omits refresh_token on refresh — preserve the original.
    if (!tokens.refreshToken) tokens.refreshToken = refreshToken;
    return tokens;
  },
};
PROVIDERS.set(spotifyProvider.id, spotifyProvider);

/* ── Trello ─────────────────────────────────────────────────────────────── */

// Trello uses OAuth 1.0a in its REST API, but the "Power-Up" OAuth-style
// fragment authorize is the supported integration flow.  This implementation
// targets the modern OAuth-2-shaped Trello app authorize URL; for token
// exchange Trello hands back the token directly in the fragment, so the
// callback should treat ?token= as the access token.  Refresh isn't supported.
const trelloProvider: OAuthProvider = {
  id: 'trello',
  label: 'Trello',
  defaultScopes: ['read', 'write'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      expiration: 'never',
      name: 'SabFlow',
      scope: (scopes ?? trelloProvider.defaultScopes).join(','),
      response_type: 'token',
      key: config.clientId,
      callback_method: 'fragment',
      return_url: config.redirectUri,
      state,
    });
    return `https://trello.com/1/authorize?${params.toString()}`;
  },
  async exchangeCode({ code }) {
    // Trello returns the access token directly via the URL fragment — the
    // callback already extracts it into `code`.
    return { accessToken: code };
  },
  async refreshAccessToken() {
    throw new Error('Trello tokens do not expire — re-authorise to rotate.');
  },
};
PROVIDERS.set(trelloProvider.id, trelloProvider);

/* ── Box ────────────────────────────────────────────────────────────────── */

const boxProvider: OAuthProvider = {
  id: 'box',
  label: 'Box',
  defaultScopes: ['root_readwrite'],
  buildAuthorizeUrl({ config, state }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state,
    });
    return `https://account.box.com/api/oauth2/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://api.box.com/oauth2/token',
      body: {
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://api.box.com/oauth2/token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    }),
};
PROVIDERS.set(boxProvider.id, boxProvider);

/* ── Dropbox ────────────────────────────────────────────────────────────── */

const dropboxProvider: OAuthProvider = {
  id: 'dropbox',
  label: 'Dropbox',
  defaultScopes: [
    'files.metadata.read',
    'files.content.read',
    'files.content.write',
  ],
  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      token_access_type: 'offline',
      scope: (scopes ?? dropboxProvider.defaultScopes).join(' '),
      state,
    });
    return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://api.dropboxapi.com/oauth2/token',
      body: {
        code,
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://api.dropboxapi.com/oauth2/token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    }),
};
PROVIDERS.set(dropboxProvider.id, dropboxProvider);

/* ── Salesforce ─────────────────────────────────────────────────────────── */

const salesforceProvider: OAuthProvider = {
  id: 'salesforce',
  label: 'Salesforce',
  defaultScopes: ['api', 'refresh_token', 'offline_access'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const base =
      process.env.SALESFORCE_OAUTH_BASE_URL ?? 'https://login.salesforce.com';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: (scopes ?? salesforceProvider.defaultScopes).join(' '),
      state,
      prompt: 'consent',
    });
    return `${base.replace(/\/$/, '')}/services/oauth2/authorize?${params.toString()}`;
  },
  exchangeCode({ code, config }) {
    const base =
      process.env.SALESFORCE_OAUTH_BASE_URL ?? 'https://login.salesforce.com';
    return tokenRequest({
      url: `${base.replace(/\/$/, '')}/services/oauth2/token`,
      body: {
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      },
    });
  },
  refreshAccessToken({ refreshToken, config }) {
    const base =
      process.env.SALESFORCE_OAUTH_BASE_URL ?? 'https://login.salesforce.com';
    return tokenRequest({
      url: `${base.replace(/\/$/, '')}/services/oauth2/token`,
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    });
  },
};
PROVIDERS.set(salesforceProvider.id, salesforceProvider);

/* ── Pipedrive ──────────────────────────────────────────────────────────── */

const pipedriveProvider: OAuthProvider = {
  id: 'pipedrive',
  label: 'Pipedrive',
  defaultScopes: ['deals:full', 'contacts:full', 'users:read'],
  buildAuthorizeUrl({ config, state }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state,
    });
    return `https://oauth.pipedrive.com/oauth/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://oauth.pipedrive.com/oauth/token',
      body: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://oauth.pipedrive.com/oauth/token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
};
PROVIDERS.set(pipedriveProvider.id, pipedriveProvider);

/* ── Intercom ───────────────────────────────────────────────────────────── */

const intercomProvider: OAuthProvider = {
  id: 'intercom',
  label: 'Intercom',
  defaultScopes: [],
  buildAuthorizeUrl({ config, state }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state,
    });
    return `https://app.intercom.com/oauth?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://api.intercom.io/auth/eagle/token',
      body: {
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    }),
  async refreshAccessToken() {
    throw new Error('Intercom OAuth tokens are long-lived — re-authorise to rotate.');
  },
};
PROVIDERS.set(intercomProvider.id, intercomProvider);

/* ── ClickUp ────────────────────────────────────────────────────────────── */

const clickupProvider: OAuthProvider = {
  id: 'clickup',
  label: 'ClickUp',
  defaultScopes: [],
  buildAuthorizeUrl({ config, state }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state,
    });
    return `https://app.clickup.com/api?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://api.clickup.com/api/v2/oauth/token',
      body: {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
      },
    }),
  async refreshAccessToken() {
    throw new Error('ClickUp tokens do not expire — re-authorise to rotate.');
  },
};
PROVIDERS.set(clickupProvider.id, clickupProvider);

/* ── Calendly ───────────────────────────────────────────────────────────── */

const calendlyProvider: OAuthProvider = {
  id: 'calendly',
  label: 'Calendly',
  defaultScopes: [],
  buildAuthorizeUrl({ config, state }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: config.redirectUri,
      state,
    });
    return `https://auth.calendly.com/oauth/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://auth.calendly.com/oauth/token',
      body: {
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
      },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://auth.calendly.com/oauth/token',
      body: {
        grant_type: 'refresh_token',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
      },
    }),
};
PROVIDERS.set(calendlyProvider.id, calendlyProvider);

/* ── Mailchimp ──────────────────────────────────────────────────────────── */

const mailchimpProvider: OAuthProvider = {
  id: 'mailchimp',
  label: 'Mailchimp',
  defaultScopes: [],
  buildAuthorizeUrl({ config, state }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state,
    });
    return `https://login.mailchimp.com/oauth2/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://login.mailchimp.com/oauth2/token',
      body: {
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code,
      },
    }),
  async refreshAccessToken() {
    throw new Error(
      'Mailchimp OAuth tokens are long-lived — re-authorise to rotate.',
    );
  },
};
PROVIDERS.set(mailchimpProvider.id, mailchimpProvider);

/* ── Reddit ─────────────────────────────────────────────────────────────── */

const redditProvider: OAuthProvider = {
  id: 'reddit',
  label: 'Reddit',
  defaultScopes: ['identity', 'read'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      state,
      redirect_uri: config.redirectUri,
      duration: 'permanent',
      scope: (scopes ?? redditProvider.defaultScopes).join(' '),
    });
    return `https://www.reddit.com/api/v1/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://www.reddit.com/api/v1/access_token',
      body: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://www.reddit.com/api/v1/access_token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
};
PROVIDERS.set(redditProvider.id, redditProvider);

/* ── LinkedIn ───────────────────────────────────────────────────────────── */

const linkedinProvider: OAuthProvider = {
  id: 'linkedin',
  label: 'LinkedIn',
  defaultScopes: ['r_liteprofile', 'r_emailaddress'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state,
      scope: (scopes ?? linkedinProvider.defaultScopes).join(' '),
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://www.linkedin.com/oauth/v2/accessToken',
      body: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://www.linkedin.com/oauth/v2/accessToken',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    }),
};
PROVIDERS.set(linkedinProvider.id, linkedinProvider);

/* ── Stripe ─────────────────────────────────────────────────────────────── */

const stripeProvider: OAuthProvider = {
  id: 'stripe',
  label: 'Stripe',
  defaultScopes: [],
  buildAuthorizeUrl({ config, state }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state,
    });
    return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://connect.stripe.com/oauth/token',
      body: {
        grant_type: 'authorization_code',
        code,
        client_secret: config.clientSecret,
      },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://connect.stripe.com/oauth/token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_secret: config.clientSecret,
      },
    }),
};
PROVIDERS.set(stripeProvider.id, stripeProvider);

/* ── Monday.com ─────────────────────────────────────────────────────────── */

const mondayProvider: OAuthProvider = {
  id: 'monday',
  label: 'Monday.com',
  defaultScopes: [],
  buildAuthorizeUrl({ config, state }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state,
    });
    return `https://auth.monday.com/oauth2/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://auth.monday.com/oauth2/token',
      body: {
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://auth.monday.com/oauth2/token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    }),
};
PROVIDERS.set(mondayProvider.id, mondayProvider);

/* ── GitLab ─────────────────────────────────────────────────────────────── */

const gitlabProvider: OAuthProvider = {
  id: 'gitlab',
  label: 'GitLab',
  defaultScopes: ['api', 'read_user'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const base = process.env.GITLAB_OAUTH_BASE_URL ?? 'https://gitlab.com';
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state,
      scope: (scopes ?? gitlabProvider.defaultScopes).join(' '),
    });
    return `${base.replace(/\/$/, '')}/oauth/authorize?${params.toString()}`;
  },
  exchangeCode({ code, config }) {
    const base = process.env.GITLAB_OAUTH_BASE_URL ?? 'https://gitlab.com';
    return tokenRequest({
      url: `${base.replace(/\/$/, '')}/oauth/token`,
      body: {
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      },
    });
  },
  refreshAccessToken({ refreshToken, config }) {
    const base = process.env.GITLAB_OAUTH_BASE_URL ?? 'https://gitlab.com';
    return tokenRequest({
      url: `${base.replace(/\/$/, '')}/oauth/token`,
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    });
  },
};
PROVIDERS.set(gitlabProvider.id, gitlabProvider);

/* ── Bitbucket ──────────────────────────────────────────────────────────── */

const bitbucketProvider: OAuthProvider = {
  id: 'bitbucket',
  label: 'Bitbucket',
  defaultScopes: [],
  buildAuthorizeUrl({ config, state }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: config.redirectUri,
      state,
    });
    return `https://bitbucket.org/site/oauth2/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://bitbucket.org/site/oauth2/access_token',
      body: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://bitbucket.org/site/oauth2/access_token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
};
PROVIDERS.set(bitbucketProvider.id, bitbucketProvider);

/* ── Figma ──────────────────────────────────────────────────────────────── */

const figmaProvider: OAuthProvider = {
  id: 'figma',
  label: 'Figma',
  defaultScopes: ['file_read'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state,
      scope: (scopes ?? figmaProvider.defaultScopes).join(' '),
    });
    return `https://www.figma.com/oauth?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://www.figma.com/api/oauth/token',
      body: {
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://www.figma.com/api/oauth/refresh',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    }),
};
PROVIDERS.set(figmaProvider.id, figmaProvider);

/* ── PayPal ─────────────────────────────────────────────────────────────── */

const paypalProvider: OAuthProvider = {
  id: 'paypal',
  label: 'PayPal',
  defaultScopes: ['openid', 'profile'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state,
      scope: (scopes ?? paypalProvider.defaultScopes).join(' '),
    });
    return `https://www.paypal.com/connect?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://api-m.paypal.com/v1/oauth2/token',
      body: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://api-m.paypal.com/v1/oauth2/token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
};
PROVIDERS.set(paypalProvider.id, paypalProvider);

/* ── Strava ─────────────────────────────────────────────────────────────── */

const stravaProvider: OAuthProvider = {
  id: 'strava',
  label: 'Strava',
  defaultScopes: ['read', 'activity:read'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      approval_prompt: 'auto',
      state,
      scope: (scopes ?? stravaProvider.defaultScopes).join(','),
    });
    return `https://www.strava.com/oauth/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://www.strava.com/oauth/token',
      body: {
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://www.strava.com/oauth/token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    }),
};
PROVIDERS.set(stravaProvider.id, stravaProvider);

/* ── Fitbit ─────────────────────────────────────────────────────────────── */

const fitbitProvider: OAuthProvider = {
  id: 'fitbit',
  label: 'Fitbit',
  defaultScopes: ['activity', 'profile'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state,
      scope: (scopes ?? fitbitProvider.defaultScopes).join(' '),
    });
    return `https://www.fitbit.com/oauth2/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://api.fitbit.com/oauth2/token',
      body: {
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://api.fitbit.com/oauth2/token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
};
PROVIDERS.set(fitbitProvider.id, fitbitProvider);

/* ── Vimeo ──────────────────────────────────────────────────────────────── */

const vimeoProvider: OAuthProvider = {
  id: 'vimeo',
  label: 'Vimeo',
  defaultScopes: ['public', 'private'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state,
      scope: (scopes ?? vimeoProvider.defaultScopes).join(' '),
    });
    return `https://api.vimeo.com/oauth/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://api.vimeo.com/oauth/access_token',
      body: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
  async refreshAccessToken() {
    throw new Error(
      'Vimeo OAuth tokens are long-lived — re-authorise to rotate.',
    );
  },
};
PROVIDERS.set(vimeoProvider.id, vimeoProvider);

/* ── Webex ──────────────────────────────────────────────────────────────── */

const webexProvider: OAuthProvider = {
  id: 'webex',
  label: 'Webex',
  defaultScopes: ['spark:all'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: config.redirectUri,
      state,
      scope: (scopes ?? webexProvider.defaultScopes).join(' '),
    });
    return `https://webexapis.com/v1/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://webexapis.com/v1/access_token',
      body: {
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://webexapis.com/v1/access_token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    }),
};
PROVIDERS.set(webexProvider.id, webexProvider);

/* ── Zoho ───────────────────────────────────────────────────────────────── */

const zohoProvider: OAuthProvider = {
  id: 'zoho',
  label: 'Zoho',
  defaultScopes: ['ZohoCRM.modules.ALL'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const base = process.env.ZOHO_OAUTH_BASE_URL ?? 'https://accounts.zoho.com';
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: config.redirectUri,
      state,
      access_type: 'offline',
      scope: (scopes ?? zohoProvider.defaultScopes).join(','),
    });
    return `${base.replace(/\/$/, '')}/oauth/v2/auth?${params.toString()}`;
  },
  exchangeCode({ code, config }) {
    const base = process.env.ZOHO_OAUTH_BASE_URL ?? 'https://accounts.zoho.com';
    return tokenRequest({
      url: `${base.replace(/\/$/, '')}/oauth/v2/token`,
      body: {
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      },
    });
  },
  refreshAccessToken({ refreshToken, config }) {
    const base = process.env.ZOHO_OAUTH_BASE_URL ?? 'https://accounts.zoho.com';
    return tokenRequest({
      url: `${base.replace(/\/$/, '')}/oauth/v2/token`,
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    });
  },
};
PROVIDERS.set(zohoProvider.id, zohoProvider);

/* ── Eventbrite ─────────────────────────────────────────────────────────── */

const eventbriteProvider: OAuthProvider = {
  id: 'eventbrite',
  label: 'Eventbrite',
  defaultScopes: [],
  buildAuthorizeUrl({ config, state }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state,
    });
    return `https://www.eventbrite.com/oauth/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://www.eventbrite.com/oauth/token',
      body: {
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      },
    }),
  async refreshAccessToken() {
    throw new Error(
      'Eventbrite OAuth tokens are long-lived — re-authorise to rotate.',
    );
  },
};
PROVIDERS.set(eventbriteProvider.id, eventbriteProvider);

/* ── Webflow ────────────────────────────────────────────────────────────── */

const webflowProvider: OAuthProvider = {
  id: 'webflow',
  label: 'Webflow',
  defaultScopes: [],
  buildAuthorizeUrl({ config, state }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: config.redirectUri,
      state,
    });
    return `https://webflow.com/oauth/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://api.webflow.com/oauth/access_token',
      body: {
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://api.webflow.com/oauth/access_token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    }),
};
PROVIDERS.set(webflowProvider.id, webflowProvider);

/* ── QuickBooks ─────────────────────────────────────────────────────────── */

const quickbooksProvider: OAuthProvider = {
  id: 'quickbooks',
  label: 'QuickBooks',
  defaultScopes: ['com.intuit.quickbooks.accounting'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: config.redirectUri,
      state,
      scope: (scopes ?? quickbooksProvider.defaultScopes).join(' '),
    });
    return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      body: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
};
PROVIDERS.set(quickbooksProvider.id, quickbooksProvider);

/* ── Xero ───────────────────────────────────────────────────────────────── */

const xeroProvider: OAuthProvider = {
  id: 'xero',
  label: 'Xero',
  defaultScopes: [
    'offline_access',
    'accounting.transactions',
    'accounting.contacts',
  ],
  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state,
      scope: (scopes ?? xeroProvider.defaultScopes).join(' '),
    });
    return `https://login.xero.com/identity/connect/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://identity.xero.com/connect/token',
      body: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://identity.xero.com/connect/token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
};
PROVIDERS.set(xeroProvider.id, xeroProvider);

/* ── Wrike ──────────────────────────────────────────────────────────────── */

const wrikeProvider: OAuthProvider = {
  id: 'wrike',
  label: 'Wrike',
  defaultScopes: [],
  buildAuthorizeUrl({ config, state }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: config.redirectUri,
      state,
    });
    return `https://login.wrike.com/oauth2/authorize/v4?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://login.wrike.com/oauth2/token',
      body: {
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://login.wrike.com/oauth2/token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    }),
};
PROVIDERS.set(wrikeProvider.id, wrikeProvider);

/* ── Help Scout ─────────────────────────────────────────────────────────── */

const helpscoutProvider: OAuthProvider = {
  id: 'helpscout',
  label: 'Help Scout',
  defaultScopes: [],
  buildAuthorizeUrl({ config, state }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: config.redirectUri,
      state,
    });
    return `https://secure.helpscout.net/authentication/authorizeClientApplication?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://api.helpscout.net/v2/oauth2/token',
      body: {
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://api.helpscout.net/v2/oauth2/token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    }),
};
PROVIDERS.set(helpscoutProvider.id, helpscoutProvider);

/* ── Front ──────────────────────────────────────────────────────────────── */

const frontProvider: OAuthProvider = {
  id: 'front',
  label: 'Front',
  defaultScopes: [],
  buildAuthorizeUrl({ config, state }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state,
    });
    return `https://app.frontapp.com/oauth/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://app.frontapp.com/oauth/token',
      body: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://app.frontapp.com/oauth/token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
};
PROVIDERS.set(frontProvider.id, frontProvider);

/* ── Twitch ─────────────────────────────────────────────────────────────── */

const twitchProvider: OAuthProvider = {
  id: 'twitch',
  label: 'Twitch',
  defaultScopes: ['user:read:email'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state,
      scope: (scopes ?? twitchProvider.defaultScopes).join(' '),
    });
    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://id.twitch.tv/oauth2/token',
      body: {
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://id.twitch.tv/oauth2/token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    }),
};
PROVIDERS.set(twitchProvider.id, twitchProvider);

/* ── Twitter / X (PKCE) ─────────────────────────────────────────────────── */

const twitterProvider: OAuthProvider = {
  id: 'twitter',
  label: 'Twitter / X',
  defaultScopes: ['tweet.read', 'users.read', 'offline.access'],
  buildAuthorizeUrl({ config, state, scopes }) {
    const { codeVerifier, codeChallenge } = pkcePair();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: (scopes ?? twitterProvider.defaultScopes).join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return {
      url: `https://twitter.com/i/oauth2/authorize?${params.toString()}`,
      codeVerifier,
    };
  },
  exchangeCode: ({ code, config, codeVerifier }) =>
    tokenRequest({
      url: 'https://api.twitter.com/2/oauth2/token',
      body: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        code_verifier: codeVerifier ?? '',
        client_id: config.clientId,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://api.twitter.com/2/oauth2/token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
};
PROVIDERS.set(twitterProvider.id, twitterProvider);

/* ── Airtable (PKCE) ────────────────────────────────────────────────────── */

const airtableProvider: OAuthProvider = {
  id: 'airtable',
  label: 'Airtable',
  defaultScopes: [
    'data.records:read',
    'data.records:write',
    'schema.bases:read',
  ],
  buildAuthorizeUrl({ config, state, scopes }) {
    const { codeVerifier, codeChallenge } = pkcePair();
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: (scopes ?? airtableProvider.defaultScopes).join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return {
      url: `https://airtable.com/oauth2/v1/authorize?${params.toString()}`,
      codeVerifier,
    };
  },
  exchangeCode: ({ code, config, codeVerifier }) =>
    tokenRequest({
      url: 'https://airtable.com/oauth2/v1/token',
      body: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        code_verifier: codeVerifier ?? '',
        client_id: config.clientId,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
  refreshAccessToken: ({ refreshToken, config }) =>
    tokenRequest({
      url: 'https://airtable.com/oauth2/v1/token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
    }),
};
PROVIDERS.set(airtableProvider.id, airtableProvider);

/* ── Zendesk (per-tenant subdomain) ─────────────────────────────────────── */

function zendeskBase(subdomain: string): string {
  return `https://${encodeURIComponent(subdomain)}.zendesk.com`;
}

const zendeskProvider: OAuthProvider = {
  id: 'zendesk',
  label: 'Zendesk',
  defaultScopes: ['read', 'write'],
  requiresSubdomain: true,
  buildAuthorizeUrl({ config, state, scopes, subdomain }) {
    if (!subdomain) throw new Error('Zendesk OAuth requires a workspace subdomain');
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: (scopes ?? zendeskProvider.defaultScopes).join(' '),
      state,
    });
    return `${zendeskBase(subdomain)}/oauth/authorizations/new?${params.toString()}`;
  },
  exchangeCode: ({ code, config, subdomain }) => {
    if (!subdomain) throw new Error('Zendesk token exchange requires subdomain on state');
    return tokenRequest({
      url: `${zendeskBase(subdomain)}/oauth/tokens`,
      body: {
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        scope: 'read write',
      },
    });
  },
  async refreshAccessToken() {
    throw new Error(
      'Zendesk OAuth tokens do not expire — re-authorise to rotate.',
    );
  },
};
PROVIDERS.set(zendeskProvider.id, zendeskProvider);

/* ── Freshdesk (per-tenant subdomain) ───────────────────────────────────── */

function freshdeskBase(subdomain: string): string {
  return `https://${encodeURIComponent(subdomain)}.freshdesk.com`;
}

const freshdeskProvider: OAuthProvider = {
  id: 'freshdesk',
  label: 'Freshdesk',
  defaultScopes: [],
  requiresSubdomain: true,
  buildAuthorizeUrl({ config, state, subdomain }) {
    if (!subdomain) throw new Error('Freshdesk OAuth requires a workspace subdomain');
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state,
    });
    return `${freshdeskBase(subdomain)}/oauth/authorize?${params.toString()}`;
  },
  exchangeCode: ({ code, config, subdomain }) => {
    if (!subdomain) throw new Error('Freshdesk token exchange requires subdomain on state');
    return tokenRequest({
      url: `${freshdeskBase(subdomain)}/oauth/token`,
      body: {
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      },
    });
  },
  refreshAccessToken: ({ refreshToken, config, subdomain }) => {
    if (!subdomain) throw new Error('Freshdesk token refresh requires subdomain');
    return tokenRequest({
      url: `${freshdeskBase(subdomain)}/oauth/token`,
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    });
  },
};
PROVIDERS.set(freshdeskProvider.id, freshdeskProvider);

/* ── Shared token-endpoint helper ───────────────────────────────────────── */

async function tokenRequest(opts: {
  url: string;
  body: Record<string, string>;
  /** Send `Accept: application/json` (GitHub returns form-encoded by default). */
  acceptJson?: boolean;
  /** Send client credentials via HTTP Basic instead of form fields (Zoom/Spotify/Reddit/Twitch). */
  basicAuth?: { clientId: string; clientSecret: string };
}): Promise<OAuthTokens> {
  const body = new URLSearchParams(opts.body).toString();
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (opts.acceptJson) headers.Accept = 'application/json';
  if (opts.basicAuth) {
    const encoded = Buffer.from(
      `${opts.basicAuth.clientId}:${opts.basicAuth.clientSecret}`,
    ).toString('base64');
    headers.Authorization = `Basic ${encoded}`;
  }
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
