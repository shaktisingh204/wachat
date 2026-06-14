import 'server-only';

import { getSabcrmPublicUrl } from './constants';
import { engineGraphql } from './engine-client';

/**
 * SabNode -> SabCRM (embedded Twenty engine) SSO handoff.
 *
 * Given the current SabNode session/user, this mints a single-use login token
 * for the corresponding Twenty workspace member and returns a handoff URL that
 * boots the embedded Twenty SPA already authenticated.
 *
 * The flow (per Twenty's auth contract) is two steps:
 *   1. SabNode (server) mints a short-lived, single-use `loginToken`;
 *   2. the Twenty SPA exchanges that `loginToken` for workspace-scoped
 *      access/refresh tokens on mount (Twenty's own
 *      `getAuthTokensFromLoginToken` mutation, called by the SPA).
 *
 * This module only performs step 1 and returns the URL that triggers step 2.
 * It follows the server-only, env-driven engine-client shape used across SabNode, and talks
 * to the engine through `./engine-client` (no direct fetch here).
 *
 * The SabNode session/user is PASSED IN by the caller (e.g. a server action or
 * the guarded `/sabcrm` layout that already resolved the session) so this
 * module stays decoupled from the core auth modules and is trivially testable.
 */

/**
 * Minimal projection of the SabNode session/user needed for the handoff.
 * The caller passes the live session user (structurally a subset of the
 * SabNode `SessionPayload`). Kept local so this module does not hard-depend
 * on the central auth types.
 */
export interface SabcrmSsoSubject {
  /** Stable SabNode user id. */
  readonly userId: string;
  /** The user's email — used to resolve the matching Twenty workspace member. */
  readonly email: string;
  /** The active SabNode project id, used to scope the Twenty workspace. */
  readonly projectId: string;
}

/** Discriminated result of an SSO handoff attempt. */
export type SabcrmSsoResult =
  | {
      readonly ok: true;
      /**
       * Fully-qualified URL that boots the embedded Twenty SPA with a
       * single-use login token. Safe to redirect to / load in an iframe.
       */
      readonly handoffUrl: string;
      /** The minted single-use login token (also embedded in `handoffUrl`). */
      readonly loginToken: string;
      /** Unix epoch ms after which `loginToken` is no longer valid, if known. */
      readonly expiresAt?: number;
    }
  | {
      readonly ok: false;
      /** Machine-readable failure reason. */
      readonly reason: 'not-implemented' | 'engine-error' | 'invalid-subject';
      /** Human-readable detail for logging / surfacing upstream. */
      readonly message: string;
    };

/**
 * Response shape for Twenty's login-token mint.
 *
 * Grounded in the engine DTOs (verified in this checkout):
 *   - `loginToken.entity.ts`  → `LoginToken { loginToken: AuthToken }`
 *   - `token.entity.ts`       → `AuthToken { token: string; expiresAt: Date }`
 * The outer field name (`getLoginTokenFromCredentials`) is a PLACEHOLDER — see
 * the ENGINE CONTRACT TODO: the credentials mutation is NOT the right SSO path.
 */
interface MintLoginTokenResponse {
  readonly [mutationField: string]:
    | {
        readonly loginToken?: {
          readonly token?: string;
          /** ISO timestamp serialized from Twenty's `AuthToken.expiresAt`. */
          readonly expiresAt?: string;
        };
      }
    | undefined;
}

/**
 * ============================ ENGINE CONTRACT TODO ============================
 * The SabNode -> Twenty trusted-SSO mint contract is NOT yet confirmed/wired.
 * Until it is, `createSabcrmHandoff` fails closed (returns
 * `reason: 'not-implemented'`) and `ENGINE_CONTRACT_CONFIRMED` stays `false`.
 * Do NOT flip it on or commit a real secret until ALL of the following are
 * resolved against the engine source
 * (`twenty/packages/twenty-server/src/engine/core-modules/auth/`):
 *
 *  1. WHICH MUTATION. Verified mutations in `auth.resolver.ts`:
 *       - `getLoginTokenFromCredentials(userCredentials: { email, password },
 *         origin)` → `LoginToken { loginToken: AuthToken }`
 *         Guarded by `CaptchaGuard, PublicEndpointGuard`. WRONG for SSO:
 *         requires the user's PASSWORD, which SabNode does not hold.
 *       - `getAuthTokensFromLoginToken(loginToken, origin)` → `AuthTokens`.
 *         This is the SECOND step, called by the SPA — not by SabNode.
 *       - `impersonate(ImpersonateInput { userId, workspaceId })`
 *         → `ImpersonateOutput { loginToken: LoginToken }`
 *         (DTOs verified: `impersonate.input.ts` / `impersonate.output.ts`).
 *         This is the CLOSEST fit for a trusted mint, BUT confirm its guard
 *         (it is admin/permission-gated, NOT a service-token endpoint as-is)
 *         and that it accepts a SabNode service identity.
 *     ACTION: confirm whether to (a) call `impersonate` with a service-auth
 *     context, or (b) add a dedicated SabNode-SSO mutation to the engine that
 *     mints a login token by (email|userId, workspaceId) behind a service guard.
 *     Then set `MINT_MUTATION_FIELD` + `MINT_LOGIN_TOKEN_MUTATION` accordingly.
 *
 *  2. SERVICE AUTH. The mint MUST be authenticated SabNode -> engine. The
 *     default bearer is `SABCRM_ENGINE_TOKEN` (sent by `engine-client.ts` from
 *     env, provisioned via `vercel env` — NEVER hardcoded). Confirm the engine
 *     accepts this as a privileged caller for the chosen mutation, or what
 *     additional header/guard it needs (pass via `engineGraphql`'s 3rd arg).
 *
 *  3. WORKSPACE + MEMBER RESOLUTION. `impersonate` needs `userId` +
 *     `workspaceId`. Confirm how a SabNode `(projectId, email)` maps to a
 *     Twenty `(workspaceId, userId)`. This almost certainly requires a prior
 *     provisioning/linking step that records the SabNode<->Twenty identity map
 *     (out of scope for this file — document where that linkage is stored).
 *
 *  4. ORIGIN. `origin` is a REQUIRED arg on the credentials/token mutations and
 *     gates allowed redirect origins. Confirm the value the engine expects
 *     (likely the SabCRM SPA public origin). `buildHandoffOrigin()` uses
 *     `getSabcrmPublicUrl()` — confirm that matches the engine's allow-list.
 *
 *  5. HANDOFF INGESTION. Confirm how the Twenty SPA consumes the login token.
 *     Twenty's SPA reads it from a `/verify?loginToken=...` route. Confirm the
 *     route + param name for THIS vendored build; `buildHandoffUrl()` assumes
 *     `${publicUrl}/verify?loginToken=`.
 * ============================================================================
 */
