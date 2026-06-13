/**
 * SabCRM — permission / sharing filter compiler — PURE.
 *
 * `'server-only'`- and I/O-free (unit-testable like `./scoring.ts`). Turns a
 * resolved {@link AccessContext} into a single Mongo filter + field projection
 * that can be merged into any `sabcrm_records` read so list / count / aggregate
 * / search / AI-retrieval all share ONE access rule.
 *
 * ## Model (generalizes the legacy `lib/crm/access-scope.ts`)
 *
 * - **Org-wide default (OWD)** per object: `private` | `read` | `readWrite`.
 *   `read`/`readWrite` → everyone in the tenant sees every record (project
 *   scope only). `private` → a user sees only records they can act for.
 * - **Elevated** (owner / admin) → always full tenant scope.
 * - **Private visibility** = records whose owner field (`userId` /
 *   `data.assignedTo` / `data.owner` / `data.ownerId`) is in the actor's
 *   `visibleUserIds` (self + managed subtree + team). The owner-field `$or`
 *   mirrors the legacy `assignedTo: self` guarantee but generalized.
 * - **Field-level security**: role-hidden field keys → a `{ 'data.<key>': 0 }`
 *   projection.
 *
 * SECURITY: this can only ever NARROW from full tenant scope (it always pins
 * `projectId`, and private mode ANDs an owner `$or`). It never widens.
 */

/** Organization-wide default sharing level for an object. */
export type OwdLevel = 'private' | 'read' | 'readWrite';

/** Owner-bearing fields scanned in private mode (first is the top-level column). */
export const OWNER_FIELD_KEYS = [
  'userId',
  'assignedTo',
  'owner',
  'ownerId',
] as const;

/** A fully-resolved access context for one actor + object. */
export interface AccessContext {
  projectId: string;
  /** Acting user id (string form — matches `sabcrm_records.userId`). */
  selfId: string;
  /** Owner / admin bypass all record-level restriction. */
  elevated: boolean;
  /** Org-wide default for this object. */
  owd: OwdLevel;
  /** User ids the actor may act for: self + managed subtree + team. */
  visibleUserIds: string[];
  /** Record field keys (under `data.`) the actor's role hides. */
  hiddenFields?: string[];
}

/** A compiled access filter ready to merge into a Mongo read. */
export interface AccessFilter {
  filter: Record<string, unknown>;
  /** Field projection to hide FLS-restricted fields, or undefined when none. */
  projection?: Record<string, 0>;
}

/** A workspace-member node for subtree resolution. */
export interface MemberNode {
  /** The member record id (string). */
  id: string;
  /** The user this member maps to. */
  userId?: string;
  /** The member id of this member's manager (forms the hierarchy edge). */
  managerId?: string;
}

/**
 * Collect the set of user ids in `selfUserId`'s management subtree (self +
 * everyone who reports up to them, transitively) via BFS over `managerId`
 * edges. Pure + cycle-safe; falls back to `[selfUserId]` when the actor has no
 * member node. Used by `resolveManagedSubtree` in the server resolver.
 */
export function collectSubtreeUserIds(
  members: MemberNode[],
  selfUserId: string,
): string[] {
  const byId = new Map<string, MemberNode>();
  const childrenOf = new Map<string, string[]>();
  let selfMemberId: string | undefined;
  for (const m of members) {
    if (!m.id) continue;
    byId.set(m.id, m);
    if (m.userId === selfUserId) selfMemberId = m.id;
    if (m.managerId) {
      const arr = childrenOf.get(m.managerId) ?? [];
      arr.push(m.id);
      childrenOf.set(m.managerId, arr);
    }
  }
  if (!selfMemberId) return [selfUserId];

  const userIds = new Set<string>([selfUserId]);
  const seen = new Set<string>();
  const queue = [selfMemberId];
  while (queue.length > 0) {
    const memberId = queue.shift() as string;
    if (seen.has(memberId)) continue; // cycle guard
    seen.add(memberId);
    const uid = byId.get(memberId)?.userId;
    if (uid) userIds.add(uid);
    for (const childId of childrenOf.get(memberId) ?? []) {
      if (!seen.has(childId)) queue.push(childId);
    }
  }
  return [...userIds];
}

/** Build the `{ 'data.<key>': 0 }` projection for role-hidden fields. */
export function buildFieldProjection(
  hiddenFields?: string[],
): Record<string, 0> | undefined {
  if (!hiddenFields || hiddenFields.length === 0) return undefined;
  const proj: Record<string, 0> = {};
  for (const key of hiddenFields) {
    if (key) proj[`data.${key}`] = 0;
  }
  return Object.keys(proj).length ? proj : undefined;
}

/**
 * Compile an {@link AccessContext} into a Mongo filter + projection.
 *
 * - elevated OR non-private OWD → `{ projectId }` (full tenant scope).
 * - private → `{ projectId, $or: [owner fields ∈ visibleUserIds] }`.
 *
 * Always pins `projectId`, so it cannot leak across tenants.
 */
export function buildAccessibleByFilter(ctx: AccessContext): AccessFilter {
  const projection = buildFieldProjection(ctx.hiddenFields);
  if (ctx.elevated || ctx.owd !== 'private') {
    return { filter: { projectId: ctx.projectId }, projection };
  }
  const ids =
    ctx.visibleUserIds && ctx.visibleUserIds.length > 0
      ? Array.from(new Set(ctx.visibleUserIds))
      : [ctx.selfId];
  const or: Array<Record<string, unknown>> = [
    { userId: { $in: ids } },
    ...OWNER_FIELD_KEYS.filter((k) => k !== 'userId').map((k) => ({
      [`data.${k}`]: { $in: ids },
    })),
  ];
  return { filter: { projectId: ctx.projectId, $or: or }, projection };
}

/**
 * Whether the actor may READ a specific record's data, given the same context.
 * Used for single-record fetch guards (the list filter already enforces lists).
 */
export function canAccessRecord(
  ctx: AccessContext,
  record: { userId?: unknown; data?: Record<string, unknown> },
): boolean {
  if (ctx.elevated || ctx.owd !== 'private') return true;
  const ids = new Set(
    ctx.visibleUserIds && ctx.visibleUserIds.length > 0
      ? ctx.visibleUserIds
      : [ctx.selfId],
  );
  if (record.userId !== undefined && ids.has(String(record.userId))) return true;
  const data = record.data ?? {};
  for (const k of OWNER_FIELD_KEYS) {
    if (k === 'userId') continue;
    const v = data[k];
    if (v !== undefined && v !== null && ids.has(String(v))) return true;
  }
  return false;
}
