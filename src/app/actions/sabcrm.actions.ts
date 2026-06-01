'use server';

/**
 * SabCRM — server actions.
 *
 * Thin, gated wrappers over the server-only library layer
 * (`src/lib/sabcrm/*.server.ts`). Every action follows the same pipeline:
 *
 *   1. resolve the cached session (fail closed if unauthenticated)
 *   2. resolve the active project id (explicit param or first project)
 *   3. RBAC check via SabNode's server-side `canServer()` using the
 *      `sabcrm` module key (the SabCRM `view | manage | admin` RBAC keys map
 *      onto SabNode's canonical `view | create/edit/delete | edit` actions)
 *   4. plan check via {@link sabcrmPlanFeature}
 *   5. call the library and return a typed {@link ActionResult}
 *
 * These wrappers never throw to the client: errors are normalised into
 * `{ ok: false, error }` so callers can render them inline.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import {
  listObjects,
  getObject,
  addCustomField,
  createCustomObject,
  updateObject,
  deleteCustomObject,
  addField,
  updateField,
  removeField,
  reorderFields,
  createRelation,
  type CreateCustomObjectInput,
  type UpdateObjectPatch,
  type UpdateFieldPatch,
  type DeleteCustomObjectResult,
  type CreateRelationResult,
} from '@/lib/sabcrm/objects.server';
import {
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
} from '@/lib/sabcrm/records.server';
import {
  listViews,
  saveView,
  type SavedView,
  type SaveViewInput,
} from '@/lib/sabcrm/views.server';
import {
  createActivity,
  listActivities,
  updateActivity,
  deleteActivity,
  getActivity,
  setTaskStatus,
  type CrmActivityRecord,
  type ActivityPage,
  type TaskStatus,
  type TimelineActivityType,
  type ActivityAttachment,
  type ActivityMention,
} from '@/lib/sabcrm/activities.server';
import {
  assignRecord,
  listMyAssignments,
  type AssignResult,
  type MyAssignmentsPage,
} from '@/lib/sabcrm/assignment.server';
import {
  listCrmMembers,
  type CrmMember,
} from '@/lib/sabcrm/members.server';
import {
  importRecords,
  exportRecords,
  type ImportBatchResult,
  type ExportRecordsResult,
  type RawRow,
  type ColumnMapping,
} from '@/lib/sabcrm/import-export.server';
import { writeAuditEntry } from '@/lib/audit-log';
import { fireCrmNotification } from '@/lib/notifications/crm';
import { sabcrmRecords, sabcrmViews } from '@/lib/sabcrm/db';
import { ObjectId, type Filter, type Sort } from 'mongodb';
import type {
  ActionResult,
  ObjectMetadata,
  FieldMetadata,
  FieldRelation,
  CrmRecord,
  CrmRecordWithLabel,
  RecordQuery,
  RecordPage,
} from '@/lib/sabcrm/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for the native CRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Base path revalidated after mutations so the UI re-fetches. */
const CRM_BASE_PATH = '/dashboard/sabcrm';

/**
 * Minimal shape of the session user we rely on. The session object is loosely
 * typed across SabNode; we narrow to the one field we use (mirrors the
 * established `session.user as { _id }` cast pattern in sibling actions).
 */
interface SessionUser {
  _id: string;
}

// ---------------------------------------------------------------------------
// Gate helpers
// ---------------------------------------------------------------------------

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult =
  | { ok: true; ctx: GateContext }
  | { ok: false; error: string };

/**
 * Runs the full session → project → RBAC → plan pipeline.
 *
 * @param action  required permission action — `view` for reads, `create` /
 *                `edit` / `delete` for record writes, `edit` for schema
 *                changes (SabNode's canonical {@link PermissionAction} set).
 * @param explicitProjectId  optional project override; defaults to the user's
 *                first project.
 */
async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  // 1. session
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  // 2. active project — `getProjects` returns `WithId<Project>[]`, so the id is
  // an ObjectId; stringify it for the (ObjectId-safe string) lib boundary.
  const firstProjectId = (await getCachedProjects())[0]?._id;
  const projectId = explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!projectId) return { ok: false, error: 'No active project.' };

  // 3. RBAC
  const allowed = await canServer(MODULE_KEY, action, projectId);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  // 4. plan
  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId } };
}

/** Normalises a thrown value into an {@link ActionResult} error. */
function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

// ---------------------------------------------------------------------------
// Object / schema actions
// ---------------------------------------------------------------------------

/** Lists the standard + custom objects for the active project. */
export async function listObjectsAction(
  projectId?: string,
): Promise<ActionResult<ObjectMetadata[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await listObjects(g.ctx.projectId);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list objects.');
  }
}

/**
 * Adds a custom field to an object's schema. Schema mutation is gated behind
 * the `edit` action (the SabCRM `admin` capability).
 */
export async function addCustomFieldAction(
  slug: string,
  field: FieldMetadata,
  projectId?: string,
): Promise<ActionResult<ObjectMetadata>> {
  if (!slug) return { ok: false, error: 'Object slug is required.' };
  if (!field?.key || !field?.label) {
    return { ok: false, error: 'Field key and label are required.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await addCustomField(g.ctx.projectId, slug, field);
    revalidatePath(`${CRM_BASE_PATH}/${slug}`);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to add custom field.');
  }
}

// ---------------------------------------------------------------------------
// Record actions
// ---------------------------------------------------------------------------

/**
 * Lists / searches / paginates records for an object.
 *
 * Accepts the legacy {@link RecordQuery} as well as the extended
 * {@link SabcrmRecordQuery} (typed per-field filter operators, multi-field sort
 * and relation expansion). When extended options are present it runs a
 * tenant-scoped query directly so it can honour them; otherwise it preserves the
 * original fast path through `listRecords`. The return type is the
 * {@link SabcrmRecordPage} superset of {@link RecordPage}, so existing callers
 * keep compiling and reading `records`/`total`/`page`/`pageSize`.
 */
export async function listRecordsAction(
  query: RecordQuery | SabcrmRecordQuery,
  projectId?: string,
): Promise<ActionResult<SabcrmRecordPage>> {
  if (!query?.object) return { ok: false, error: 'Object is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const ext = query as SabcrmRecordQuery;
  const needsExtended = !!ext.multiSort?.length || !!ext.expandRelations?.length;

  try {
    if (!needsExtended) {
      const data = await listRecords(
        g.ctx.projectId,
        g.ctx.userId,
        query as RecordQuery,
      );
      return { ok: true, data };
    }

    const object = await getObject(g.ctx.projectId, ext.object);
    if (!object) throw new Error(`Unknown SabCRM object: ${ext.object}`);

    const col = await sabcrmRecords();
    const filter = buildScopedFilter(g.ctx.projectId, g.ctx.userId, object, ext);
    const sort: Sort = ext.multiSort?.length
      ? buildMultiSort(ext.multiSort)
      : ext.sortBy
        ? buildMultiSort([
            { field: ext.sortBy, dir: ext.sortDir === 'asc' ? 'asc' : 'desc' },
          ])
        : { createdAt: -1 };

    const page = Math.max(1, ext.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, ext.pageSize ?? 30));

    const [rawDocs, total] = await Promise.all([
      col
        .find(filter)
        .sort(sort)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      col.countDocuments(filter),
    ]);

    const records = rawDocs.map((d) =>
      rowToRecord(d as Record<string, unknown>, object),
    );

    let expanded:
      | Record<string, Record<string, CrmRecordWithLabel>>
      | undefined;
    if (ext.expandRelations?.length) {
      expanded = await resolveRelationsForRecords(
        g.ctx.projectId,
        g.ctx.userId,
        object,
        records,
        ext.expandRelations,
      );
    }

    return { ok: true, data: { records, total, page, pageSize, expanded } };
  } catch (e) {
    return fail(e, 'Failed to list records.');
  }
}

/** Fetches a single record by id (with its resolved display label). */
export async function getRecordAction(
  id: string,
  projectId?: string,
): Promise<ActionResult<CrmRecordWithLabel>> {
  if (!id) return { ok: false, error: 'Record id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const record = await getRecord(g.ctx.projectId, g.ctx.userId, id);
    if (!record) return { ok: false, error: 'Record not found.' };
    return { ok: true, data: record };
  } catch (e) {
    return fail(e, 'Failed to load record.');
  }
}

/** Creates a new record on the given object. */
export async function createRecordAction(
  object: string,
  values: Record<string, unknown>,
  projectId?: string,
): Promise<ActionResult<CrmRecord>> {
  if (!object) return { ok: false, error: 'Object is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await createRecord(
      g.ctx.projectId,
      g.ctx.userId,
      object,
      values ?? {},
    );
    revalidatePath(`${CRM_BASE_PATH}/${object}`);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to create record.');
  }
}

