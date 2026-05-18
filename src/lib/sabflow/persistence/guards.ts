/**
 * Multi-tenant row-level guard helpers for the SabFlow persistence layer.
 *
 * Track A · Phase 2 · sub-task #8 — "Multi-tenant row-level guards
 * (`workspaceId` + RBAC)" per `docs/adr/sabflow-persistence.md` §5.
 *
 * Scope: these helpers are the *only* sanctioned chokepoint that the repo
 * layer (`src/lib/sabflow/persistence/repo/*` — landing in sub-task #7) uses
 * to (a) assert the caller's auth context is bound to the workspace it
 * claims to read/write, and (b) shape every Mongo filter so it cannot
 * escape its tenant. Index prefixes in §3 of the ADR rely on
 * `{ workspaceId: 1, ... }` being on every query — `scopedFilter` is what
 * makes that contractually true at the call sites.
 *
 * Design constraints intentionally observed by this file:
 *
 * 1. **No imports from sibling persistence files.** This module sits at the
 *    bottom of the persistence stack — `repo/*.ts` imports `guards.ts`,
 *    never the reverse. The `AuthContext` shape is therefore forward-declared
 *    here, not imported.
 * 2. **No direct import of the RBAC/auth implementation.** SabFlow's RBAC
 *    keys (`sabflow.doc.read|write|admin`) are registered in Phase 8 §1, and
 *    the canonical `canAccess(workspaceId, docId, userId, requiredRole)`
 *    contract lives in the (still-evolving) auth/RBAC module — see
 *    `docs/adr/sabflow-persistence.md` §5.2 and
 *    `docs/adr/sabflow-auth.md` §4. To avoid a hard coupling before that
 *    module's surface is frozen, `enforceRoleAtLeast` accepts a
 *    `RoleResolver` interface and a workspace-permission resolver via
 *    `configureGuards()` (DI). The resolver is forward-declared, not
 *    imported — callers wire the real implementation at app boot.
 *
 * @module sabflow/persistence/guards
 */

/* ── Forward-declared types (no sibling imports) ─────────────── */

/**
 * Minimum shape of an authenticated SabFlow request context, as understood
 * by the persistence layer. The full `AuthContext` produced by SabNode's
 * session machinery is a superset; this file deliberately narrows to the
 * two fields the repo layer must trust on every call.
 *
 * Forward-declared (not imported) per the file-level constraint — the real
 * `AuthContext` is assembled in `src/lib/auth.ts` + `src/lib/rbac-server.ts`
 * and reaches this layer through the request pipeline.
 */
export interface AuthContext {
  /** SabNode user id (Mongo ObjectId hex). */
  readonly userId: string;
  /**
   * The workspace this request is bound to. May be `null` for
   * pre-workspace-selection flows (e.g. the workspace-picker page itself).
   * `requireWorkspaceAccess` rejects `null`.
   */
  readonly workspaceId: string | null;
}

/**
 * Narrowed variant of `AuthContext` after `requireWorkspaceAccess` has
 * passed. Type-assertion guards (the `asserts` predicate on
 * `requireWorkspaceAccess`) refine to this shape so downstream code can
 * read `ctx.workspaceId` as a plain `string`.
 */
export interface WorkspaceAuthContext extends AuthContext {
  readonly workspaceId: string;
}

/**
 * The four SabFlow workspace roles, in increasing order of privilege:
 * `viewer < editor < admin < owner`.
 *
 * Mirrors `src/lib/sabflow/workspaces/types.ts:WorkspaceRole` but is
 * re-declared here to keep this file free of sibling-module imports.
 */
export type SabFlowRole = 'viewer' | 'editor' | 'admin' | 'owner';

/**
 * Forward-declared resolver injected at app boot via `configureGuards()`.
 *
 * The concrete implementation lives in the workspace permissions module
 * (`src/lib/sabflow/workspaces/permissions.ts` + the RBAC layer registered
 * in Phase 8 §1). Keeping the dependency at interface level lets the
 * persistence layer ship and be unit-tested before the auth surface is
 * frozen, and prevents a circular dep with `repo/*` consumers.
 *
 * Implementations should:
 *  - return `null` when the user has no row in `sabflow_workspace_members`
 *    for the given workspace (treated as "no access" by
 *    `enforceRoleAtLeast`);
 *  - apply the `canAccess`-style precedence from the ADR (workspace admin
 *    inherits all per-doc rights, role-rank table viewer<editor<admin<owner).
 */
export interface RoleResolver {
  /**
   * Resolve the caller's effective workspace role.
   * @returns the user's role or `null` when not a member.
   */
  getRole(workspaceId: string, userId: string): Promise<SabFlowRole | null>;
}

