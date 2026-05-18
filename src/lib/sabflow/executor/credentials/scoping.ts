/**
 * SabFlow executor — per-workspace credential scoping enforcement.
 *
 * Track B · Phase 5 · sub-task #6 of 10 — "Per-workspace credential scoping
 * enforced on every read/write" per `docs/adr/sabflow-executor.md` §6.4 and
 * the cross-tenant safety contract in `docs/adr/sabflow-persistence.md` §5.
 *
 * Scope: this module is the *only* chokepoint that credential-action handlers
 * (and the executor's runtime credential resolver) are allowed to use to:
 *
 *  - assert a fetched credential row is bound to the caller's workspace
 *    (`assertSameWorkspace`),
 *  - shape every Mongo filter so it cannot escape the current tenant
 *    (`filterByWorkspace`),
 *  - decide whether a credential may be shared with another principal /
 *    workspace (`canShareCredential`),
 *  - list credentials with the scoped filter pre-applied
 *    (`scopedListCredentials`).
 *
 * Design constraints intentionally observed by this file:
 *
 * 1. **No direct import of Mongo models.** This module operates on the
 *    pure `Credential` shape from `../../credentials/types.ts` and on a
 *    forward-declared `CredentialRepo` interface. The concrete repo
 *    implementation is wired in via `configureCredentialScoping()` at
 *    executor boot — keeping persistence wire-up out of this file and
 *    preventing a cycle with the credential DB module.
 * 2. **Re-export of `requireWorkspaceAccess`** from the sibling
 *    `persistence/guards.ts` so credential-action handlers can pull the
 *    workspace-binding check and the credential-row check from a single
 *    import surface (`@/lib/sabflow/executor/credentials/scoping`).
 * 3. **Plan flag (`crossWorkspaceShareEnabled`) is forward-declared.** The
 *    plan/billing module's surface is still in flux (Phase 6 §3) — this
 *    file accepts a `PlanFlagResolver` via the same `configure*` boot hook
 *    so cross-workspace share decisions don't hard-couple to plan internals.
 *
 * @module sabflow/executor/credentials/scoping
 */

import type { Credential } from '../../credentials/types';
import { requireWorkspaceAccess } from '../../persistence/guards';

/* ── Re-export sibling guard for credential-action handlers ─────────── */

/**
 * Re-export of `requireWorkspaceAccess` so credential-action handlers and
 * the executor's runtime resolver can import the workspace-binding check
 * and the credential-row check from one place:
 *
 * ```ts
 * import {
 *   requireWorkspaceAccess,
 *   assertSameWorkspace,
 *   filterByWorkspace,
 * } from '@/lib/sabflow/executor/credentials/scoping';
 * ```
 *
 * Behaviour is identical to the original — see `persistence/guards.ts`.
 */
export { requireWorkspaceAccess };

/* ── Forward-declared types (no sibling/model imports) ─────────────── */

/**
 * Minimum shape understood by this module. Matches `Credential` from
 * `../../credentials/types.ts` but narrowed to the two fields scoping
 * actually relies on. Stays a structural subset so callers can pass the
 * full `Credential` record without an adapter.
 */
export type CredentialDoc = Pick<Credential, 'id' | 'workspaceId'> &
  Partial<Omit<Credential, 'id' | 'workspaceId'>>;

/**
 * Generic Mongo filter shape — kept as a structural alias so this file
 * doesn't import the mongodb driver's `Filter<T>` (and therefore stays
 * driver-agnostic in tests and at the type layer).
 */
export type MongoFilter = Record<string, unknown>;

/**
 * Options accepted by {@link scopedListCredentials}.
 *
 * The optional `extraFilter` is merged *after* the workspace clause so a
 * caller-supplied `workspaceId` field is ignored (and warned about in dev)
 * — only this module is allowed to set the tenant key.
 */