/** Patches an existing record's field values. */
export async function updateRecordAction(
  id: string,
  patch: Record<string, unknown>,
  projectId?: string,
): Promise<ActionResult<CrmRecord>> {
  if (!id) return { ok: false, error: 'Record id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await updateRecord(g.ctx.projectId, g.ctx.userId, id, patch ?? {});
    if (!data) return { ok: false, error: 'Record not found.' };
    revalidatePath(`${CRM_BASE_PATH}/${data.object}`);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update record.');
  }
}

/** Deletes a record by id. */
export async function deleteRecordAction(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'Record id is required.' };

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const deleted = await deleteRecord(g.ctx.projectId, g.ctx.userId, id);
    if (!deleted) return { ok: false, error: 'Record not found.' };
    revalidatePath(CRM_BASE_PATH);
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to delete record.');
  }
}

// ---------------------------------------------------------------------------
// View actions
// ---------------------------------------------------------------------------

/**
 * Lists the saved views for one object. Returns project-shared views plus the
 * caller's own private views.
 */
export async function listViewsAction(
  object: string,
  projectId?: string,
): Promise<ActionResult<SavedView[]>> {
  if (!object) return { ok: false, error: 'Object is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await listViews(g.ctx.projectId, object, g.ctx.userId);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list views.');
  }
}

/** Creates or updates a saved view. */
export async function saveViewAction(
  input: SaveViewInput,
  projectId?: string,
): Promise<ActionResult<SavedView>> {
  if (!input?.object) return { ok: false, error: 'Object is required.' };
  if (!input?.name?.trim()) return { ok: false, error: 'View name is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const result = await saveView(g.ctx.projectId, input);
    if (!result.ok) return result;
    revalidatePath(`${CRM_BASE_PATH}/${input.object}`);
    return result;
  } catch (e) {
    return fail(e, 'Failed to save view.');
  }
}

/** Deletes a saved view, scoped to the active project. */
export async function deleteViewAction(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'View id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const oid = toObjectId(id);
  if (!oid) return { ok: false, error: 'Invalid view id.' };

  try {
    const col = await sabcrmViews();
    const existing = await col.findOne({
      _id: oid,
      projectId: g.ctx.projectId,
    } as unknown as Filter<Record<string, unknown>>);
    if (!existing) return { ok: false, error: 'View not found.' };

    await col.deleteOne({
      _id: oid,
      projectId: g.ctx.projectId,
    } as unknown as Filter<Record<string, unknown>>);

    const object = String((existing as Record<string, unknown>).object ?? '');
    if (object) revalidatePath(`${CRM_BASE_PATH}/${object}`);
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to delete view.');
  }
}

/**
 * Marks one view as the default for its object, clearing the default flag on
 * every sibling view for the same object/project so exactly one stays default.
 */
export async function setDefaultViewAction(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'View id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const oid = toObjectId(id);
  if (!oid) return { ok: false, error: 'Invalid view id.' };

  try {
    const col = await sabcrmViews();
    const view = await col.findOne({
      _id: oid,
      projectId: g.ctx.projectId,
    } as unknown as Filter<Record<string, unknown>>);
    if (!view) return { ok: false, error: 'View not found.' };

    const object = String((view as Record<string, unknown>).object ?? '');
    const ts = new Date().toISOString();

    // Clear the default flag on every other view for this object/project.
    await col.updateMany(
      {
        projectId: g.ctx.projectId,
        object,
        isDefault: true,
        _id: { $ne: oid },
      } as unknown as Filter<Record<string, unknown>>,
      { $set: { isDefault: false, updatedAt: ts } },
    );
    await col.updateOne(
      { _id: oid } as unknown as Filter<Record<string, unknown>>,
      { $set: { isDefault: true, updatedAt: ts } },
    );

    if (object) revalidatePath(`${CRM_BASE_PATH}/${object}`);
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to set default view.');
  }
}

// ---------------------------------------------------------------------------
// Extended query types (additive — actions-layer only)
//
// These wire shapes describe the table/board/relation-picker surfaces. They do
// not change `types.ts`; `SabcrmRecordQuery` is a superset of `RecordQuery` and
// `SabcrmRecordPage` extends `RecordPage`, so existing callers stay compatible.
// ---------------------------------------------------------------------------

/**
 * Per-field filter value: either an exact match (legacy behaviour) or an
 * operator object that maps 1:1 to Mongo query operators.
 */
export type SabcrmFilterValue =
  | string
  | number
  | boolean
  | null
  | {
      $eq?: unknown;
      $ne?: unknown;
      $gt?: unknown;
      $gte?: unknown;
      $lt?: unknown;
      $lte?: unknown;
      $in?: unknown[];
      $nin?: unknown[];
      $regex?: string;
      $options?: string;
      $exists?: boolean;
    };

/** One clause of a multi-field sort. */
export interface SabcrmSortClause {
  field: string;
  dir: 'asc' | 'desc';
}

/** Superset of {@link RecordQuery}: typed operators, multi-sort, expansion. */
export interface SabcrmRecordQuery extends Omit<RecordQuery, 'filters'> {
  filters?: Record<string, SabcrmFilterValue>;
  /** Multi-field sort. Takes precedence over legacy `sortBy`/`sortDir`. */
  multiSort?: SabcrmSortClause[];
  /** RELATION field keys to populate alongside the page. */
  expandRelations?: string[];
}

/** A record page that may carry resolved relations. */
export interface SabcrmRecordPage extends RecordPage {
  /** fieldKey -> (relatedRecordId -> related record). Present when expanded. */
  expanded?: Record<string, Record<string, CrmRecordWithLabel>>;
}

