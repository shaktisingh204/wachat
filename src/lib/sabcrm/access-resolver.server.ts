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
  type AccessContext,
  type AccessFilter,
  type OwdLevel,
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
 * The set of user ids the actor may act for in private mode.
 *
 * Today: just the actor (matches the legacy "own / assigned-to-self" rule).
 * EXTENSION POINT — once `workspaceMembers` carries a `managerId` relation,
 * resolve the manager's subtree here via `$graphLookup`:
 *
 *   db.collection('sabcrm_records').aggregate([
 *     { $match: { projectId, object: 'workspaceMembers', 'data.userId': selfId } },
 *     { $graphLookup: { from: 'sabcrm_records', startWith: '$_id',
 *         connectFromField: '_id', connectToField: 'data.managerId',
 *         as: 'reports', restrictSearchWithMatch: { object: 'workspaceMembers', projectId } } },
 *   ])
 * → flatten reports' `data.userId` into the returned set.
 */
export async function resolveManagedSubtree(
  _projectId: string,
  selfId: string,
): Promise<string[]> {
  return [selfId];
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
