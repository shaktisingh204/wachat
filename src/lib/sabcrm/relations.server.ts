import "server-only";
import type { Filter } from "mongodb";
import { sabcrmRecords, ensureSabcrmIndexes } from "./db";
import { getObject } from "./objects.server";
import {
  asStored,
  deriveLabel,
  toCrmRecord,
  toObjectId,
  withLabel,
} from "./records.server";
import type {
  CrmRecord,
  CrmRecordWithLabel,
  FieldMetadata,
  ObjectMetadata,
} from "./types";

/**
 * SabCRM relation resolution helpers.
 *
 * These functions translate stored RELATION field values (record ids, or arrays
 * of record ids) into fully-hydrated related records with display labels, and
 * support back-reference lookups + relation-picker search.
 *
 * Storage convention for RELATION values in `record.data[field.key]`:
 *   - MANY_TO_ONE : a single record id string (or null/undefined when unset)
 *   - ONE_TO_MANY : usually unset on the owning side (it is a back-reference);
 *                   when explicitly stored, an array of record id strings.
 *
 * All reads are tenant-scoped by `projectId`.
 */

const PICKER_DEFAULT_LIMIT = 20;
const PICKER_MAX_LIMIT = 50;

/** A related record reduced to what a picker / chip UI needs. */
export interface RelationOption {
  id: string;
  label: string;
  object: string;
}

/** Resolved single (MANY_TO_ONE) relation. */
export interface ResolvedToOne {
  kind: "MANY_TO_ONE";
  field: string;
  targetObject: string;
  record: CrmRecordWithLabel | null;
}

/** Resolved multi (ONE_TO_MANY) relation. */
export interface ResolvedToMany {
  kind: "ONE_TO_MANY";
  field: string;
  targetObject: string;
  records: CrmRecordWithLabel[];
}

