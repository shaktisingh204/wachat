/**
 * SabFlow OAuth — per-scope revocation helpers.
 *
 * Two responsibilities:
 *
 *   1. `revokeProviderToken(providerId, accessToken)` — call the provider's
 *      OAuth revoke endpoint (where one exists) so the access token is killed
 *      on the provider side.  Best-effort; returns a status string so the
 *      caller can log it.
 *
 *   2. Local soft-revoke bookkeeping — the SabFlow source-of-truth on which
 *      scopes the workspace has *chosen* to drop, independent of whatever's
 *      still in the upstream grant.  The runtime credential resolver MUST
 *      consult `revokedScopes` before letting a flow act on a credential.
 *
 * The granted scope list lives on `credential.data.scope` (space-separated).
 * Locally-revoked scopes live on `credential.data.revokedScopes` (also
 * space-separated) so the existing encrypted `data` bag schema is preserved
 * without a Mongo migration.
 */

import 'server-only';

/* ── Provider revoke endpoints ──────────────────────────────────────────── */

type ProviderRevokeStrategy =
  /** Provider exposes a callable revoke endpoint — caller hits it. */
  | { kind: 'http'; method: 'POST' | 'GET'; build: (token: string) => { url: string; body?: string; headers?: Record<string, string> } }
  /** Provider does not expose programmatic per-token revoke — soft-revoke locally. */
  | { kind: 'soft'; reason: string };

const PROVIDER_REVOKE: Record<string, ProviderRevokeStrategy> = {
  google: {
    kind: 'http',
    method: 'POST',
    build: (token) => ({
      url: 'https://oauth2.googleapis.com/revoke',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    }),
  },
  github: {
    // GitHub's "Delete an app token" requires the client_id+secret as Basic
    // auth and the token in the JSON body — that's a full credential revoke,
    // not per-scope.  We soft-revoke individual scopes; full-credential revoke
    // happens via DELETE on the credential record.
    kind: 'soft',
    reason: 'GitHub does not support per-scope revoke; SabFlow will refuse to use this scope locally',
  },
  slack: {
    // POST https://slack.com/api/auth.revoke with the token as a Bearer header.
    // This revokes the whole token — there is no per-scope revoke in Slack.
    // We expose it from the helper anyway so a *credential-wide* revoke from
    // the connections page can use it; per-scope drops are soft-revokes.
    kind: 'soft',
    reason: 'Slack does not support per-scope revoke; SabFlow will refuse to use this scope locally',
  },
  microsoft: {
    // Microsoft Graph does not expose a token-revoke endpoint outside of
    // tenant-admin tooling — soft-revoke locally.
    kind: 'soft',
    reason: 'Microsoft Graph has no programmatic per-token revoke; SabFlow will refuse to use this scope locally',
  },
  notion: {
    kind: 'soft',
    reason: 'Notion does not expose programmatic revoke; visit the integration page to disconnect',
  },
  linear: {
    // Linear has a `mutation oauthAppRevoke` GraphQL call but it nukes the
    // whole grant.  Treat per-scope drops as soft-revokes.
    kind: 'soft',
    reason: 'Linear revokes the whole grant; SabFlow will refuse to use this scope locally',
  },
};

/* ── Revoke result ──────────────────────────────────────────────────────── */

export type RevokeOutcome =
  | { kind: 'remote'; statusCode: number }
  | { kind: 'soft'; reason: string }
  | { kind: 'error'; error: string };

/**
 * Attempt a provider-side token revoke for the **whole** access token.  Most
 * provider revoke endpoints kill the entire grant — there is no widespread
 * per-scope revoke API across OAuth providers — so this is best used as part
 * of a wider "drop this credential entirely" flow.
 *
 * For per-scope drops, prefer `softRevokeScope` below, which only updates
 * SabFlow's local view so flows refuse to use the scope.
 */
export async function revokeProviderToken(
  providerId: string,
  accessToken: string,
): Promise<RevokeOutcome> {
  const strategy = PROVIDER_REVOKE[providerId];
  if (!strategy) {
    return { kind: 'soft', reason: `Unknown provider ${providerId} — soft-revoking locally` };
  }
  if (strategy.kind === 'soft') {
    return { kind: 'soft', reason: strategy.reason };
  }
  if (!accessToken) {
    return { kind: 'error', error: 'No access token available to revoke' };
  }

  try {
    const req = strategy.build(accessToken);
    const res = await fetch(req.url, {
      method: strategy.method,
      headers: req.headers,
      body: req.body,
      signal: AbortSignal.timeout(10_000),
    });
    return { kind: 'remote', statusCode: res.status };
  } catch (err) {
    return {
      kind: 'error',
      error: err instanceof Error ? err.message : 'revoke request failed',
    };
  }
}

/* ── Local soft-revoke helpers ──────────────────────────────────────────── */

/** Returns the set of scope strings the credential currently has granted. */
export function parseScopes(scope: string | undefined | null): string[] {
  if (!scope) return [];
  return scope.split(/\s+/).filter(Boolean);
}

/** Pack a scope array back into the wire format used in `data.scope`. */
export function joinScopes(scopes: string[]): string {
  return scopes.filter(Boolean).join(' ');
}

/**
 * Required scopes for a provider — these power the basic "I can see who the
 * user is" call that everything else depends on, so we refuse to let the user
 * revoke them individually.  Revoking the whole credential is fine; revoking
 * the floor isn't.
 */
const REQUIRED_SCOPES: Record<string, ReadonlyArray<string>> = {
  google: [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
  github: ['read:user'],
  slack: ['users:read'],
  microsoft: ['User.Read', 'offline_access'],
  notion: [],
  linear: ['read'],
};

export function isRequiredScope(providerId: string, scope: string): boolean {
  const required = REQUIRED_SCOPES[providerId];
  if (!required) return false;
  return required.includes(scope);
}

export function requiredScopesFor(providerId: string): ReadonlyArray<string> {
  return REQUIRED_SCOPES[providerId] ?? [];
}
