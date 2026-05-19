# SabFlow OAuth

Server-side OAuth dance for SabFlow credentials. The flow:

1. User clicks **Connect with X** in the connections dialog.
2. Dialog opens `/api/sabflow/oauth/authorize?provider=X&...` in a popup.
3. Authorize route mints a state nonce, calls `provider.buildAuthorizeUrl`, redirects to the provider.
4. Provider redirects to `/api/sabflow/oauth/callback?code=...&state=...`.
5. Callback route consumes the state, calls `provider.exchangeCode`, persists the tokens on a SabFlow credential.
6. Popup closes; the dialog polls `popup.closed` and refreshes the credentials list.

## File layout

- `providers.ts` — provider registry. Each provider implements `OAuthProvider`.
- `credential-type-map.ts` — **client-safe** map: SabFlow credential type → provider id, plus labels, brand accents, and subdomain metadata. Imported from the `'use client'` connections page (so it must not use Node-only APIs like `Buffer`).
- `types.ts` — `OAuthProvider`, `OAuthTokens`, `OAuthProviderConfig` interfaces.
- `stateStore.ts` — in-memory state nonce store (10-min TTL). Swap for Redis in multi-instance deploys.
- `refresh.ts` — `refreshIfExpired(credentialId)` — call before each outbound request that uses the credential.
- `revoke.ts` — token revocation.
- `scopeCatalog.ts` — human labels for common scope strings.

## Adding a standard provider

```ts
const myProvider: OAuthProvider = {
  id: 'myapp',
  label: 'My App',
  defaultScopes: ['read', 'write'],

  buildAuthorizeUrl({ config, state, scopes }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: (scopes ?? myProvider.defaultScopes).join(' '),
      state,
    });
    return `https://myapp.example/oauth/authorize?${params.toString()}`;
  },

  exchangeCode: ({ code, config }) =>
    tokenRequest({
      url: 'https://myapp.example/oauth/token',
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
      url: 'https://myapp.example/oauth/token',
      body: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
    }),
};
PROVIDERS.set(myProvider.id, myProvider);
```

Then:

1. Add `MYAPP_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI` to `.env.example`.
2. If a matching SabFlow credential type exists, map it in `credential-type-map.ts` (`OAUTH_PROVIDER_FOR_CREDENTIAL_TYPE`, `OAUTH_PROVIDER_LABEL`, `OAUTH_PROVIDER_ACCENT`).
3. If a `n8n-*` preset uses this provider, retag its `auth` block:
   ```json
   { "type": "oauth2", "provider": "myapp", "credentialType": "<type>", "fallback": { /* prior auth */ } }
   ```

## Patterns

### Basic-auth on the token endpoint

Some providers (Zoom, Spotify, Reddit, Twitter, Airtable, Bitbucket, PayPal, Fitbit, Vimeo, QuickBooks, Xero, Front, Pipedrive) expect client credentials via `Authorization: Basic <b64>` instead of form fields. Pass `basicAuth` to `tokenRequest`:

```ts
tokenRequest({
  url: '...',
  body: { grant_type: 'authorization_code', code, redirect_uri: config.redirectUri },
  basicAuth: { clientId: config.clientId, clientSecret: config.clientSecret },
})
```

### PKCE (S256)

Twitter (X) and Airtable require PKCE. Use the `pkcePair()` helper and return the verifier alongside the URL — the authorize route writes it onto the state entry, and the callback passes it back into `exchangeCode`:

```ts
buildAuthorizeUrl({ config, state, scopes }) {
  const { codeVerifier, codeChallenge } = pkcePair();
  const params = new URLSearchParams({
    /* ...standard params... */
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return { url: `https://.../authorize?${params}`, codeVerifier };
},
exchangeCode: ({ code, config, codeVerifier }) =>
  tokenRequest({
    url: '...',
    body: { grant_type: 'authorization_code', code, code_verifier: codeVerifier ?? '', /* ... */ },
  }),
```

### Per-tenant subdomain

Zendesk, Freshdesk, and Shopify resolve the OAuth host from a per-credential subdomain (`{shop}.myshopify.com`, `{org}.zendesk.com`). Set `requiresSubdomain: true` and read `subdomain` from the opts:

```ts
const myProvider: OAuthProvider = {
  id: 'myapp',
  label: 'My App',
  requiresSubdomain: true,
  defaultScopes: ['read'],
  buildAuthorizeUrl({ config, state, subdomain }) {
    if (!subdomain) throw new Error('My App OAuth requires a workspace subdomain');
    const host = `https://${encodeURIComponent(subdomain)}.myapp.com`;
    /* ... */
  },
  exchangeCode: ({ code, config, subdomain }) => { /* ... */ },
  refreshAccessToken: ({ refreshToken, config, subdomain }) => { /* ... */ },
};
```

Also register the provider in `credential-type-map.ts`:

```ts
OAUTH_PROVIDER_REQUIRES_SUBDOMAIN.add('myapp');
OAUTH_PROVIDER_SUBDOMAIN_HINT.myapp = 'mycompany';
OAUTH_PROVIDER_SUBDOMAIN_SUFFIX.myapp = '.myapp.com';
```

The connections dialog reads those maps and renders an inline `{subdomain}.suffix` input on the authenticate step.

### Long-lived tokens (no refresh)

Some providers (Notion, Linear, Trello, Mailchimp, Vimeo, Eventbrite, Intercom, ClickUp, Zendesk, Shopify) don't issue refresh tokens. Make `refreshAccessToken` throw a clear error so callers know to re-authorise:

```ts
async refreshAccessToken() {
  throw new Error('MyApp access tokens are long-lived — re-authorise to rotate.');
}
```

### Region-/self-hosted-configurable hosts

GitLab and Zoho expose `*_OAUTH_BASE_URL` env vars so a single registered provider works for self-hosted (`https://gitlab.mycorp.com`) or regional (`https://accounts.zoho.eu`) deployments.

## Env-var convention

`resolveProviderConfig` in `/src/app/api/sabflow/oauth/{authorize,callback}/route.ts` derives the env-var prefix from the provider id automatically:

```
<PROVIDER_ID_UPPER>_OAUTH_CLIENT_ID
<PROVIDER_ID_UPPER>_OAUTH_CLIENT_SECRET
<PROVIDER_ID_UPPER>_OAUTH_REDIRECT_URI   # optional; defaults to ${NEXT_PUBLIC_APP_URL}/api/sabflow/oauth/callback
```

For provider ids with dashes (none today, but plan for it), uppercase converts dashes to underscores — adjust the resolver if you add such a provider.
