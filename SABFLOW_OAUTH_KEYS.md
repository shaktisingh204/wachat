# SabFlow — OAuth App Keys: Full Process Reference

## Overview

SabFlow manages credentials (OAuth tokens, API keys, etc.) for 200+ service integrations. OAuth-based providers follow a standard Authorization Code flow with PKCE support, proactive token refresh, AES-256-GCM at-rest encryption, and per-execution in-process caching.

---

## 1. Where to Add a New OAuth App

Every OAuth provider is registered in one file:

```
src/lib/sabflow/oauth/providers.ts          ← 45+ provider implementations (~2046 lines)
src/lib/sabflow/oauth/credential-type-map.ts ← maps credentialType → providerId
src/lib/sabflow/credentials/types.ts         ← 200+ credential types, field schemas, UI labels
```

To wire a new OAuth provider you need entries in all three files.

---

## 2. Environment Variables Required

Each OAuth app needs two env vars (set in `.env` for local, provisioned via Vercel dashboard / `vercel env` for production):

```
SABFLOW_OAUTH_<PROVIDER_ID>_CLIENT_ID=...
SABFLOW_OAUTH_<PROVIDER_ID>_CLIENT_SECRET=...
```

Example for Google:
```
SABFLOW_OAUTH_GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
SABFLOW_OAUTH_GOOGLE_CLIENT_SECRET=GOCSPX-...
```

The authorize route loads these at runtime inside `src/app/api/sabflow/oauth/authorize/route.ts`.

Encryption key (required — must be set before any credential is stored):
```
CREDENTIALS_ENCRYPTION_KEY=<64-char hex>   # preferred
# fallback: SHA-256(NEXTAUTH_SECRET) is used if above is absent
```

---

## 3. Provider Implementation (`providers.ts`)

Each entry must implement the `OAuthProvider` interface:

```ts
interface OAuthProvider {
  id: string;                          // e.g. "google"
  name: string;                        // display name
  authUrl: string;                     // authorization endpoint
  tokenUrl: string;                    // token exchange endpoint
  defaultScopes: string[];             // pre-selected scopes
  clientIdEnv: string;                 // env var name for client_id
  clientSecretEnv: string;             // env var name for client_secret
  pkce?: boolean;                      // true for Twitter, Airtable, etc.
  subdomainKey?: string;               // for tenant-based providers (Zendesk, Shopify, etc.)
  basicAuthForToken?: boolean;         // sends client creds via HTTP Basic (Spotify, Zoom, etc.)
  buildAuthorizeUrl(params): string;   // constructs the redirect URL
  exchangeCode(code, verifier?): Promise<OAuthTokens>;
  refreshAccessToken(refreshToken): Promise<OAuthTokens>;
}
```

`OAuthTokens` shape returned by both `exchangeCode` and `refreshAccessToken`:
```ts
{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;      // ISO-8601 timestamp
  scope?: string;
  tokenType?: string;
  idToken?: string;
}
```

---

## 4. Authorization Flow (Step-by-Step)

```
User clicks "Connect with X"
  │
  ▼
GET /api/sabflow/oauth/authorize?provider=X&label=MyConn&returnTo=/connections
  src/app/api/sabflow/oauth/authorize/route.ts
  │  1. Resolve user session
  │  2. Validate provider exists in providers.ts
  │  3. Read CLIENT_ID / CLIENT_SECRET from env
  │  4. Generate one-time state nonce (crypto.randomUUID())
  │  5. Store state in memory (10-min TTL) with:
  │       { userId, providerId, scopes, label, returnTo, subdomain, credentialType,
  │         codeVerifier (PKCE), credentialId (for re-auth) }
  │  6. Call provider.buildAuthorizeUrl() → redirect URL
  ▼
Browser → Provider login/consent page (e.g. accounts.google.com)
  │
  ▼
Provider redirects back:
GET /api/sabflow/oauth/callback?code=AUTH_CODE&state=NONCE
  src/app/api/sabflow/oauth/callback/route.ts
  │  1. Look up & consume state (single-use, validates TTL)    ← CSRF guard
  │  2. Call provider.exchangeCode(code, codeVerifier?)
  │  3. Receive OAuthTokens { accessToken, refreshToken, expiresAt, scope }
  │  4. Persist to MongoDB (encrypted) — see §5
  │  5. Audit-log: credential.oauth.granted
  │  6. Redirect to returnTo URL
  ▼
Credential saved — shows in /dashboard/sabflow/connections
```