export interface ScopedListOptions {
  /** Additional filter clauses (e.g. `{ type: 'openai' }`). */
  readonly extraFilter?: MongoFilter;
  /** Page size cap. Repo enforces a default if omitted. */
  readonly limit?: number;
  /** Sort key — forwarded to the repo verbatim. */
  readonly sort?: Record<string, 1 | -1>;
}

/**
 * Forward-declared repo contract. Implementation lives in the credentials
 * DB module (`src/lib/sabflow/credentials/db.ts`) and is wired in at boot
 * via {@link configureCredentialScoping}.
 *
 * Keeping the dependency at interface level avoids a circular import with
 * the DB module (which already imports credential types) and keeps this
 * file unit-testable with an in-memory stub.
 */
export interface CredentialRepo {
  /**
   * List credentials matching `filter`. Implementations MUST honour the
   * `workspaceId` clause set by {@link filterByWorkspace} — this module
   * never trusts the repo to add tenant scoping on its own.
   */
  list(
    filter: MongoFilter,
    opts?: { limit?: number; sort?: Record<string, 1 | -1> },
  ): Promise<Credential[]>;
}

/**
 * Forward-declared plan flag resolver. Implementation lives in the
 * billing/plans module (Phase 6 §3) and is wired at boot.
 *
 * `crossWorkspaceShareEnabled` is the only flag this file consults today;
 * keeping the surface as a single boolean lookup lets us extend later
 * without leaking plan internals into the executor.
 */
export interface PlanFlagResolver {
  /**
   * @returns `true` if the workspace's plan permits sharing credentials
   *   into another workspace.
   */
  crossWorkspaceShareEnabled(workspaceId: string): Promise<boolean> | boolean;
}

/**
 * Forward-declared workspace-role lookup. Used by {@link canShareCredential}
 * to confirm the requester is a workspace admin on the credential's owning
 * workspace before allowing the share to proceed.
 *
 * Same shape as the persistence-layer `RoleResolver.getRole` so the same
 * implementation can satisfy both — but kept declared locally to preserve
 * this module's no-sibling-import contract.
 */
export interface WorkspaceRoleResolver {
  /**
   * @returns the requester's role on `workspaceId`, or `null` if they are
   *   not a member. Only `admin` and `owner` count as "workspace admin"
   *   for sharing purposes.
   */
  getRole(
    workspaceId: string,
    userId: string,
  ): Promise<'viewer' | 'editor' | 'admin' | 'owner' | null> |
    'viewer' | 'editor' | 'admin' | 'owner' | null;
}

/* ── CredentialsError ──────────────────────────────────────────────── */

/**
 * Stable wire-format discriminator for credential-scoping failures. API
 * routes map these codes 1:1 to JSON `{ code }` bodies so the SabFlow
 * client SDK can branch on them without parsing messages.
 */
export type CredentialsErrorCode =
  | 'WORKSPACE_MISMATCH'
  | 'SHARE_FORBIDDEN'
  | 'NOT_CONFIGURED';

/**
 * Thrown by every public helper in this module on a scoping violation.
 *
 * @example
 * ```ts
 * try {
 *   assertSameWorkspace(cred, ctx.workspaceId);
 * } catch (err) {
 *   if (err instanceof CredentialsError && err.code === 'WORKSPACE_MISMATCH') {
 *     return res.status(403).json({ code: err.code });
 *   }
 *   throw err;
 * }
 * ```
 */
export class CredentialsError extends Error {
  public readonly code: CredentialsErrorCode;
  /** Workspace the credential row belongs to (when known). */
  public readonly credentialWorkspaceId?: string;
  /** Workspace the caller was acting under. */
  public readonly contextWorkspaceId?: string;

  constructor(opts: {
    code: CredentialsErrorCode;
    message?: string;
    credentialWorkspaceId?: string;
    contextWorkspaceId?: string;
  }) {
    super(opts.message ?? defaultMessage(opts.code));
    this.name = 'CredentialsError';
    this.code = opts.code;
    this.credentialWorkspaceId = opts.credentialWorkspaceId;
    this.contextWorkspaceId = opts.contextWorkspaceId;
    Object.setPrototypeOf(this, CredentialsError.prototype);
  }
}