/* ── Error ───────────────────────────────────────────────────── */

/**
 * Thrown by `requireWorkspaceAccess` (tenant mismatch) and
 * `enforceRoleAtLeast` (insufficient role / not a member).
 *
 * The `.code` discriminator is stable wire-format: API routes map it to a
 * 403 response and a structured JSON `{ code: 'TENANT_MISMATCH' }` body so
 * the SabFlow client SDK can branch on it without parsing the message.
 *
 * @example
 * ```ts
 * try {
 *   requireWorkspaceAccess(ctx, doc.workspaceId);
 * } catch (err) {
 *   if (err instanceof WorkspaceAccessError) return res.status(403).json({ code: err.code });
 *   throw err;
 * }
 * ```
 */
export class WorkspaceAccessError extends Error {
  /**
   * Stable machine-readable discriminator. Always `'TENANT_MISMATCH'` for
   * this class — kept as a literal type so callers can `switch` on it.
   */
  public readonly code: 'TENANT_MISMATCH' = 'TENANT_MISMATCH';

  /** Workspace the caller's context was bound to (or `null`). */
  public readonly contextWorkspaceId: string | null;

  /** Workspace the row / request was targeting. */
  public readonly targetWorkspaceId: string;

  constructor(opts: {
    contextWorkspaceId: string | null;
    targetWorkspaceId: string;
    message?: string;
  }) {
    super(
      opts.message ??
        `Workspace access denied: caller is bound to ${
          opts.contextWorkspaceId ?? '<none>'
        }, requested ${opts.targetWorkspaceId}`,
    );
    this.name = 'WorkspaceAccessError';
    this.contextWorkspaceId = opts.contextWorkspaceId;
    this.targetWorkspaceId = opts.targetWorkspaceId;
    // Preserve prototype chain across transpile targets.
    Object.setPrototypeOf(this, WorkspaceAccessError.prototype);
  }
}

/* ── Role-rank table (mirrors workspaces/permissions.ts) ─────── */

const ROLE_RANK: Record<SabFlowRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

function rank(role: SabFlowRole | null | undefined): number {
  if (!role) return 0;
  return ROLE_RANK[role] ?? 0;
}

/* ── Injection point for the RBAC resolver ───────────────────── */

let _resolver: RoleResolver | null = null;

/**
 * One-time wire-up for the role resolver. Called at app boot (e.g. from
 * `src/lib/sabflow/start.ts`) with the concrete implementation backed by
 * the workspace permissions module + the SabNode RBAC layer.
 *
 * Idempotent: re-binding with the same instance is a no-op, but switching
 * implementations at runtime throws to avoid action-at-a-distance bugs in
 * tests that leak global state.
 *
 * @example
 * ```ts
 * // src/lib/sabflow/start.ts (Phase 8 §1 wire-up)
 * import { configureGuards } from './persistence/guards';
 * import { getMemberRole } from './workspaces/db';
 * configureGuards({ getRole: (wsId, userId) => getMemberRole(wsId, userId) });
 * ```
 */
export function configureGuards(resolver: RoleResolver): void {
  if (_resolver && _resolver !== resolver) {
    throw new Error(
      'configureGuards: a different RoleResolver is already installed',
    );
  }
  _resolver = resolver;
}

/**
 * Test-only escape hatch. Resets the injected resolver so test suites can
 * install a fresh stub between cases without tripping the idempotency
 * check in `configureGuards`.
 *
 * Not exported as part of the public stable contract — repo callers must
 * not use it.
 */
export function __resetGuardsForTest(): void {
  _resolver = null;
}

/* ── Public guards ───────────────────────────────────────────── */

/**
 * Assert the caller's auth context is bound to `workspaceId`. After this
 * call returns, TypeScript narrows `ctx` to `WorkspaceAuthContext` so the
 * `ctx.workspaceId` field can be read as `string`.
 *
 * Throws `WorkspaceAccessError` (code `'TENANT_MISMATCH'`) when:
 *  - `ctx.workspaceId` is `null` (no workspace selected), or
 *  - `ctx.workspaceId !== workspaceId` (cross-tenant access attempt).
 *
 * Treats the comparison as case-sensitive ObjectId-hex equality — callers
 * must normalise IDs before invoking (the repo layer always passes the
 * canonical hex form returned by `ObjectId.toHexString()`).
 *
 * @example
 * ```ts
 * // src/lib/sabflow/persistence/repo/docs.ts (sub-task #7)
 * export async function loadDoc(ctx: AuthContext, docId: string) {
 *   const row = await docs.findOne({ _id: new ObjectId(docId) });
 *   if (!row) throw notFound();
 *   requireWorkspaceAccess(ctx, row.workspaceId.toHexString());
 *   // ctx is now WorkspaceAuthContext — ctx.workspaceId is string.
 *   return row;
 * }
 * ```
 */