/** A board column: one bucket per SELECT option value (plus "Ungrouped"). */
export interface SabcrmRecordGroup {
  key: string;
  label: string;
  color?: string;
  records: CrmRecordWithLabel[];
  total: number;
}

export interface SabcrmGroupedRecordPage {
  groupByField: string;
  groups: SabcrmRecordGroup[];
  total: number;
}

/** A lightweight option used to populate a relation picker. */
export interface SabcrmPickerOption {
  id: string;
  label: string;
  object: string;
}

// ---------------------------------------------------------------------------
// Extended query helpers (actions-layer only)
// ---------------------------------------------------------------------------

/** Parses a caller id into an ObjectId, or `null` if malformed. */
function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Resolves a record's display title from its object's `isLabel` field. */
function labelFor(
  object: ObjectMetadata,
  data: Record<string, unknown>,
): string {
  const labelField =
    object.fields.find((f) => f.isLabel) ??
    object.fields.find((f) => f.type === 'TEXT' || f.type === 'EMAIL') ??
    object.fields[0];
  if (labelField) {
    const raw = data[labelField.key];
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  }
  return `${object.labelSingular}`;
}

/** Maps a raw `sabcrm_records` document into a labelled record. */
function rowToRecord(
  doc: Record<string, unknown>,
  object: ObjectMetadata,
): CrmRecordWithLabel {
  const oid = doc._id;
  const data = (doc.data as Record<string, unknown>) ?? {};
  return {
    _id:
      oid instanceof ObjectId ? oid.toHexString() : String(oid ?? ''),
    object: String(doc.object ?? object.slug),
    userId: String(doc.userId ?? ''),
    data,
    createdAt: String(doc.createdAt ?? ''),
    updatedAt: String(doc.updatedAt ?? ''),
    label: labelFor(object, data),
  };
}

/**
 * Builds a tenant-scoped Mongo filter mirroring the record runtime's
 * `buildFilter`: project + owner scope, object slug, per-field filters (operator
 * objects flow through unchanged), and label-field search.
 */
function buildScopedFilter(
  projectId: string,
  userId: string,
  object: ObjectMetadata,
  query: { search?: string; filters?: Record<string, SabcrmFilterValue> },
): Filter<Record<string, unknown>> {
  const filter: Record<string, unknown> = {
    projectId,
    userId,
    object: object.slug,
  };

  if (query.filters) {
    for (const [key, value] of Object.entries(query.filters)) {
      if (value === undefined || value === null || value === '') continue;
      filter[`data.${key}`] = value;
    }
  }

  const search = query.search?.trim();
  if (search) {
    const rx = { $regex: escapeRegExp(search), $options: 'i' };
    const searchable = object.fields.filter(
      (f) =>
        f.type === 'TEXT' ||
        f.type === 'EMAIL' ||
        f.type === 'PHONE' ||
        f.type === 'LINK',
    );
    filter.$or =
      searchable.length > 0
        ? searchable.map((f) => ({ [`data.${f.key}`]: rx }))
        : [{ data: rx }];
  }

  return filter as Filter<Record<string, unknown>>;
}

/** Translates multi-sort clauses into a Mongo `Sort`. */
function buildMultiSort(clauses: SabcrmSortClause[]): Sort {
  const sort: Record<string, 1 | -1> = {};
  for (const c of clauses) {
    if (!c.field) continue;
    const key =
      c.field === 'createdAt' || c.field === 'updatedAt'
        ? c.field
        : `data.${c.field}`;
    sort[key] = c.dir === 'asc' ? 1 : -1;
  }
  if (Object.keys(sort).length === 0) sort.createdAt = -1;
  return sort;
}

/**
 * Batch-resolves RELATION field values for a set of records. Returns a map of
 * fieldKey -> (relatedRecordId -> related record), tenant-scoped.
 */