function defaultMessage(code: CredentialsErrorCode): string {
  switch (code) {
    case 'WORKSPACE_MISMATCH':
      return 'Credential does not belong to the current workspace';
    case 'SHARE_FORBIDDEN':
      return 'Sharing this credential is not permitted';
    case 'NOT_CONFIGURED':
      return 'Credential scoping is not configured — call configureCredentialScoping() at boot';
  }
}

/* ── Boot-time injection ───────────────────────────────────────────── */

interface ScopingDeps {
  repo: CredentialRepo;
  planFlags: PlanFlagResolver;
  roles: WorkspaceRoleResolver;
}

let _deps: ScopingDeps | null = null;

/**
 * One-time wire-up. Called from the executor's start-up module with the
 * concrete credential repo, plan-flag lookup, and workspace-role lookup.
 *
 * Idempotent for the same instance; throws on attempted re-bind with a
 * different instance to avoid action-at-a-distance bugs in tests that
 * leak global state.
 */
export function configureCredentialScoping(deps: ScopingDeps): void {
  if (_deps && (_deps.repo !== deps.repo || _deps.planFlags !== deps.planFlags || _deps.roles !== deps.roles)) {
    throw new Error(
      'configureCredentialScoping: different deps are already installed',
    );
  }
  _deps = deps;
}

/**
 * Test-only escape hatch. Resets injected deps so test suites can install
 * fresh stubs between cases. Not part of the stable public contract.
 */
export function __resetCredentialScopingForTest(): void {
  _deps = null;
}

function requireDeps(): ScopingDeps {
  if (!_deps) {
    throw new CredentialsError({ code: 'NOT_CONFIGURED' });
  }
  return _deps;
}

/* ── Public scoping helpers ────────────────────────────────────────── */

/**
 * Assert a fetched credential row belongs to `workspaceId`.
 *
 * Throws {@link CredentialsError} with code `'WORKSPACE_MISMATCH'` on a
 * cross-tenant read. ID equality is case-sensitive hex — callers must pass
 * the canonical form produced by `ObjectId.toHexString()` (which is what
 * the repo layer always emits).
 *
 * @example
 * ```ts
 * const cred = await repo.findById(id);
 * assertSameWorkspace(cred, ctx.workspaceId);
 * // safe to decrypt / return cred.data from here.
 * ```
 */
export function assertSameWorkspace(
  credentialDoc: CredentialDoc,
  workspaceId: string,
): void {
  if (credentialDoc.workspaceId !== workspaceId) {
    throw new CredentialsError({
      code: 'WORKSPACE_MISMATCH',
      credentialWorkspaceId: credentialDoc.workspaceId,
      contextWorkspaceId: workspaceId,
    });
  }
}

/**
 * Build a Mongo filter that is *always* prefixed with `workspaceId`.
 *
 * Mirrors `persistence/guards.ts:scopedFilter` but is exported under the
 * executor-credentials surface so credential-action handlers don't have to
 * reach into the persistence module for the same primitive. The compound
 * indexes promised by the credentials collection (see
 * `docs/adr/sabflow-persistence.md` §3) are `{ workspaceId: 1, ... }` —
 * this helper makes hitting them contractually true.
 *
 * If `extra` also contains a `workspaceId` key it is dropped (with a dev
 * warning) so a caller can never widen the tenant scope by mistake.
 *
 * @returns a frozen filter — re-using the same instance is safe because
 *   Mongo never mutates the filter object.
 *
 * @example
 * ```ts
 * const filter = filterByWorkspace(ctx.workspaceId, { type: 'openai' });
 * const rows = await credsCol.find(filter).toArray();
 * ```
 */