State store: `src/lib/sabflow/oauth/stateStore.ts` (in-memory Map, 10-min expiry)

---

## 5. Credential Storage (MongoDB)

**Collection**: `sabflow_credentials`

```ts
{
  _id: ObjectId,
  workspaceId: string,        // owner (maps to userId in current model)
  type: CredentialType,       // e.g. "google_sheets"
  name: string,               // user-defined label
  data: Record<string, string>, // AES-256-GCM encrypted key→value map
  createdAt: Date,
  updatedAt: Date,
}
```

For OAuth credentials the `data` bag contains:
```json
{
  "oauthProvider": "google",
  "accessToken": "<encrypted>",
  "refreshToken": "<encrypted>",
  "expiresAt": "<encrypted ISO timestamp>",
  "scope": "<encrypted>",
  "tokenType": "<encrypted>",
  "subdomain": "<encrypted, if applicable>"
}
```

DB helpers: `src/lib/sabflow/credentials/db.ts`
- `createCredential()` — insert, returns hex id
- `getCredentials(workspaceId, type?)` — list (newest first)
- `getCredentialById(id)` — fetch single
- `updateCredential(id, patch)` — patch fields
- `deleteCredential(id)` — permanent

---

## 6. Encryption

File: `src/lib/sabflow/credentials/encryption.ts`

- Algorithm: **AES-256-GCM**
- Key resolution order:
  1. `CREDENTIALS_ENCRYPTION_KEY` (64-char hex) — preferred
  2. `SHA-256(NEXTAUTH_SECRET)` — fallback
- Encrypted format stored in DB: `base64(iv):base64(ciphertext):base64(authTag)`
- IV: 96-bit (GCM recommended)
- Functions:
  - `encryptData(plain)` → encrypted string
  - `decryptData(encrypted)` → plain
  - `encryptRecord(data)` → each value encrypted
  - `decryptRecord(data)` → each value decrypted (silently skips corrupt entries)

**Rule**: decrypted bytes never leave the process, never logged, never persisted.

---

## 7. Runtime Credential Resolution (During Workflow Execution)

File: `src/lib/sabflow/executor/credentials/resolver.ts`

Called by nodes at execution time via `resolveCredentials(input)`:

```ts
resolveCredentials({
  workspaceId,
  executionId,
  credentialId?,      // explicit id, else workspace default used
  credentialType,     // e.g. "openai"
  nodeId,
  nodeType,
})
```

Resolution order:
1. **In-process cache** (per-execution LRU, 5-min TTL) → cache hit returns immediately
2. **MongoDB lookup** — by id or workspace default
3. **Workspace ownership check** — throws `WORKSPACE_MISMATCH` on cross-workspace
4. **Type check** — throws `TYPE_MISMATCH` if type mismatch
5. **OAuth2 lazy refresh** — if `expiresAt` within 30s, refresh tokens before decrypting
6. **Decrypt** — `decryptRecord()` on the `data` bag
7. **Audit** — `cred.read` event (fire-and-forget)
8. **Cache** — stores decrypted data (TTL = min(5min, expiresAt − 30s))

Cache is cleared on execution completion via `clearExecutionCache(executionId)`. Max 256 entries per process.

---

## 8. Token Refresh

File: `src/lib/sabflow/executor/credentials/oauth2-refresh.ts`

Three modes:

| Mode | Trigger | File location |
|------|---------|---------------|
| On-demand | Before each node execution if token is expiring | `refreshIfExpired(credentialId, decrypted)` |
| Background worker | Every 5 min (Node.js process) | `startOAuth2RefreshWorker()` |
| Single sweep | Cron tick | `runOAuth2RefreshSweep()` |

Background sweep behavior:
- Scans `sabflow_credentials` for OAuth2 creds with `expiresAtMs` in next 15 minutes
- Processes up to 200 credentials per sweep
- Coalesces concurrent refresh requests (in-flight dedup map)
- Non-retryable error: `invalid_grant` (refresh token revoked — user must re-authorize)