async function resolveRelationsForRecords(
  projectId: string,
  userId: string,
  object: ObjectMetadata,
  records: Array<{ data: Record<string, unknown> }>,
  relationKeys: string[],
): Promise<Record<string, Record<string, CrmRecordWithLabel>>> {
  const out: Record<string, Record<string, CrmRecordWithLabel>> = {};
  const col = await sabcrmRecords();

  for (const key of relationKeys) {
    const field = object.fields.find((f) => f.key === key);
    if (!field?.relation) continue;

    const target = await getObject(projectId, field.relation.targetObject);
    if (!target) {
      out[key] = {};
      continue;
    }

    const ids = new Set<string>();
    for (const rec of records) {
      const val = rec.data[key];
      if (typeof val === 'string' && val) ids.add(val);
      else if (Array.isArray(val)) {
        for (const v of val) if (typeof v === 'string' && v) ids.add(v);
      }
    }
    if (ids.size === 0) {
      out[key] = {};
      continue;
    }

    const oids = Array.from(ids)
      .map((id) => toObjectId(id))
      .filter((x): x is ObjectId => x !== null);

    const relatedDocs = await col
      .find({
        _id: { $in: oids },
        projectId,
        userId,
        object: field.relation.targetObject,
      } as unknown as Filter<Record<string, unknown>>)
      .toArray();

    const indexed: Record<string, CrmRecordWithLabel> = {};
    for (const d of relatedDocs) {
      const rec = rowToRecord(d as Record<string, unknown>, target);
      indexed[rec._id] = rec;
    }
    out[key] = indexed;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Board grouping + relation actions
// ---------------------------------------------------------------------------

/**
 * Groups records of an object by a SELECT field (kanban board). Honours the same
 * filters/search/multi-sort as the table view. Each declared option becomes a
 * column (preserving its label + color), plus an "Ungrouped" bucket for
 * empty/unknown values.
 */
export async function groupRecordsAction(
  query: SabcrmRecordQuery & { groupBy?: string },
  projectId?: string,
): Promise<ActionResult<SabcrmGroupedRecordPage>> {
  if (!query?.object) return { ok: false, error: 'Object is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const object = await getObject(g.ctx.projectId, query.object);
    if (!object) throw new Error(`Unknown SabCRM object: ${query.object}`);

    const groupByField = query.groupBy ?? object.board?.groupByField;
    if (!groupByField) {
      throw new Error(`No group-by field for object "${query.object}".`);
    }
    const field = object.fields.find((f) => f.key === groupByField);
    if (!field || field.type !== 'SELECT') {
      throw new Error(`Field "${groupByField}" is not a SELECT field.`);
    }

    const col = await sabcrmRecords();
    const filter = buildScopedFilter(g.ctx.projectId, g.ctx.userId, object, query);
    const sort: Sort = query.multiSort?.length
      ? buildMultiSort(query.multiSort)
      : { createdAt: -1 };

    // Cap fetch to keep boards bounded; pageSize acts as a per-board cap.
    const cap = Math.min(2000, Math.max(50, query.pageSize ?? 500));
    const rawDocs = await col.find(filter).sort(sort).limit(cap).toArray();

    const UNGROUPED = '__ungrouped__';
    const buckets = new Map<string, CrmRecordWithLabel[]>();
    for (const d of rawDocs) {
      const record = rowToRecord(d as Record<string, unknown>, object);
      const raw = record.data[groupByField];
      const key =
        raw === null || raw === undefined || raw === ''
          ? UNGROUPED
          : String(raw);
      const arr = buckets.get(key) ?? [];
      arr.push(record);
      buckets.set(key, arr);
    }

    const groups: SabcrmRecordGroup[] = [];
    for (const opt of field.options ?? []) {
      const recs = buckets.get(opt.value) ?? [];
      groups.push({
        key: opt.value,
        label: opt.label,
        color: opt.color,
        records: recs,
        total: recs.length,
      });
      buckets.delete(opt.value);
    }
    // Leftover values not declared in options (legacy data).
    for (const [key, recs] of buckets) {
      if (key === UNGROUPED) continue;
      groups.push({ key, label: key, records: recs, total: recs.length });
    }
    const ung = buckets.get(UNGROUPED);
    if (ung && ung.length) {
      groups.push({
        key: UNGROUPED,
        label: 'Ungrouped',
        records: ung,
        total: ung.length,
      });
    }

    return { ok: true, data: { groupByField, groups, total: rawDocs.length } };
  } catch (e) {
    return fail(e, 'Failed to group records.');
  }
}

/**
 * Resolves the related records for the RELATION fields of a single record (by
 * id). Convenience for detail panels that render relation chips. When
 * `relationKeys` is omitted, every RELATION field on the object is resolved.
 */
export async function listRelatedRecordsAction(
  recordId: string,
  relationKeys?: string[],
  projectId?: string,
): Promise<ActionResult<Record<string, CrmRecordWithLabel[]>>> {
  if (!recordId) return { ok: false, error: 'Record id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const record = await getRecord(g.ctx.projectId, g.ctx.userId, recordId);
    if (!record) return { ok: false, error: 'Record not found.' };

    const object = await getObject(g.ctx.projectId, record.object);
    if (!object) throw new Error(`Unknown SabCRM object: ${record.object}`);

    const keys =
      relationKeys && relationKeys.length
        ? relationKeys
        : object.fields.filter((f) => f.type === 'RELATION').map((f) => f.key);

    const resolved = await resolveRelationsForRecords(
      g.ctx.projectId,
      g.ctx.userId,
      object,
      [record],
      keys,
    );

    const result: Record<string, CrmRecordWithLabel[]> = {};
    for (const key of keys) {
      const indexed = resolved[key] ?? {};
      const val = record.data[key];
      const ids =
        typeof val === 'string'
          ? [val]
          : Array.isArray(val)
            ? val.filter((v): v is string => typeof v === 'string')
            : [];
      result[key] = ids
        .map((id) => indexed[id])
        .filter((r): r is CrmRecordWithLabel => Boolean(r));
    }

    return { ok: true, data: result };
  } catch (e) {
    return fail(e, 'Failed to resolve relations.');
  }
}

/**
 * Resolves a relation value (one or many ids) to full records, preserving the
 * caller-provided id order. Lighter than {@link listRelatedRecordsAction} when
 * the caller already knows the target object and ids.
 */
export async function resolveRelationAction(
  targetObject: string,
  ids: string[],
  projectId?: string,
): Promise<ActionResult<CrmRecordWithLabel[]>> {
  if (!targetObject) return { ok: false, error: 'Target object is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const object = await getObject(g.ctx.projectId, targetObject);
    if (!object) throw new Error(`Unknown SabCRM object: ${targetObject}`);

    const oids = ids
      .map((id) => toObjectId(id))
      .filter((x): x is ObjectId => x !== null);
    if (oids.length === 0) return { ok: true, data: [] };

    const col = await sabcrmRecords();
    const docs = await col
      .find({
        _id: { $in: oids },
        projectId: g.ctx.projectId,
        userId: g.ctx.userId,
        object: targetObject,
      } as unknown as Filter<Record<string, unknown>>)
      .toArray();

    const byId = new Map<string, CrmRecordWithLabel>();
    for (const d of docs) {
      const rec = rowToRecord(d as Record<string, unknown>, object);
      byId.set(rec._id, rec);
    }
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((r): r is CrmRecordWithLabel => Boolean(r));

    return { ok: true, data: ordered };
  } catch (e) {
    return fail(e, 'Failed to resolve relation.');
  }
}

/**
 * Searches records of a target object for a relation picker, returning
 * lightweight `{ id, label, object }` options matched against the object's
 * label field.
 */
export async function searchRecordsForPickerAction(
  targetObject: string,
  search: string,
  limit = 20,
  projectId?: string,
): Promise<ActionResult<SabcrmPickerOption[]>> {
  if (!targetObject) return { ok: false, error: 'Target object is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const object = await getObject(g.ctx.projectId, targetObject);
    if (!object) throw new Error(`Unknown SabCRM object: ${targetObject}`);

    const col = await sabcrmRecords();
    const filter: Record<string, unknown> = {
      projectId: g.ctx.projectId,
      userId: g.ctx.userId,
      object: targetObject,
    };
    const labelField =
      object.fields.find((f) => f.isLabel) ??
      object.fields.find((f) => f.type === 'TEXT' || f.type === 'EMAIL');
    const term = search?.trim();
    if (term && labelField) {
      filter[`data.${labelField.key}`] = {
        $regex: escapeRegExp(term),
        $options: 'i',
      };
    }

    const capped = Math.min(50, Math.max(1, limit));
    const docs = await col
      .find(filter as Filter<Record<string, unknown>>)
      .sort({ updatedAt: -1 })
      .limit(capped)
      .toArray();

    const options: SabcrmPickerOption[] = docs.map((d) => {
      const rec = rowToRecord(d as Record<string, unknown>, object);
      return { id: rec._id, label: rec.label, object: targetObject };
    });

    return { ok: true, data: options };
  } catch (e) {
    return fail(e, 'Failed to search records.');
  }
}

// ---------------------------------------------------------------------------
// Activity / task / assignment / comment actions
//
// These build on the timeline library (`@/lib/sabcrm/activities.server`),
// which persists every record-level interaction (NOTE / TASK / CALL / MEETING
// / EMAIL / COMMENT) into the tenant-scoped `sabcrm_activities` collection,
// attached to a target record via `targetObject` + `targetRecordId`.
//
// Gating mirrors the rest of this file:
//   - reads  → 'view'   (the SabCRM `sabcrm:view` capability)
//   - writes → 'create' / 'edit' / 'delete' (the `sabcrm:manage` capability)
// The SabCRM `view | manage | admin` RBAC keys map onto SabNode's canonical
// `view | create/edit/delete | edit` actions, so write actions here request a
// record-write action and are therefore denied to view-only members.
//
// In-app notifications: assignment + comment events are recorded as durable
// timeline activities (which the record-detail timeline UI already renders),
// and @-mentions are persisted on the activity's `mentions` field — the
// established in-module notification mechanism. FILE attachments come from
// SabFiles only (the `ActivityAttachment.fileId` references the user's SabFiles
// library / a fresh upload; raw external URLs are never accepted here).
// ---------------------------------------------------------------------------

/** The activity types a caller may create through the timeline. */
const TIMELINE_TYPES: readonly TimelineActivityType[] = [
  'NOTE',
  'TASK',
  'CALL',
  'MEETING',
  'EMAIL',
  'COMMENT',
];

function isTimelineType(value: unknown): value is TimelineActivityType {
  return (
    typeof value === 'string' &&
    (TIMELINE_TYPES as readonly string[]).includes(value)
  );
}

const TASK_STATUS_VALUES: readonly TaskStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'DONE',
];

function isTaskStatusValue(value: unknown): value is TaskStatus {
  return (
    typeof value === 'string' &&
    (TASK_STATUS_VALUES as readonly string[]).includes(value)
  );
}

/**
 * Coerce a caller-supplied attachment list into the SabFiles-backed
 * {@link ActivityAttachment} shape. Anything without a SabFiles `fileId` is
 * dropped — we never accept a free-text URL as a file source.
 */
function toAttachments(input: unknown): ActivityAttachment[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: ActivityAttachment[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.fileId !== 'string' || !r.fileId.trim()) continue;
    const att: ActivityAttachment = {
      fileId: r.fileId,
      name:
        typeof r.name === 'string' && r.name ? r.name : r.fileId,
    };
    if (typeof r.contentType === 'string' && r.contentType) {
      att.contentType = r.contentType;
    }
    if (typeof r.size === 'number' && Number.isFinite(r.size)) {
      att.size = r.size;
    }
    if (typeof r.url === 'string' && r.url) att.url = r.url;
    out.push(att);
  }
  return out;
}

