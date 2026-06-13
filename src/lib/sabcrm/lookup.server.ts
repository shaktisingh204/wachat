import 'server-only';

/**
 * SabCRM — lookup fields runtime (server-only).
 *
 * A lookup MIRRORS a parent record's field onto a child record and keeps it in
 * sync: this record's RELATION field (`relationField`) holds the parent's id; on
 * every write we follow that id, fetch the parent via the Rust records path
 * (`sabcrmRecordsApi.get` — the two-store-safe read), and copy
 * `parent.data[sourceKey]` into this record's `data[targetKey]`.
 *
 * Config lives in `sabcrm_lookup_fields` (projectId-scoped, the native config
 * pattern of `./formula.server.ts` / `./rollup.server.ts`). Values are written
 * DIRECT to `sabcrm_records` as a dotted `$set` (`data.<targetKey>` +
 * `data.__lookup.<targetKey>` meta) with NO `updatedAt` bump — same envelope as
 * AI + formula + rollup + scoring fields, so it never resets idle clocks or
 * re-triggers record-change workflows. Best-effort throughout (never throws).
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { sabcrmRecordsApi } from '@/lib/rust-client/sabcrm-records';
import {
  resolveLookup,
  lookupParentId,
  isResolvableLookup,
  type LookupFieldConfig,
} from './lookup';

export {
  resolveLookup,
  lookupParentId,
  isResolvableLookup,
  type LookupFieldConfig,
  type LookupResult,
} from './lookup';

const LOOKUPS_COLL = 'sabcrm_lookup_fields';
const RECORDS_COLL = 'sabcrm_records';
const MAX_RECORDS_PER_SWEEP = 1000;

/** A persisted lookup field. */
export interface LookupField {
  id: string;
  projectId: string;
  /** The CHILD object this lookup is attached to (where targetKey lives). */
  objectSlug: string;
  /** RELATION field on `objectSlug` holding the parent id. */
  relationField: string;
  /** Parent object slug the relation points at. */
  parentObject: string;
  /** Field key on the parent whose value is mirrored. */
  sourceKey: string;
  /** Field key on the child the mirrored value is written to. */
  targetKey: string;
  name?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LookupFieldInput {
  id?: string;
  objectSlug: string;
  relationField: string;
  parentObject: string;
  sourceKey: string;
  targetKey: string;
  name?: string;
  enabled: boolean;
}

interface LookupDoc {
  _id: ObjectId | string;
  projectId: string;
  objectSlug: string;
  relationField: string;
  parentObject: string;
  sourceKey: string;
  targetKey: string;
  name?: string;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

function toLookup(doc: LookupDoc): LookupField {
  return {
    id: idHex(doc._id),
    projectId: doc.projectId,
    objectSlug: doc.objectSlug,
    relationField: doc.relationField,
    parentObject: doc.parentObject,
    sourceKey: doc.sourceKey,
    targetKey: doc.targetKey,
    name: doc.name,
    enabled: doc.enabled !== false,
    createdAt: doc.createdAt ?? '',
    updatedAt: doc.updatedAt ?? '',
  };
}

/** Project a persisted lookup field into the pure-resolver config shape. */
function toConfig(f: LookupField): LookupFieldConfig {
  return {
    key: f.targetKey,
    relationField: f.relationField,
    parentObject: f.parentObject,
    sourceKey: f.sourceKey,
    targetKey: f.targetKey,
  };
}

/* -------------------------------------------------------------------------- */
/* CRUD                                                                        */
/* -------------------------------------------------------------------------- */

export async function listLookups(projectId: string): Promise<LookupField[]> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(LOOKUPS_COLL)
    .find({ projectId })
    .sort({ updatedAt: -1 })
    .limit(300)
    .toArray()) as unknown as LookupDoc[];
  return docs.map(toLookup);
}

export async function getLookup(
  projectId: string,
  id: string,
): Promise<LookupField | null> {
  if (!projectId || !ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const doc = (await db
    .collection(LOOKUPS_COLL)
    .findOne({ _id: new ObjectId(id), projectId })) as LookupDoc | null;
  return doc ? toLookup(doc) : null;
}

export async function listEnabledLookupsForObject(
  projectId: string,
  objectSlug: string,
): Promise<LookupField[]> {
  if (!projectId || !objectSlug) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(LOOKUPS_COLL)
    .find({ projectId, objectSlug, enabled: { $ne: false } })
    .limit(100)
    .toArray()) as unknown as LookupDoc[];
  return docs.map(toLookup);
}