const ENGINE_CONTRACT_CONFIRMED = false;

/**
 * The GraphQL response field for the mint mutation. Placeholder until the
 * mutation is confirmed (see TODO item 1) — e.g. would become `'impersonate'`
 * if `impersonate` is adopted.
 */
const MINT_MUTATION_FIELD = 'getLoginTokenFromCredentials';

/**
 * GraphQL document for the mint step. UNCONFIRMED placeholder (see TODO item 1).
 * The credentials shape is shown for reference only; the real SSO mint will
 * almost certainly be `impersonate(input: { userId, workspaceId })` or a
 * service-guarded SabNode-SSO mutation, with a different selection set.
 */
const MINT_LOGIN_TOKEN_MUTATION = /* GraphQL */ `
  mutation MintSabcrmLoginToken($email: String!, $origin: String!) {
    # TODO(engine-contract): replace with the CONFIRMED trusted-SSO mutation.
    ${MINT_MUTATION_FIELD}(
      userCredentials: { email: $email }
      origin: $origin
    ) {
      loginToken {
        token
        expiresAt
      }
    }
  }
`;

/**
 * Origin value sent to the engine + base for the handoff URL: the public,
 * browser-facing SabCRM SPA URL. See TODO item 4.
 */
function buildHandoffOrigin(): string {
  return getSabcrmPublicUrl().replace(/\/+$/, '');
}

/**
 * Build the SPA handoff URL that carries the single-use login token.
 * See TODO item 5 for the assumed `/verify?loginToken=` ingestion route.
 */
function buildHandoffUrl(loginToken: string): string {
  return `${buildHandoffOrigin()}/verify?loginToken=${encodeURIComponent(loginToken)}`;
}

/**
 * Mint a SabCRM (Twenty) login token for the given SabNode subject and return a
 * handoff URL that boots the embedded Twenty SPA already authenticated.
 *
 * Fails closed: returns `{ ok: false }` (never throws for expected failure
 * modes) so callers can branch cleanly. Returns `reason: 'not-implemented'`
 * until the engine SSO contract is confirmed (see ENGINE CONTRACT TODO above).
 */
export async function createSabcrmHandoff(
  subject: SabcrmSsoSubject,
): Promise<SabcrmSsoResult> {
  if (!subject.email || !subject.projectId) {
    return {
      ok: false,
      reason: 'invalid-subject',
      message:
        'SabCRM SSO requires a session user with both an email and an active projectId.',
    };
  }

  if (!ENGINE_CONTRACT_CONFIRMED) {
    return {
      ok: false,
      reason: 'not-implemented',
      message:
        'SabCRM SSO handoff is scaffolded but disabled: the trusted SabNode -> Twenty ' +
        'login-token mint contract (mutation choice, service-auth guard, workspace/member ' +
        'resolution) is not yet confirmed against the engine. See the ENGINE CONTRACT ' +
        'TODO in src/lib/sabcrm/sso.ts.',
    };
  }

  // NOTE: unreachable until ENGINE_CONTRACT_CONFIRMED is flipped. This encodes
  // the INTENDED step-1 flow; reconcile the variables, mutation, and parsing
  // with the verified engine contract (TODO items 1-4) before enabling.
  try {
    const origin = buildHandoffOrigin();
    const data = await engineGraphql<MintLoginTokenResponse>(
      MINT_LOGIN_TOKEN_MUTATION,
      { email: subject.email, origin },
    );

    const minted = data[MINT_MUTATION_FIELD]?.loginToken;
    const loginToken = minted?.token;
    if (!loginToken) {
      return {
        ok: false,
        reason: 'engine-error',
        message: 'SabCRM engine did not return a login token.',
      };
    }

    const parsedExpiry = minted?.expiresAt
      ? Date.parse(minted.expiresAt)
      : Number.NaN;
    const expiresAt = Number.isNaN(parsedExpiry) ? undefined : parsedExpiry;

    return {
      ok: true,
      handoffUrl: buildHandoffUrl(loginToken),
      loginToken,
      expiresAt,
    };
  } catch (error) {
    return {
      ok: false,
      reason: 'engine-error',
      message:
        error instanceof Error
          ? error.message
          : 'Unknown SabCRM engine error during SSO handoff.',
    };
  }
}