export function requireWorkspaceAccess(
  ctx: AuthContext,
  workspaceId: string,
): asserts ctx is WorkspaceAuthContext {
  if (ctx.workspaceId !== workspaceId || ctx.workspaceId === null) {
    throw new WorkspaceAccessError({
      contextWorkspaceId: ctx.workspaceId,
      targetWorkspaceId: workspaceId,
    });
  }
}

/**
 * Build a Mongo filter that is *always* prefixed with `workspaceId`.
 *
 * Use this in every repo-level read/write so the `{ workspaceId: 1, ... }`
 * compound indexes promised in `docs/adr/sabflow-persistence.md` §3 are
 * actually hit and so cross-tenant index scans are impossible by
 * construction.
 *
 * The `extra` filter is shallow-merged after `workspaceId`; if `extra`
 * also contains a `workspaceId` key it is dropped with a warning in dev
 * (a caller-supplied tenant key is *always* a bug — only this helper is
 * allowed to set it).
 *
 * @returns a frozen filter object — re-using the same instance across
 *   queries is safe because Mongo never mutates the filter.
 *
 * @example
 * ```ts
 * // List recent docs for the current workspace, tag-filtered.
 * const filter = scopedFilter(ctx.workspaceId, { tags: 'onboarding', deletedAt: null });
 * const rows = await docsCol.find(filter).sort({ updatedAt: -1 }).limit(50).toArray();
 * ```
 */
export function scopedFilter(
  workspaceId: string,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  if (extra && Object.prototype.hasOwnProperty.call(extra, 'workspaceId')) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        '[sabflow/guards] scopedFilter: caller passed `workspaceId` in `extra` — dropping. ' +
          'Only this helper is allowed to set the tenant key.',
      );
    }
    const { workspaceId: _drop, ...rest } = extra;
    void _drop;
    return Object.freeze({ workspaceId, ...rest });
  }
  return Object.freeze({ workspaceId, ...(extra ?? {}) });
}

/**
 * Verify the user holds at least `role` in `workspaceId`. Awaits the
 * injected `RoleResolver` (see `configureGuards`) and throws
 * `WorkspaceAccessError` when the user's effective role is below the
 * required rank — including when the user has no membership row at all.
 *
 * The role precedence is the canonical SabFlow rank table:
 * `viewer (1) < editor (2) < admin (3) < owner (4)`.
 *
 * This helper is the persistence-side counterpart to the
 * `canAccess(workspaceId, docId, userId, requiredRole)` contract in
 * `docs/adr/sabflow-persistence.md` §5.2 — the per-doc share-row check
 * (which adds the `sabflow_doc_shares` lookup) is composed by the repo
 * layer on top of this workspace-level floor.
 *
 * Throws if `configureGuards()` has not been called — fail loudly rather
 * than silently letting through unauthenticated traffic.
 *
 * @example
 * ```ts
 * // src/lib/sabflow/persistence/repo/docs.ts
 * export async function deleteDoc(ctx: AuthContext, docId: string) {
 *   const row = await docs.findOne({ _id: new ObjectId(docId) });
 *   if (!row) throw notFound();
 *   requireWorkspaceAccess(ctx, row.workspaceId.toHexString());
 *   await enforceRoleAtLeast(ctx.workspaceId, ctx.userId, 'admin'); // soft-delete needs admin
 *   await docs.updateOne(scopedFilter(ctx.workspaceId, { _id: row._id }), {
 *     $set: { deletedAt: new Date() },
 *   });
 * }
 * ```
 */
export async function enforceRoleAtLeast(
  workspaceId: string,
  userId: string,
  role: SabFlowRole,
): Promise<void> {
  if (!_resolver) {
    throw new Error(
      'enforceRoleAtLeast: RoleResolver is not configured. ' +
        'Call configureGuards() at app boot before invoking persistence helpers.',
    );
  }
  const actual = await _resolver.getRole(workspaceId, userId);
  if (rank(actual) < rank(role)) {
    throw new WorkspaceAccessError({
      contextWorkspaceId: workspaceId,
      targetWorkspaceId: workspaceId,
      message: `Role check failed: user ${userId} has '${
        actual ?? 'none'
      }' in workspace ${workspaceId}, required '${role}'`,
    });
  }
}