export type ResolvedRelation = ResolvedToOne | ResolvedToMany;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Coerce a stored relation value into an ordered, de-duplicated list of ids. */
function extractIds(value: unknown): string[] {
  if (value == null) return [];
  const raw = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (v == null) continue;
    const id = String(v).trim();
    if (id === "" || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Batch-fetch records of one object by id, tenant-scoped, indexed by id. */
async function fetchByIds(
  projectId: string,
  targetObject: ObjectMetadata,
  ids: string[],
): Promise<Map<string, CrmRecordWithLabel>> {
  const indexed = new Map<string, CrmRecordWithLabel>();
  if (ids.length === 0) return indexed;

  const oids = ids.map((id) => toObjectId(id)).filter((o): o is NonNullable<typeof o> => o !== null);
  if (oids.length === 0) return indexed;

  const col = await sabcrmRecords();
  const filter = {
    projectId,
    object: targetObject.slug,
    _id: { $in: oids },
  } as unknown as Filter<Record<string, unknown>>;

  const docs = await col.find(filter).toArray();
  for (const doc of docs) {
    const rec = withLabel(
      toCrmRecord(asStored(doc as Record<string, unknown>)),
      targetObject,
    );
    indexed.set(rec._id, rec);
  }
  return indexed;
}

/**
 * Resolve a single RELATION field on a record into its related record(s) with
 * display labels. Returns a discriminated union keyed on the relation kind so
 * callers get either `record` (MANY_TO_ONE) or `records` (ONE_TO_MANY).
 *
 * For ONE_TO_MANY fields the value is resolved as a back-reference: every record
 * of the target object whose inverse MANY_TO_ONE field points at `record._id`.
 * If the field also carries explicitly stored ids, those are merged in.
 */
export async function resolveRelation(
  projectId: string,
  record: Pick<CrmRecord, "_id" | "object" | "data">,
  field: FieldMetadata,
): Promise<ResolvedRelation> {
  if (field.type !== "RELATION" || !field.relation) {
    throw new Error(`Field "${field.key}" is not a RELATION field`);
  }
  await ensureSabcrmIndexes();

  const { targetObject: targetSlug, kind } = field.relation;
  const targetObject = await getObject(projectId, targetSlug);

  if (kind === "MANY_TO_ONE") {
    if (!targetObject) {
      return { kind, field: field.key, targetObject: targetSlug, record: null };
    }
    const ids = extractIds(record.data[field.key]);
    if (ids.length === 0) {
      return { kind, field: field.key, targetObject: targetSlug, record: null };
    }
    const indexed = await fetchByIds(projectId, targetObject, ids);
    return {
      kind,
      field: field.key,
      targetObject: targetSlug,
      record: indexed.get(ids[0]) ?? null,
    };
  }

  // ONE_TO_MANY
  if (!targetObject) {
    return { kind, field: field.key, targetObject: targetSlug, records: [] };
  }

  const merged = new Map<string, CrmRecordWithLabel>();

  // 1) Explicitly stored ids (rare on the owning side, but honour them).
  const storedIds = extractIds(record.data[field.key]);
  if (storedIds.length > 0) {
    const indexed = await fetchByIds(projectId, targetObject, storedIds);
    for (const id of storedIds) {
      const r = indexed.get(id);
      if (r) merged.set(r._id, r);
    }
  }

  // 2) Back-references: any target record whose inverse MANY_TO_ONE field
  //    points at this record's id.
  const inverseKeys = targetObject.fields
    .filter(
      (f) =>
        f.type === "RELATION" &&
        f.relation?.kind === "MANY_TO_ONE" &&
        f.relation.targetObject === record.object,
    )
    .map((f) => f.key);

  if (inverseKeys.length > 0 && record._id) {
    const col = await sabcrmRecords();
    const filter = {
      projectId,
      object: targetObject.slug,
      $or: inverseKeys.map((k) => ({ [`data.${k}`]: record._id })),
    } as unknown as Filter<Record<string, unknown>>;
    const docs = await col.find(filter).toArray();
    for (const doc of docs) {
      const rec = withLabel(
        toCrmRecord(asStored(doc as Record<string, unknown>)),
        targetObject,
      );
      if (!merged.has(rec._id)) merged.set(rec._id, rec);
    }
  }

  return {
    kind,
    field: field.key,
    targetObject: targetSlug,
    records: Array.from(merged.values()),
  };
}

/**
 * List records of `targetObject` that reference `recordId` through the
 * MANY_TO_ONE field `byRelationKey` — i.e. the ONE_TO_MANY back-reference.
 *
 * Example: list every `people` record whose `company` field equals a company id.
 */
export async function listRelatedRecords(
  projectId: string,
  targetObject: string,
  byRelationKey: string,
  recordId: string,
): Promise<CrmRecordWithLabel[]> {
  await ensureSabcrmIndexes();
  const target = await getObject(projectId, targetObject);
  if (!target) return [];

  const field = target.fields.find((f) => f.key === byRelationKey);
  if (!field || field.type !== "RELATION") {
    throw new Error(
      `Field "${byRelationKey}" on "${targetObject}" is not a RELATION field`,
    );
  }

  const id = String(recordId).trim();
  if (id === "") return [];

  const col = await sabcrmRecords();
  // Match both scalar id storage and array storage (defensive).
  const filter = {
    projectId,
    object: targetObject,
    [`data.${byRelationKey}`]: id,
  } as unknown as Filter<Record<string, unknown>>;

  const docs = await col.find(filter).sort({ createdAt: -1 }).toArray();
  return docs.map((doc) =>
    withLabel(toCrmRecord(asStored(doc as Record<string, unknown>)), target),
  );
}

/**
 * Search records of `object` for a relation picker. Matches `q` (case
 * insensitive) against the object's label field plus other text-like fields,
 * returning lightweight {id, label, object} options ready for a chip / combobox.
 *
 * An empty query returns the most recently created records so the picker has
 * sensible defaults on open.
 */
export async function searchRecordsForPicker(
  projectId: string,
  object: string,
  q: string,
  limit = PICKER_DEFAULT_LIMIT,
): Promise<RelationOption[]> {
  await ensureSabcrmIndexes();
  const target = await getObject(projectId, object);
  if (!target) return [];

  const cap = Math.min(PICKER_MAX_LIMIT, Math.max(1, Math.floor(limit)));
  const col = await sabcrmRecords();

  const baseFilter: Record<string, unknown> = { projectId, object };

  const term = (q ?? "").trim();
  if (term !== "") {
    const rx = { $regex: escapeRegex(term), $options: "i" };
    const searchableKeys = new Set<string>();
    const labelField = target.fields.find((f) => f.isLabel);
    if (labelField) searchableKeys.add(labelField.key);
    for (const f of target.fields) {
      if (["TEXT", "EMAIL", "PHONE", "LINK"].includes(f.type)) {
        searchableKeys.add(f.key);
      }
    }
    if (searchableKeys.size > 0) {
      baseFilter.$or = Array.from(searchableKeys).map((k) => ({
        [`data.${k}`]: rx,
      }));
    }
  }

  const docs = await col
    .find(baseFilter as unknown as Filter<Record<string, unknown>>)
    .sort({ createdAt: -1 })
    .limit(cap)
    .toArray();

  return docs.map((doc) => {
    const rec = toCrmRecord(asStored(doc as Record<string, unknown>));
    return {
      id: rec._id,
      label: deriveLabel(rec, target),
      object: target.slug,
    };
  });
}
