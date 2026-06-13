import 'server-only';

/**
 * SabCRM — access-context resolver (server-only).
 *
 * Resolves the inputs the pure {@link buildAccessibleByFilter} needs:
 *  - the object's org-wide default (OWD) from `sabcrm_sharing` (default
 *    `private`),
 *  - the actor's visible user-id set (self + managed subtree),
 *  - (future) role-hidden fields for FLS.
 *
 * FOUNDATION ONLY — this is intentionally NOT yet wired into the live
 * `records.server` / Rust read path. Wiring it everywhere (list/get/aggregate/
 * search/AI-retrieval) is security-critical and must be done with the app
 * running + a review. `resolveManagedSubtree` returns `[selfId]` today because
 * SabCRM has no manager hierarchy field yet; the `$graphLookup` extension point
 * is marked below for when a `managerId` lands on `workspaceMembers`.
 */

import { connectToDatabase } from '@/lib/mongodb';
import {
  buildAccessibleByFilter,
  canAccessRecord,
  buildFieldProjection,
  collectSubtreeUserIds,
  type AccessContext,
  type AccessFilter,
  type OwdLevel,
  type MemberNode,
} from './access-compiler';

export {
  buildAccessibleByFilter,
  canAccessRecord,
  buildFieldProjection,
  type AccessContext,
  type AccessFilter,
  type OwdLevel,
} from './access-compiler';

const SHARING_COLL = 'sabcrm_sharing';

const VALID_OWD: ReadonlySet<string> = new Set(['private', 'read', 'readWrite']);

interface SharingDoc {
  projectId: string;
  objectSlug: string;
  owd?: string;
}

/** Read an object's org-wide default. Defaults to `private` (most restrictive). */
export async function getObjectOwd(
  projectId: string,
  objectSlug: string,
): Promise<OwdLevel> {
  try {
    if (!projectId || !objectSlug) return 'private';
    const { db } = await connectToDatabase();
    const doc = (await db
      .collection(SHARING_COLL)
      .findOne({ projectId, objectSlug })) as SharingDoc | null;
    const owd = doc?.owd;
    return owd && VALID_OWD.has(owd) ? (owd as OwdLevel) : 'private';
  } catch {
    return 'private';
  }
}

/** Set an object's org-wide default (for a future Sharing settings UI). */
export async function setObjectOwd(
  projectId: string,
  objectSlug: string,
  owd: OwdLevel,
): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection(SHARING_COLL)
    .updateOne(
      { projectId, objectSlug },
      { $set: { owd, updatedAt: new Date().toISOString() } },
      { upsert: true },
    );
}

/**
 * The set of user ids the actor may act for in private mode: self + the
 * management subtree (everyone reporting up to them, transitively) resolved
 * over `workspaceMembers.managerId` edges. Degrades to `[selfId]` when there
 * is no member hierarchy (the common case until managers are assigned).
 *
 * Uses an in-JS BFS (`collectSubtreeUserIds`) rather than `$graphLookup` so it
 * is robust to whether `managerId` is stored as an id-string or ObjectId, and
 * so the traversal logic is unit-tested. Best-effort.
 */
export async function resolveManagedSubtree(
  projectId: string,
  selfId: string,
): Promise<string[]> {
  try {
    if (!projectId || !selfId) return [selfId];
    const { db } = await connectToDatabase();
    const rows = (await db
      .collection('sabcrm_records')
      .find({ projectId, object: 'workspaceMembers' })
      .project({ _id: 1, 'data.userId': 1, 'data.managerId': 1 })
      .limit(5000)
      .toArray()) as Array<{ _id: unknown; data?: { userId?: unknown; managerId?: unknown } }>;
    if (rows.length === 0) return [selfId];
    const members: MemberNode[] = rows.map((r) => ({
      id: String(r._id),
      userId: r.data?.userId != null ? String(r.data.userId) : undefined,
      managerId: r.data?.managerId != null ? String(r.data.managerId) : undefined,
    }));
    return collectSubtreeUserIds(members, selfId);
  } catch {
    return [selfId];
  }
}

/**
 * Assemble the {@link AccessContext} for one actor + object. Callers supply
 * `elevated` (owner/admin) from RBAC and optional role-hidden fields.
 */
export async function resolveAccessContext(args: {
  projectId: string;
  selfId: string;
  objectSlug: string;
  elevated: boolean;
  hiddenFields?: string[];
}): Promise<AccessContext> {
  const { projectId, selfId, objectSlug, elevated, hiddenFields } = args;
  const owd = elevated ? 'read' : await getObjectOwd(projectId, objectSlug);
  const visibleUserIds = elevated
    ? [selfId]
    : await resolveManagedSubtree(projectId, selfId);
  return { projectId, selfId, elevated, owd, visibleUserIds, hiddenFields };
}

/**
 * Convenience: resolve the context AND compile the filter in one call. The
 * returned `filter` pins `projectId` and (in private mode) the owner `$or`.
 */
export async function accessibleByFor(args: {
  projectId: string;
  selfId: string;
  objectSlug: string;
  elevated: boolean;
  hiddenFields?: string[];
}): Promise<AccessFilter> {
  const ctx = await resolveAccessContext(args);
  return buildAccessibleByFilter(ctx);
}