Refresh POST payload:
```
grant_type=refresh_token
refresh_token=<current>
client_id=<from env>
client_secret=<from env>
```
Some providers (Zoom, Spotify, Reddit, Twitch) use HTTP Basic auth instead.

After refresh: new `access_token` (+ optional rotating `refresh_token`) re-encrypted and persisted to MongoDB.

---

## 9. API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/sabflow/credentials` | List all (masked) |
| `POST` | `/api/sabflow/credentials` | Create new |
| `GET` | `/api/sabflow/credentials/[id]` | Fetch single (masked) |
| `PUT` | `/api/sabflow/credentials/[id]` | Update |
| `DELETE` | `/api/sabflow/credentials/[id]` | Delete |
| `POST` | `/api/sabflow/credentials/[id]/test` | Test connection (rate-limited 10/min) |
| `GET` | `/api/sabflow/credentials/[id]/scopes` | Manage OAuth scopes |
| `GET` | `/api/sabflow/oauth/authorize` | Start OAuth flow |
| `GET` | `/api/sabflow/oauth/callback` | Handle provider callback |

All routes require authenticated session. Responses mask `data` values as `••••••••`.

---

## 10. UI Entry Point

Page: `src/app/dashboard/sabflow/connections/page.tsx`

Three-step modal:
1. **Pick** — select credential type from categorized list (search + category filter)
2. **Authenticate** — OAuth providers show "Connect with X" button; manual types show field form; subdomain-based providers (Zendesk, Shopify, Freshdesk) show a subdomain input first
3. **Status** — confirms success/failure; option to run a connection test

Credentials table shows: Name · Type · Created · Updated · Actions (Test / Re-authorize / Edit / Delete)

---

## 11. Credential Types vs OAuth Providers

Not every credential type is OAuth — many are plain API key / basic auth forms. The mapping is:

```
CredentialType (200+)  →  credential-type-map.ts  →  OAuthProvider id (45+)
                                                        └── providers.ts
```

Only types listed in `credential-type-map.ts` trigger the OAuth flow. Others render a static form from `types.ts` field definitions.

---

## 12. Adding a New OAuth App Checklist

- [ ] Register provider object in `src/lib/sabflow/oauth/providers.ts`
- [ ] Add `CredentialType` entry in `src/lib/sabflow/credentials/types.ts` (name, category, fields)
- [ ] Add mapping in `src/lib/sabflow/oauth/credential-type-map.ts`
- [ ] Set `SABFLOW_OAUTH_<PROVIDER>_CLIENT_ID` and `_CLIENT_SECRET` in env
- [ ] Add redirect URI `<BASE_URL>/api/sabflow/oauth/callback` in the provider's app console
- [ ] (Optional) Add provider-specific test logic in `src/lib/sabflow/executor/credentials/test.ts`
- [ ] (If token refresh is supported) Confirm `tokenUrl` and `basicAuthForToken` flag are correct

---

## 13. Key Files Quick Reference

| File | Role |
|------|------|
| `src/lib/sabflow/oauth/providers.ts` | 45+ OAuth provider implementations |
| `src/lib/sabflow/oauth/stateStore.ts` | In-memory CSRF state nonce store |
| `src/lib/sabflow/oauth/credential-type-map.ts` | CredentialType → provider id map |
| `src/lib/sabflow/credentials/types.ts` | 200+ credential type definitions |
| `src/lib/sabflow/credentials/db.ts` | MongoDB CRUD |
| `src/lib/sabflow/credentials/encryption.ts` | AES-256-GCM encrypt/decrypt |
| `src/lib/sabflow/executor/credentials/resolver.ts` | Runtime resolution + caching |
| `src/lib/sabflow/executor/credentials/oauth2-refresh.ts` | Token refresh worker |
| `src/lib/sabflow/executor/credentials/test.ts` | Provider connection tests |
| `src/app/api/sabflow/oauth/authorize/route.ts` | OAuth start route |
| `src/app/api/sabflow/oauth/callback/route.ts` | OAuth callback route |
| `src/app/api/sabflow/credentials/route.ts` | CRUD API |
| `src/app/api/sabflow/credentials/[id]/test/route.ts` | Test API |
| `src/app/dashboard/sabflow/connections/page.tsx` | UI — connections page |