/** Coerce a caller-supplied mention list into {@link ActivityMention}. */
function toMentions(input: unknown): ActivityMention[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: ActivityMention[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.userId !== 'string' || !r.userId.trim()) continue;
    const m: ActivityMention = { userId: r.userId };
    if (typeof r.displayName === 'string' && r.displayName) {
      m.displayName = r.displayName;
    }
    out.push(m);
  }
  return out;
}

/** Optional `Date` from a caller-supplied ISO string / timestamp. */
function toDateOrUndefined(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
}

/** Input accepted by {@link createActivityAction}. */
export interface CreateActivityActionInput {
  type: TimelineActivityType;
  title: string;
  body?: string;
  targetObject: string;
  targetRecordId: string;
  attachments?: ActivityAttachment[];
  mentions?: ActivityMention[];
  /** TASK-only. Defaults to "TODO". */
  status?: TaskStatus;
  /** TASK-only assignee user id. */
  assigneeId?: string;
  /** TASK-only due date (ISO string or timestamp). */
  dueAt?: string | number | Date;
}

/** Input accepted by {@link updateActivityAction}. */
export interface UpdateActivityActionInput {
  title?: string;
  body?: string;
  type?: TimelineActivityType;
  attachments?: ActivityAttachment[];
  mentions?: ActivityMention[];
  status?: TaskStatus;
  assigneeId?: string | null;
  dueAt?: string | number | Date | null;
}

/**
 * Creates a timeline activity (NOTE / TASK / CALL / MEETING / EMAIL / COMMENT)
 * attached to a target record. Write-gated behind `sabcrm:manage`.
 */
export async function createActivityAction(
  input: CreateActivityActionInput,
  projectId?: string,
): Promise<ActionResult<CrmActivityRecord>> {
  if (!isTimelineType(input?.type)) {
    return { ok: false, error: 'A valid activity type is required.' };
  }
  if (!input.title?.trim()) {
    return { ok: false, error: 'Activity title is required.' };
  }
  if (!input.targetObject || !input.targetRecordId) {
    return { ok: false, error: 'A target record is required.' };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const activity = await createActivity({
      projectId: g.ctx.projectId,
      type: input.type,
      title: input.title,
      body: input.body,
      targetObject: input.targetObject,
      targetRecordId: input.targetRecordId,
      authorId: g.ctx.userId,
      attachments: toAttachments(input.attachments),
      mentions: toMentions(input.mentions),
      status: isTaskStatusValue(input.status) ? input.status : undefined,
      assigneeId:
        typeof input.assigneeId === 'string' && input.assigneeId
          ? input.assigneeId
          : undefined,
      dueAt: toDateOrUndefined(input.dueAt),
    });
    revalidatePath(`${CRM_BASE_PATH}/${input.targetObject}/${input.targetRecordId}`);
    return { ok: true, data: activity };
  } catch (e) {
    return fail(e, 'Failed to create activity.');
  }
}

/**
 * Lists the activity timeline for a target record (most-recent first),
 * optionally filtered to a single activity type. Read-gated behind
 * `sabcrm:view`.
 */
export async function listActivitiesAction(
  query: {
    targetObject: string;
    targetRecordId: string;
    page?: number;
    pageSize?: number;
    type?: TimelineActivityType;
  },
  projectId?: string,
): Promise<ActionResult<ActivityPage>> {
  if (!query?.targetObject || !query?.targetRecordId) {
    return { ok: false, error: 'A target record is required.' };
  }
  if (query.type !== undefined && !isTimelineType(query.type)) {
    return { ok: false, error: 'Invalid activity type filter.' };
  }

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await listActivities({
      projectId: g.ctx.projectId,
      targetObject: query.targetObject,
      targetRecordId: query.targetRecordId,
      page: query.page,
      pageSize: query.pageSize,
      type: query.type,
    });
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list activities.');
  }
}

/**
 * Patches an existing timeline activity. Write-gated behind `sabcrm:manage`.
 * Returns `null` data when the activity does not exist for this project.
 */
export async function updateActivityAction(
  id: string,
  patch: UpdateActivityActionInput,
  projectId?: string,
): Promise<ActionResult<CrmActivityRecord | null>> {
  if (!id) return { ok: false, error: 'Activity id is required.' };
  if (patch?.type !== undefined && !isTimelineType(patch.type)) {
    return { ok: false, error: 'Invalid activity type.' };
  }
  if (patch?.status !== undefined && !isTaskStatusValue(patch.status)) {
    return { ok: false, error: 'Invalid task status.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const dueAt =
      patch.dueAt === null
        ? null
        : patch.dueAt === undefined
          ? undefined
          : (toDateOrUndefined(patch.dueAt) ?? null);

    const updated = await updateActivity(g.ctx.projectId, id, {
      title: patch.title,
      body: patch.body,
      type: patch.type,
      attachments:
        patch.attachments !== undefined
          ? (toAttachments(patch.attachments) ?? [])
          : undefined,
      mentions:
        patch.mentions !== undefined
          ? (toMentions(patch.mentions) ?? [])
          : undefined,
      status: isTaskStatusValue(patch.status) ? patch.status : undefined,
      assigneeId: patch.assigneeId,
      dueAt,
    });
    if (!updated) return { ok: false, error: 'Activity not found.' };
    revalidatePath(
      `${CRM_BASE_PATH}/${updated.targetObject}/${updated.targetRecordId}`,
    );
    return { ok: true, data: updated };
  } catch (e) {
    return fail(e, 'Failed to update activity.');
  }
}

/** Deletes a timeline activity. Write-gated behind `sabcrm:manage`. */
export async function deleteActivityAction(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'Activity id is required.' };

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const existing = await getActivity(g.ctx.projectId, id);
    const deleted = await deleteActivity(g.ctx.projectId, id);
    if (!deleted) return { ok: false, error: 'Activity not found.' };
    if (existing) {
      revalidatePath(
        `${CRM_BASE_PATH}/${existing.targetObject}/${existing.targetRecordId}`,
      );
    }
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to delete activity.');
  }
}