/** Enabled lookups whose PARENT is `parentObject` (used by backstop sweeps). */
export async function listEnabledLookupsForParent(
  projectId: string,
  parentObject: string,
): Promise<LookupField[]> {
  if (!projectId || !parentObject) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(LOOKUPS_COLL)
    .find({ projectId, parentObject, enabled: { $ne: false } })
    .limit(100)
    .toArray()) as unknown as LookupDoc[];
  return docs.map(toLookup);
}

export async function upsertLookup(
  projectId: string,
  input: LookupFieldInput,
): Promise<LookupField> {
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  const fields = {
    objectSlug: input.objectSlug,
    relationField: input.relationField,
    parentObject: input.parentObject,
    sourceKey: input.sourceKey,
    targetKey: input.targetKey,
    name: input.name?.trim() || input.targetKey,
    enabled: input.enabled !== false,
    updatedAt: now,
  };
  if (input.id && ObjectId.isValid(input.id)) {
    await db
      .collection(LOOKUPS_COLL)
      .updateOne(
        { _id: new ObjectId(input.id), projectId },
        { $set: fields, $setOnInsert: { createdAt: now, projectId } },
        { upsert: true },
      );
    const saved = await getLookup(projectId, input.id);
    if (saved) return saved;
    // The upsert ran against _id=input.id; if the read-back transiently missed,
    // construct the result from known fields rather than inserting a DUPLICATE
    // doc with a fresh auto _id.
    return toLookup({
      _id: new ObjectId(input.id),
      projectId,
      createdAt: now,
      ...fields,
    });
  }
  const res = await db
    .collection(LOOKUPS_COLL)
    .insertOne({ projectId, createdAt: now, ...fields });
  return toLookup({ _id: res.insertedId, projectId, createdAt: now, ...fields });
}

export async function deleteLookup(
  projectId: string,
  id: string,
): Promise<boolean> {
  if (!projectId || !ObjectId.isValid(id)) return false;
  const { db } = await connectToDatabase();
  const res = await db
    .collection(LOOKUPS_COLL)
    .deleteOne({ _id: new ObjectId(id), projectId });
  return res.deletedCount > 0;
}

/* -------------------------------------------------------------------------- */
/* Recompute                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Resolve one lookup's mirrored value for a record's `data`: follow the relation
 * field to the parent id, fetch the parent via the Rust records path (two-store
 * safe), and pick `parent.data[sourceKey]`. Returns the dotted `$set` fragment
 * (value + meta) or `{}` when the parent can't be resolved (the field is left
 * untouched rather than blanked, so a transient relation gap doesn't clear it).
 */
async function buildLookupSetForRecord(
  projectId: string,
  lookups: LookupField[],
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const set: Record<string, unknown> = {};
  // Cache parent fetches by `${parentObject}:${parentId}` so several lookups
  // sharing the same relation/parent hit the engine once.
  const parentCache = new Map<string, Record<string, unknown> | null>();

  for (const f of lookups) {
    if (!isResolvableLookup(toConfig(f))) continue;
    const parentId = lookupParentId(data, f.relationField);
    const computedAt = new Date().toISOString();
    if (!parentId) {
      // No parent linked → clear the mirror (a relation was removed).
      set[`data.${f.targetKey}`] = null;
      set[`data.__lookup.${f.targetKey}`] = {
        parentId: null,
        computedAt,
        status: 'ready',
        error: null,
      };
      continue;
    }
    const cacheKey = `${f.parentObject}:${parentId}`;
    let parentData = parentCache.get(cacheKey);
    if (parentData === undefined) {
      parentData = await fetchParentData(projectId, f.parentObject, parentId);
      parentCache.set(cacheKey, parentData);
    }
    if (parentData === null) {
      // Dangling parent id (deleted / cross-tenant) — record the miss, don't
      // overwrite the last good mirror.
      set[`data.__lookup.${f.targetKey}`] = {
        parentId,
        computedAt,
        status: 'failed',
        error: 'parent not found',
      };
      continue;
    }
    const out = resolveLookup(parentData, f.sourceKey);
    set[`data.__lookup.${f.targetKey}`] = {
      parentId,
      computedAt,
      status: out.ok ? 'ready' : 'failed',
      error: out.ok ? null : out.error ?? 'error',
    };
    if (out.ok) set[`data.${f.targetKey}`] = out.value;
  }
  return set;
}

