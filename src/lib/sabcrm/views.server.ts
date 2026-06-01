/**
 * SabCRM — saved views runtime (server-only).
 *
 * A "view" is a persisted, named configuration over a single object: which
 * surface to render (`table` | `board`), how rows are filtered, sorted and
 * grouped, plus which fields are shown as columns / card fields. Views are
 * the SabNode-side equivalent of Twenty's per-object views — they let a
 * user save "Open opportunities by stage", "My tasks", etc. and pick them
 * from a tab strip above the record runtime.
 *
 * Scoping mirrors the rest of SabCRM: every document carries a `projectId`
 * (tenant). A view may additionally carry a `userId` to mark it private to
 * one user; project-shared views omit it. All reads and writes are scoped
 * by `projectId`; mutations match `{ _id, projectId }` so one tenant can
 * never touch another's saved views.
 *
 * The canonical persisted shape is {@link SabcrmViewDoc} (defined in
 * `./db`). This module maps it to the serialisable {@link SavedView}
 * (Mongo `_id` → string `_id`) for transport to the client.
 */

import 'server-only';
import { ObjectId } from 'mongodb';
import { sabcrmViews, type SabcrmViewDoc } from './db';
import type { ActionResult } from './types';

/** A saved view in its serialisable API shape. `_id` is the hex string. */
export interface SavedView {
  _id: string;
  /** Tenant scope. */
  projectId: string;
  /** Owner of a private view; omitted for project-shared views. */
  userId?: string;
  /** Object slug this view belongs to, e.g. `opportunities`. */
  object: string;
  name: string;
  /** Surface to render. */
  kind: 'table' | 'board';
  /** Field key → exact value equality filters. */
  filters?: Record<string, unknown>;
  /** Field key to sort by. */
  sortBy?: string;
  /** Sort direction. */
  sortDir?: 'asc' | 'desc';
  /** Ordered field keys shown as columns / card fields. */
  fields?: string[];
  /** SELECT field key used to group a board view into columns. */
  groupByField?: string;
  /** Whether this is the object's default view. */
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Input accepted by {@link saveView}. Presence of `id` means update. */
export interface SaveViewInput {
  /** Existing view id to update; omit to create. */
  id?: string;
  object: string;
  name: string;
  /** Surface to render. Defaults to `table` on create. */
  kind?: 'table' | 'board';
  /** Mark this view private to a user. Omit for a project-shared view. */
  userId?: string;
  filters?: Record<string, unknown>;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  fields?: string[];
  groupByField?: string;
  isDefault?: boolean;
}

/** Validate a string is a well-formed ObjectId (avoids throwing in queries). */
function isValidId(id: string): boolean {
  return typeof id === 'string' && ObjectId.isValid(id);
}

/** Map a persisted doc to its serialisable API shape. */
function toSavedView(doc: SabcrmViewDoc): SavedView {
  return {
    _id: doc._id.toHexString(),
    projectId: doc.projectId,
    userId: doc.userId,
    object: doc.object,
    name: doc.name,
    kind: doc.kind,
    filters: doc.filters,
    sortBy: doc.sortBy,
    sortDir: doc.sortDir,
    fields: doc.fields,
    groupByField: doc.groupByField,
    isDefault: doc.isDefault,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * List every saved view for one object within a tenant, default view(s)
 * first then by name. When `userId` is supplied, returns project-shared
 * views plus that user's private views; otherwise only shared views.
 */
export async function listViews(
  projectId: string,
  object: string,
  userId?: string,
): Promise<SavedView[]> {
  if (!projectId || !object) return [];
  const col = await sabcrmViews();

  const ownership = userId
    ? { $or: [{ userId: { $exists: false } }, { userId }] }
    : { userId: { $exists: false } };

  const docs = await col
    .find({ projectId, object, ...ownership })
    .sort({ isDefault: -1, name: 1 })
    .toArray();
  return docs.map(toSavedView);
}

/**
 * Fetch a single saved view by id, scoped to the tenant. Returns `null`
 * when the id is malformed or the view belongs to another tenant.
 */
export async function getView(
  projectId: string,
  id: string,
): Promise<SavedView | null> {
  if (!projectId || !isValidId(id)) return null;
  const col = await sabcrmViews();
  const doc = await col.findOne({ _id: new ObjectId(id), projectId });
  return doc ? toSavedView(doc) : null;
}

/**
 * Create a new saved view or update an existing one in place.
 *
 * Create: a fresh document is inserted, scoped to `projectId` (and
 * `userId` when private). `kind` defaults to `table`.
 *
 * Update: `name`, `kind`, `filters`, `sortBy`, `sortDir`, `fields`,
 * `groupByField` and `isDefault` may change; the document is matched by
 * `{ _id, projectId }` so a tenant can never edit another tenant's view.
 *
 * When a view is marked `isDefault`, any other default view for the same
 * object in the tenant is demoted so exactly one default exists.
 */
export async function saveView(
  projectId: string,
  input: SaveViewInput,
): Promise<ActionResult<SavedView>> {
  if (!projectId) return { ok: false, error: 'Missing project context.' };

  const name = (input.name ?? '').trim();
  const object = (input.object ?? '').trim();
  if (!object) return { ok: false, error: 'A view must target an object.' };
  if (!name) return { ok: false, error: 'A view name is required.' };

  const col = await sabcrmViews();
  const now = new Date().toISOString();

  // ----- Update path -----
  if (input.id) {
    if (!isValidId(input.id)) {
      return { ok: false, error: 'Invalid view id.' };
    }
    const _id = new ObjectId(input.id);
    const set: Partial<SabcrmViewDoc> = { name, updatedAt: now };
    if (input.kind) set.kind = input.kind;
    if (input.filters !== undefined) set.filters = input.filters;
    if (input.sortBy !== undefined) set.sortBy = input.sortBy;
    if (input.sortDir !== undefined) set.sortDir = input.sortDir;
    if (input.fields !== undefined) set.fields = input.fields;
    if (input.groupByField !== undefined) set.groupByField = input.groupByField;
    if (input.isDefault !== undefined) set.isDefault = input.isDefault;

    if (input.isDefault === true) {
      await col.updateMany(
        { projectId, object, isDefault: true, _id: { $ne: _id } },
        { $set: { isDefault: false, updatedAt: now } },
      );
    }

    const res = await col.findOneAndUpdate(
      { _id, projectId },
      { $set: set },
      { returnDocument: 'after' },
    );
    if (!res) return { ok: false, error: 'View not found.' };
    return { ok: true, data: toSavedView(res) };
  }

  // ----- Create path -----
  if (input.isDefault === true) {
    await col.updateMany(
      { projectId, object, isDefault: true },
      { $set: { isDefault: false, updatedAt: now } },
    );
  }

  const doc: SabcrmViewDoc = {
    _id: new ObjectId(),
    projectId,
    object,
    name,
    kind: input.kind ?? 'table',
    createdAt: now,
    updatedAt: now,
  };
  if (input.userId) doc.userId = input.userId;
  if (input.filters !== undefined) doc.filters = input.filters;
  if (input.sortBy !== undefined) doc.sortBy = input.sortBy;
  if (input.sortDir !== undefined) doc.sortDir = input.sortDir;
  if (input.fields !== undefined) doc.fields = input.fields;
  if (input.groupByField !== undefined) doc.groupByField = input.groupByField;
  if (input.isDefault !== undefined) doc.isDefault = input.isDefault;

  await col.insertOne(doc);
  return { ok: true, data: toSavedView(doc) };
}

/**
 * Delete a saved view. Matched by `{ _id, projectId }` so the deletion is
 * tenant-scoped. Returns `{ ok: true }` only when a document was removed.
 */
export async function deleteView(
  projectId: string,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  if (!projectId) return { ok: false, error: 'Missing project context.' };
  if (!isValidId(id)) return { ok: false, error: 'Invalid view id.' };

  const col = await sabcrmViews();
  const res = await col.deleteOne({ _id: new ObjectId(id), projectId });
  if (res.deletedCount === 0) {
    return { ok: false, error: 'View not found.' };
  }
  return { ok: true, data: { id } };
}

/**
 * Promote a single view to be its object's default within the tenant.
 *
 * Enforces the "exactly one default per object" invariant: every sibling
 * view for the same object is demoted (`isDefault: false`) before the target
 * is promoted. Matched by `{ _id, projectId }` so the operation is
 * tenant-scoped and cannot touch another tenant's views.
 */
export async function setDefaultView(
  projectId: string,
  id: string,
): Promise<ActionResult<SavedView>> {
  if (!projectId) return { ok: false, error: 'Missing project context.' };
  if (!isValidId(id)) return { ok: false, error: 'Invalid view id.' };

  const col = await sabcrmViews();
  const _id = new ObjectId(id);

  // Locate the target first so we know which object's siblings to demote.
  const target = await col.findOne({ _id, projectId });
  if (!target) return { ok: false, error: 'View not found.' };

  const now = new Date().toISOString();

  // Demote every other default for the same object in this tenant.
  await col.updateMany(
    { projectId, object: target.object, isDefault: true, _id: { $ne: _id } },
    { $set: { isDefault: false, updatedAt: now } },
  );

  const res = await col.findOneAndUpdate(
    { _id, projectId },
    { $set: { isDefault: true, updatedAt: now } },
    { returnDocument: 'after' },
  );
  if (!res) return { ok: false, error: 'View not found.' };
  return { ok: true, data: toSavedView(res) };
}

/**
 * Duplicate an existing view under a new name.
 *
 * The clone copies the source's object, presentation `kind`, filters, sort
 * and visible field configuration, but is never marked as the default and is
 * always created as a private view owned by `userId` (the caller). The source
 * is matched by `{ _id, projectId }`, so a tenant can only clone its own
 * views. When `name` is omitted the clone is named `"<source> (copy)"`.
 */
export async function duplicateView(
  projectId: string,
  userId: string,
  id: string,
  name?: string,
): Promise<ActionResult<SavedView>> {
  if (!projectId) return { ok: false, error: 'Missing project context.' };
  if (!userId) return { ok: false, error: 'Missing user context.' };
  if (!isValidId(id)) return { ok: false, error: 'Invalid view id.' };

  const col = await sabcrmViews();
  const source = await col.findOne({ _id: new ObjectId(id), projectId });
  if (!source) return { ok: false, error: 'View not found.' };

  const now = new Date().toISOString();
  const doc: SabcrmViewDoc = {
    _id: new ObjectId(),
    projectId,
    userId,
    object: source.object,
    name: (name ?? '').trim() || `${source.name} (copy)`,
    kind: source.kind,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
  if (source.filters !== undefined) doc.filters = source.filters;
  if (source.sortBy !== undefined) doc.sortBy = source.sortBy;
  if (source.sortDir !== undefined) doc.sortDir = source.sortDir;
  if (source.fields !== undefined) doc.fields = source.fields;
  if (source.groupByField !== undefined) doc.groupByField = source.groupByField;

  await col.insertOne(doc);
  return { ok: true, data: toSavedView(doc) };
}