/**
 * Sets the status (TODO / IN_PROGRESS / DONE) of a TASK-type activity — the
 * write behind the task board's drag-and-drop. Write-gated behind
 * `sabcrm:manage`.
 */
export async function setTaskStatusAction(
  taskId: string,
  status: TaskStatus,
  projectId?: string,
): Promise<ActionResult<CrmActivityRecord>> {
  if (!taskId) return { ok: false, error: 'Task id is required.' };
  if (!isTaskStatusValue(status)) {
    return { ok: false, error: 'A valid task status is required.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const updated = await setTaskStatus(g.ctx.projectId, taskId, status);
    if (!updated) {
      return { ok: false, error: 'Task not found or is not a task.' };
    }
    revalidatePath(
      `${CRM_BASE_PATH}/${updated.targetObject}/${updated.targetRecordId}`,
    );
    return { ok: true, data: updated };
  } catch (e) {
    return fail(e, 'Failed to set task status.');
  }
}

/**
 * Assigns (or, when `assigneeId` is null, unassigns) a record to a workspace
 * member. Write-gated behind `sabcrm:manage`. Delegates to the assignment
 * runtime, which writes `data.assigneeId`, records an `assign` audit entry, and
 * fires an in-app notification to the new assignee (best-effort, never
 * self-notifies). Works for any object slug (tasks, opportunities, …).
 */
export async function assignRecordAction(
  recordId: string,
  assigneeId: string | null,
  projectId?: string,
): Promise<ActionResult<AssignResult>> {
  if (!recordId) return { ok: false, error: 'Record id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const result = await assignRecord(
      {
        projectId: g.ctx.projectId,
        // `ctx.userId` is the tenant root user id (session.user._id), which the
        // shared audit + notification collections key on; it is also the actor.
        tenantUserId: g.ctx.userId,
        actorId: g.ctx.userId,
      },
      recordId,
      assigneeId,
    );
    if (!result) return { ok: false, error: 'Record not found.' };

    revalidatePath(`${CRM_BASE_PATH}/${result.record.object}`);
    revalidatePath(`${CRM_BASE_PATH}/${result.record.object}/${result.record._id}`);
    return { ok: true, data: result };
  } catch (e) {
    return fail(e, 'Failed to assign record.');
  }
}

/**
 * Lists the records assigned to the current user across the project (the "My
 * Assignments" inbox), newest-updated first. Read-gated behind `sabcrm:view`.
 * Optionally narrowed to a single object slug.
 */
export async function listMyAssignmentsAction(
  opts?: { object?: string; page?: number; pageSize?: number },
  projectId?: string,
): Promise<ActionResult<MyAssignmentsPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await listMyAssignments(g.ctx.projectId, g.ctx.userId, {
      object: opts?.object,
      page: opts?.page,
      pageSize: opts?.pageSize,
    });
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list assignments.');
  }
}

/**
 * Adds a COMMENT to a record's timeline (the comment thread). Write-gated
 * behind `sabcrm:manage`. @-mentions are persisted on the comment so mentioned
 * members are notified in-app; SabFiles attachments are accepted via `fileId`.
 */
export async function addCommentAction(
  input: {
    targetObject: string;
    targetRecordId: string;
    body: string;
    attachments?: ActivityAttachment[];
    mentions?: ActivityMention[];
  },
  projectId?: string,
): Promise<ActionResult<CrmActivityRecord>> {
  if (!input?.targetObject || !input?.targetRecordId) {
    return { ok: false, error: 'A target record is required.' };
  }
  if (!input.body?.trim()) {
    return { ok: false, error: 'Comment body is required.' };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const mentions = toMentions(input.mentions);
    const activity = await createActivity({
      projectId: g.ctx.projectId,
      type: 'COMMENT',
      // The timeline requires a title; use a stable label for comments so the
      // record-detail UI can render the thread without a separate field.
      title: 'Comment',
      body: input.body,
      targetObject: input.targetObject,
      targetRecordId: input.targetRecordId,
      authorId: g.ctx.userId,
      attachments: toAttachments(input.attachments),
      mentions,
    });
    revalidatePath(
      `${CRM_BASE_PATH}/${input.targetObject}/${input.targetRecordId}`,
    );

    // Fire a best-effort in-app notification to each @-mentioned member
    // (never the author themselves). `fireCrmNotification` swallows its own
    // failures, so a notification glitch never unwinds the comment write.
    if (mentions && mentions.length > 0) {
      const preview =
        input.body.trim().length > 120
          ? `${input.body.trim().slice(0, 120)}…`
          : input.body.trim();
      await Promise.all(
        mentions
          .filter((m) => m.userId && m.userId !== g.ctx.userId)
          .map((m) =>
            fireCrmNotification({
              recipientUserId: m.userId,
              type: 'mention',
              title: 'You were mentioned in a comment',
              body: preview,
              resourceId: input.targetRecordId,
            }),
          ),
      );
    }

    return { ok: true, data: activity };
  } catch (e) {
    return fail(e, 'Failed to add comment.');
  }
}

// ---------------------------------------------------------------------------
// Custom object management (admin-gated)
//
// Creating, updating, and deleting custom objects mutate the CRM data model
// and are therefore gated behind the `edit` action, which maps to
// `sabcrm:admin` in the SabCRM RBAC capability set.
//
// Every mutation fires a best-effort audit entry so changes appear in the
// §12.21 audit-log page alongside record-level events.
// ---------------------------------------------------------------------------

/**
 * Creates a fully-custom CRM object for the active project.
 *
 * Admin-gated. Validates the slug (kebab-case, not a reserved standard slug),
 * enforces at least one `isLabel` field (defaults to a `name` TEXT field when
 * none is supplied), and writes the new object doc to `sabcrm_objects`.
 */