export function filterByWorkspace(
  workspaceId: string,
  extra?: MongoFilter,
): MongoFilter {
  if (extra && Object.prototype.hasOwnProperty.call(extra, 'workspaceId')) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        '[sabflow/executor/credentials] filterByWorkspace: caller passed `workspaceId` in `extra` — dropping.',
      );
    }
    const { workspaceId: _drop, ...rest } = extra;
    void _drop;
    return Object.freeze({ workspaceId, ...rest });
  }
  return Object.freeze({ workspaceId, ...(extra ?? {}) });
}

/**
 * Decide whether `requesterId` may share `credentialDoc`.
 *
 * Rules:
 *  - Within the credential's own workspace the requester must hold the
 *    workspace `admin` or `owner` role.
 *  - To share *cross-workspace* (i.e. `targetWorkspace` is provided and
 *    differs from `credentialDoc.workspaceId`) the credential's owning
 *    workspace must additionally have the `crossWorkspaceShareEnabled`
 *    plan flag — gated through the forward-declared {@link PlanFlagResolver}.
 *
 * Returns `false` (does not throw) on any failure so callers can branch
 * cleanly; the action handler is responsible for translating `false` into
 * a `CredentialsError` with code `'SHARE_FORBIDDEN'` when the share was
 * explicitly requested.
 *
 * Throws {@link CredentialsError} with code `'NOT_CONFIGURED'` if the
 * scoping module hasn't been wired at boot (i.e. invariant violation,
 * not an auth failure).
 */
export async function canShareCredential(
  credentialDoc: CredentialDoc,
  requesterId: string,
  targetWorkspace?: string,
): Promise<boolean> {
  const { planFlags, roles } = requireDeps();

  const role = await roles.getRole(credentialDoc.workspaceId, requesterId);
  const isWorkspaceAdmin = role === 'admin' || role === 'owner';
  if (!isWorkspaceAdmin) return false;

  // Same-workspace share: admin/owner is sufficient.
  if (!targetWorkspace || targetWorkspace === credentialDoc.workspaceId) {
    return true;
  }

  // Cross-workspace share: plan flag must opt in.
  const enabled = await planFlags.crossWorkspaceShareEnabled(
    credentialDoc.workspaceId,
  );
  return Boolean(enabled);
}

/**
 * List credentials for `workspaceId` through the injected repo, with the
 * tenant clause pre-applied.
 *
 * This is the only sanctioned read-list path for credential-action
 * handlers — direct repo calls bypass the workspace clause and are
 * considered a bug. The repo implementation is provided at boot via
 * {@link configureCredentialScoping}; this function never touches Mongo
 * models directly.
 *
 * @example
 * ```ts
 * // src/app/actions/sabflow/credentials.ts
 * 'use server';
 * import { scopedListCredentials, requireWorkspaceAccess }
 *   from '@/lib/sabflow/executor/credentials/scoping';
 *
 * export async function listForCurrentWorkspace(ctx: AuthContext) {
 *   requireWorkspaceAccess(ctx, ctx.workspaceId!);
 *   return scopedListCredentials(ctx.workspaceId!, { extraFilter: { type: 'openai' } });
 * }
 * ```
 */
export async function scopedListCredentials(
  workspaceId: string,
  opts?: ScopedListOptions,
): Promise<Credential[]> {
  const { repo } = requireDeps();
  const filter = filterByWorkspace(workspaceId, opts?.extraFilter);
  const rows = await repo.list(filter, {
    limit: opts?.limit,
    sort: opts?.sort,
  });

  // Defence-in-depth: even though the filter pins workspaceId, double-check
  // each returned row. Cheap insurance against a repo bug or a future
  // implementation that forgets to honour the filter.
  for (const row of rows) {
    if (row.workspaceId !== workspaceId) {
      throw new CredentialsError({
        code: 'WORKSPACE_MISMATCH',
        credentialWorkspaceId: row.workspaceId,
        contextWorkspaceId: workspaceId,
      });
    }
  }

  return rows;
}