/** Fetch a parent record's `data` via the Rust path; null on any failure. */
async function fetchParentData(
  projectId: string,
  parentObject: string,
  parentId: string,
): Promise<Record<string, unknown> | null> {
  if (!ObjectId.isValid(parentId)) return null;
  try {
    const parent = await sabcrmRecordsApi.get(parentObject, parentId, projectId);
    return parent?.data ?? {};
  } catch {
    return null;
  }
}

/**
 * Recompute every enabled lookup for one record (no `updatedAt` bump). Reads the
 * record, follows each relation to its parent, and mirrors the parent's value.
 * Best-effort; returns `true` when at least one mirror was written.
 */
export async function recomputeLookupsForRecord(
  projectId: string,
  object: string,
  recordId: string,
): Promise<boolean> {
  try {
    if (!projectId || !object || !recordId || !ObjectId.isValid(recordId)) {
      return false;
    }
    const lookups = await listEnabledLookupsForObject(projectId, object);
    if (lookups.length === 0) return false;
    const { db } = await connectToDatabase();
    const rec = (await db
      .collection(RECORDS_COLL)
      .findOne({ _id: new ObjectId(recordId), projectId })) as {
      data?: Record<string, unknown>;
      deletedAt?: unknown;
    } | null;
    if (!rec || rec.deletedAt) return false;
    const set = await buildLookupSetForRecord(projectId, lookups, rec.data ?? {});
    if (Object.keys(set).length === 0) return false;
    await db
      .collection(RECORDS_COLL)
      .updateOne({ _id: new ObjectId(recordId), projectId }, { $set: set });
    return true;
  } catch {
    return false;
  }
}

/**
 * Recompute lookups across up to `limit` CHILD records of an object (the
 * on-save / backstop sweep — e.g. after enabling a lookup, or to re-sync every
 * child after a parent value changed).
 */
export async function recomputeLookupsForObject(
  projectId: string,
  object: string,
  limit = MAX_RECORDS_PER_SWEEP,
): Promise<{ scanned: number; updated: number }> {
  try {
    if (!projectId || !object) return { scanned: 0, updated: 0 };
    const lookups = await listEnabledLookupsForObject(projectId, object);
    if (lookups.length === 0) return { scanned: 0, updated: 0 };
    const { db } = await connectToDatabase();
    const recs = (await db
      .collection(RECORDS_COLL)
      .find({ projectId, object, deletedAt: { $in: [null] } })
      .limit(Math.min(limit, MAX_RECORDS_PER_SWEEP))
      .toArray()) as unknown as Array<{
      _id: ObjectId;
      data?: Record<string, unknown>;
    }>;
    let updated = 0;
    for (const rec of recs) {
      const set = await buildLookupSetForRecord(projectId, lookups, rec.data ?? {});
      if (Object.keys(set).length === 0) continue;
      await db
        .collection(RECORDS_COLL)
        .updateOne({ _id: rec._id, projectId }, { $set: set });
      updated += 1;
    }
    return { scanned: recs.length, updated };
  } catch {
    return { scanned: 0, updated: 0 };
  }
}

/** Recompute lookups for every CHILD object with enabled lookups in a project. */
export async function recomputeAllProjectLookups(
  projectId: string,
  perObjectLimit = 500,
): Promise<Array<{ objectSlug: string; scanned: number; updated: number }>> {
  const out: Array<{ objectSlug: string; scanned: number; updated: number }> = [];
  try {
    const lookups = await listLookups(projectId);
    const objects = [
      ...new Set(lookups.filter((l) => l.enabled).map((l) => l.objectSlug)),
    ];
    for (const objectSlug of objects) {
      out.push({
        objectSlug,
        ...(await recomputeLookupsForObject(projectId, objectSlug, perObjectLimit)),
      });
    }
  } catch {
    /* best-effort */
  }
  return out;
}

/** Used by the scheduler to discover projects with lookup fields. */
export async function listProjectsWithLookups(
  db: import('mongodb').Db,
): Promise<string[]> {
  try {
    const ids = (await db
      .collection(LOOKUPS_COLL)
      .distinct('projectId', { enabled: { $ne: false } })) as string[];
    return ids.filter(Boolean);
  } catch {
    return [];
  }
}