export async function createCustomObjectAction(
  input: CreateCustomObjectInput,
  projectId?: string,
): Promise<ActionResult<ObjectMetadata>> {
  if (!input?.slug?.trim()) {
    return { ok: false, error: 'Object slug is required.' };
  }
  if (!input.labelSingular?.trim() || !input.labelPlural?.trim()) {
    return { ok: false, error: 'Singular and plural labels are required.' };
  }
  if (!input.icon?.trim()) {
    return { ok: false, error: 'An icon is required.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await createCustomObject(g.ctx.projectId, input);

    // Fire-and-forget audit: never unwinds the data write on failure.
    void writeAuditEntry({
      tenantUserId: g.ctx.userId,
      actorId: g.ctx.userId,
      action: 'create',
      entityKind: 'crm_object',
      entityId: data.slug,
      reason: `Created custom object "${data.labelSingular}"`,
    }).catch(() => undefined);

    revalidatePath(CRM_BASE_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to create custom object.');
  }
}

/**
 * Updates the presentation metadata (labels, icon, description, views, board)
 * of a fully-custom object. Standard objects are immutable via this action —
 * only field additions are permitted on standard objects through
 * {@link addCustomFieldAction}.
 *
 * Admin-gated.
 */
export async function updateObjectAction(
  slug: string,
  patch: UpdateObjectPatch,
  projectId?: string,
): Promise<ActionResult<ObjectMetadata>> {
  if (!slug) return { ok: false, error: 'Object slug is required.' };
  if (!patch || Object.keys(patch).length === 0) {
    return { ok: false, error: 'At least one field to update is required.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await updateObject(g.ctx.projectId, slug, patch);

    void writeAuditEntry({
      tenantUserId: g.ctx.userId,
      actorId: g.ctx.userId,
      action: 'update',
      entityKind: 'crm_object',
      entityId: slug,
      diff: Object.fromEntries(
        Object.entries(patch).map(([k, v]) => [k, { after: v }]),
      ),
    }).catch(() => undefined);

    revalidatePath(`${CRM_BASE_PATH}/${slug}`);
    revalidatePath(CRM_BASE_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update object.');
  }
}

/**
 * Deletes a fully-custom object. Standard objects cannot be deleted.
 *
 * By default, refuses deletion when records exist for the object. Pass
 * `{ force: true }` to cascade-delete those records and detach any inbound
 * RELATION fields from other custom objects pointing at this one.
 *
 * Admin-gated.
 */
export async function deleteCustomObjectAction(
  slug: string,
  opts: { force?: boolean } = {},
  projectId?: string,
): Promise<ActionResult<DeleteCustomObjectResult>> {
  if (!slug) return { ok: false, error: 'Object slug is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await deleteCustomObject(g.ctx.projectId, slug, opts);

    void writeAuditEntry({
      tenantUserId: g.ctx.userId,
      actorId: g.ctx.userId,
      action: 'delete',
      entityKind: 'crm_object',
      entityId: slug,
      reason: data.deletedRecords > 0
        ? `Cascade-deleted ${data.deletedRecords} record(s)`
        : undefined,
    }).catch(() => undefined);

    revalidatePath(CRM_BASE_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to delete custom object.');
  }
}

// ---------------------------------------------------------------------------
// Field management (admin-gated)
//
// All field mutations go through the runtime metadata engine in
// `objects.server.ts`. Audit entries record the field key + object slug for
// traceability. `addCustomFieldAction` already exists for the additive case;
// the four actions below round out the full field lifecycle.
// ---------------------------------------------------------------------------

/**
 * Adds a field to an object (standard or custom). Runs full structural
 * validation (label, type, SELECT/MULTI_SELECT options, RELATION target
 * presence) and enforces the single-`isLabel` invariant.
 *
 * Admin-gated. Prefer this over the pre-existing `addCustomFieldAction` for
 * new callers — it uses the richer validation path in `addField`.
 */
export async function addFieldAction(
  slug: string,
  field: FieldMetadata,
  projectId?: string,
): Promise<ActionResult<ObjectMetadata>> {
  if (!slug) return { ok: false, error: 'Object slug is required.' };
  if (!field?.key?.trim() || !field?.label?.trim()) {
    return { ok: false, error: 'Field key and label are required.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await addField(g.ctx.projectId, slug, field);

    void writeAuditEntry({
      tenantUserId: g.ctx.userId,
      actorId: g.ctx.userId,
      action: 'create',
      entityKind: 'crm_field',
      entityId: `${slug}.${field.key}`,
      diff: { field: { after: { key: field.key, type: field.type, label: field.label } } },
    }).catch(() => undefined);

    revalidatePath(`${CRM_BASE_PATH}/${slug}`);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to add field.');
  }
}

/**
 * Updates the editable attributes of a custom field (label, icon, description,
 * required, inTable, isLabel, options, defaultValue, relation). The field
 * `key` and `type` are immutable — drop and re-add to change them.
 *
 * Standard and system fields cannot be edited.
 *
 * Admin-gated.
 */
export async function updateFieldAction(
  slug: string,
  fieldKey: string,
  patch: UpdateFieldPatch,
  projectId?: string,
): Promise<ActionResult<ObjectMetadata>> {
  if (!slug) return { ok: false, error: 'Object slug is required.' };
  if (!fieldKey) return { ok: false, error: 'Field key is required.' };
  if (!patch || Object.keys(patch).length === 0) {
    return { ok: false, error: 'At least one attribute to update is required.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await updateField(g.ctx.projectId, slug, fieldKey, patch);

    void writeAuditEntry({
      tenantUserId: g.ctx.userId,
      actorId: g.ctx.userId,
      action: 'update',
      entityKind: 'crm_field',
      entityId: `${slug}.${fieldKey}`,
      diff: Object.fromEntries(
        Object.entries(patch).map(([k, v]) => [k, { after: v }]),
      ),
    }).catch(() => undefined);

    revalidatePath(`${CRM_BASE_PATH}/${slug}`);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update field.');
  }
}

/**
 * Removes a custom field from an object. Standard and system fields cannot
 * be removed. Returns the resolved object after the change.
 *
 * Admin-gated.
 */
export async function removeFieldAction(
  slug: string,
  fieldKey: string,
  projectId?: string,
): Promise<ActionResult<ObjectMetadata>> {
  if (!slug) return { ok: false, error: 'Object slug is required.' };
  if (!fieldKey) return { ok: false, error: 'Field key is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await removeField(g.ctx.projectId, slug, fieldKey);

    void writeAuditEntry({
      tenantUserId: g.ctx.userId,
      actorId: g.ctx.userId,
      action: 'delete',
      entityKind: 'crm_field',
      entityId: `${slug}.${fieldKey}`,
    }).catch(() => undefined);

    revalidatePath(`${CRM_BASE_PATH}/${slug}`);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to remove field.');
  }
}

/**
 * Reorders the custom fields of an object. Standard fields always render
 * first in their canonical code-declared order; only the relative order of
 * custom fields is persistable.
 *
 * `orderedCustomKeys` must be an exact permutation of all custom field keys
 * on the object — no duplicates, no omissions.
 *
 * Admin-gated.
 */
export async function reorderFieldsAction(
  slug: string,
  orderedCustomKeys: string[],
  projectId?: string,
): Promise<ActionResult<ObjectMetadata>> {
  if (!slug) return { ok: false, error: 'Object slug is required.' };
  if (!Array.isArray(orderedCustomKeys)) {
    return { ok: false, error: 'orderedCustomKeys must be an array.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await reorderFields(g.ctx.projectId, slug, orderedCustomKeys);

    void writeAuditEntry({
      tenantUserId: g.ctx.userId,
      actorId: g.ctx.userId,
      action: 'update',
      entityKind: 'crm_field_order',
      entityId: slug,
      diff: { order: { after: orderedCustomKeys } },
    }).catch(() => undefined);

    revalidatePath(`${CRM_BASE_PATH}/${slug}`);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to reorder fields.');
  }
}

// ---------------------------------------------------------------------------
// Relation definition (admin-gated)
//
// Defines a RELATION field on a source object and — unless `inverse: false`
// is passed — creates a reciprocal back-reference on the target object.
// Gated as an admin operation because it mutates two objects' schemas.
// ---------------------------------------------------------------------------

/** Input shape for {@link createRelationAction}. */
export interface CreateRelationActionInput {
  /** Slug of the object that owns the forward relation field. */
  fromSlug: string;
  /** Field key for the new relation field on `fromSlug`. */
  fieldKey: string;
  /** Relation descriptor (targetObject + kind, optionally labelField). */
  relation: FieldRelation;
  /** Optional forward field label. Defaults to the target object's singular label. */
  forwardLabel?: string;
  /** Set `false` to skip creating the reciprocal field on the target object. */
  inverse?: boolean;
  /** Override the auto-generated inverse field key. */
  inverseFieldKey?: string;
  /** Override the auto-generated inverse field label. */
  inverseLabel?: string;
}

/**
 * Defines a RELATION field on a source object and, by default, creates the
 * reciprocal field on the target object so both sides are first-class fields.
 *
 * The target object (`relation.targetObject`) must already exist in the
 * project. Admin-gated.
 */
export async function createRelationAction(
  input: CreateRelationActionInput,
  projectId?: string,
): Promise<ActionResult<CreateRelationResult>> {
  if (!input?.fromSlug) return { ok: false, error: 'fromSlug is required.' };
  if (!input?.fieldKey) return { ok: false, error: 'fieldKey is required.' };
  if (!input?.relation?.targetObject) {
    return { ok: false, error: 'relation.targetObject is required.' };
  }
  if (input.relation.kind !== 'MANY_TO_ONE' && input.relation.kind !== 'ONE_TO_MANY') {
    return { ok: false, error: 'relation.kind must be MANY_TO_ONE or ONE_TO_MANY.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await createRelation(
      g.ctx.projectId,
      input.fromSlug,
      input.fieldKey,
      input.relation,
      {
        inverse: input.inverse,
        inverseFieldKey: input.inverseFieldKey,
        inverseLabel: input.inverseLabel,
        forwardLabel: input.forwardLabel,
      },
    );

    void writeAuditEntry({
      tenantUserId: g.ctx.userId,
      actorId: g.ctx.userId,
      action: 'create',
      entityKind: 'crm_relation',
      entityId: `${input.fromSlug}.${input.fieldKey}`,
      diff: {
        relation: {
          after: {
            fromSlug: input.fromSlug,
            fieldKey: input.fieldKey,
            targetObject: input.relation.targetObject,
            kind: input.relation.kind,
            inverseFieldKey: data.inverseFieldKey,
          },
        },
      },
    }).catch(() => undefined);

    revalidatePath(`${CRM_BASE_PATH}/${input.fromSlug}`);
    revalidatePath(`${CRM_BASE_PATH}/${input.relation.targetObject}`);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to create relation.');
  }
}

// ---------------------------------------------------------------------------
// Member listing (view-gated)
//
// Surfaces workspace members with their derived SabCRM role for assignee
// pickers and the settings members page. Read-only; gated behind `sabcrm:view`.
// ---------------------------------------------------------------------------

/**
 * Lists all workspace members for the active project, enriched with their
 * derived SabCRM capability (view / manage / admin). Owner is always first;
 * agents are sorted alphabetically. Read-gated behind `sabcrm:view`.
 */
export async function listMembersAction(
  projectId?: string,
): Promise<ActionResult<CrmMember[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await listCrmMembers(g.ctx.projectId);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list members.');
  }
}

// ---------------------------------------------------------------------------
// Import / export (manage-gated)
//
// Bulk record import from a parsed CSV/XLSX file and bulk export to a flat
// serialisable shape that the client-side `downloadCsv`/`downloadXlsx`
// helpers consume directly. Both are gated behind the `sabcrm:manage`
// capability because they can create/read large numbers of records at once.
// ---------------------------------------------------------------------------

/** Input accepted by {@link importRecordsAction}. */
export interface ImportRecordsActionInput {
  /** Object slug to import into (e.g. `"companies"`). */
  object: string;
  /**
   * Column→field mapping: field key → CSV column header. Fields absent from
   * the mapping fall back to their `defaultValue`. RELATION and FILE field
   * keys are silently skipped.
   */
  columnMapping: ColumnMapping;
  /**
   * Raw rows from a parsed CSV/XLSX: column header → raw string value.
   * Must not exceed 5,000 rows per call; chunk larger files.
   */
  rows: RawRow[];
  /**
   * When `true`, aborts on the first validation or insert error.
   * Default: `false` — per-row failures are collected and reported back.
   */
  stopOnFirstError?: boolean;
}

/**
 * Validates and bulk-inserts CRM records from a parsed CSV/XLSX file.
 *
 * Per-row coercion and validation are applied against the object's
 * `FieldMetadata`. Valid rows are inserted via the existing `createRecord`
 * runtime so `sanitiseData` and field defaults are honoured uniformly.
 * Returns a per-row summary so the UI can render a row-level error report.
 *
 * Gated behind `sabcrm:manage` (maps to `create` action).
 */
export async function importRecordsAction(
  input: ImportRecordsActionInput,
  projectId?: string,
): Promise<ActionResult<ImportBatchResult>> {
  if (!input?.object) return { ok: false, error: 'Object is required.' };
  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    return { ok: false, error: 'At least one row is required.' };
  }
  if (!input.columnMapping || typeof input.columnMapping !== 'object') {
    return { ok: false, error: 'A columnMapping is required.' };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await importRecords({
      object: input.object,
      columnMapping: input.columnMapping,
      rows: input.rows,
      projectId: g.ctx.projectId,
      userId: g.ctx.userId,
      stopOnFirstError: input.stopOnFirstError,
    });

    if (data.succeeded > 0) {
      revalidatePath(`${CRM_BASE_PATH}/${input.object}`);
    }
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to import records.');
  }
}

/** Options accepted by {@link exportRecordsAction}. */
export interface ExportRecordsActionInput {
  /** Object slug to export (e.g. `"opportunities"`). */
  object: string;
  /**
   * Ordered list of field keys to include. Defaults to every non-RELATION,
   * non-FILE field declared on the object.
   */
  fields?: string[];
  /**
   * Maximum rows to export. Capped at 10,000; defaults to 1,000.
   */
  limit?: number;
}

/**
 * Reads records for one object and serialises them into a `{ headers, rows }`
 * shape ready to pass to `downloadCsv` / `downloadXlsx` on the client.
 *
 * The first column is always `id`; the last two are `createdAt` /
 * `updatedAt`. RELATION and FILE fields are excluded by default — pass them
 * in `opts.fields` to include the raw id values.
 *
 * Gated behind `sabcrm:manage` (maps to `edit` action) because exporting
 * may retrieve large volumes of tenant data.
 */
export async function exportRecordsAction(
  input: ExportRecordsActionInput,
  projectId?: string,
): Promise<ActionResult<ExportRecordsResult>> {
  if (!input?.object) return { ok: false, error: 'Object is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await exportRecords({
      object: input.object,
      projectId: g.ctx.projectId,
      userId: g.ctx.userId,
      fields: input.fields,
      limit: input.limit,
    });
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to export records.');
  }
}
