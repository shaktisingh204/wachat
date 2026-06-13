import 'server-only';

/**
 * SabCRM — record types runtime (server-only).
 *
 * Persists per-object record-type variants in `sabcrm_record_types`
 * (projectId-scoped, the native config pattern of `./formula.server.ts`). A
 * record carries its chosen record type at the plain scalar `data.recordTypeId`
 * — the same AI-fields envelope every other computed/metadata key uses — so the
 * records engine stores/filters it with zero change.
 *
 * This module is CRUD + resolution only: it never writes onto records. The
 * create-time default-seeding (pure `applyDefaults`) is applied by the record
 * create path BEFORE the record is persisted (see the action hook snippet),
 * because defaults belong in the same write that creates the record, not in a
 * post-hoc recompute. Best-effort throughout — config reads degrade to `[]`.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import {
  applyDefaults,
  pickAllowedValues,
  isValueAllowed,
  RECORD_TYPE_FIELD_KEY,
  type RecordType,
  type RecordTypeInput,
  type RestrictedPicklists,
  type RecordTypeDefaults,
} from './record-types';

export {
  applyDefaults,
  pickAllowedValues,
  isPicklistRestricted,
  isValueAllowed,
  RECORD_TYPE_FIELD_KEY,
  type RecordType,
  type RecordTypeInput,
  type RestrictedPicklists,
  type RecordTypeDefaults,
} from './record-types';

const RECORD_TYPES_COLL = 'sabcrm_record_types';

interface RecordTypeDoc {
  _id: ObjectId | string;
  projectId: string;
  object: string;
  name?: string;
  active?: boolean;
  layoutId?: string;
  restrictedPicklists?: RestrictedPicklists;
  defaultValues?: RecordTypeDefaults;
  createdAt?: string;
  updatedAt?: string;
}

function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

function toRecordType(doc: RecordTypeDoc): RecordType {
  return {
    id: idHex(doc._id),
    object: doc.object,
    name: doc.name || 'Untitled',
    active: doc.active !== false,
    layoutId: doc.layoutId || undefined,
    restrictedPicklists: doc.restrictedPicklists ?? {},
    defaultValues: doc.defaultValues ?? {},
  };
}

/** Normalise the per-field restriction map: drop empties, coerce to string[]. */
function cleanRestrictions(
  input: RestrictedPicklists | undefined,
): RestrictedPicklists {
  const out: RestrictedPicklists = {};
  if (!input || typeof input !== 'object') return out;
  for (const [key, vals] of Object.entries(input)) {
    if (!key.trim() || !Array.isArray(vals)) continue;
    out[key] = vals.map((v) => String(v)).filter((v) => v.length > 0);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* CRUD                                                                        */
/* -------------------------------------------------------------------------- */

/** Every record type in a project, newest-updated first. */
export async function listRecordTypes(projectId: string): Promise<RecordType[]> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(RECORD_TYPES_COLL)
    .find({ projectId })
    .sort({ updatedAt: -1 })
    .limit(500)
    .toArray()) as unknown as RecordTypeDoc[];
  return docs.map(toRecordType);
}

/** One record type by id (scoped to the project). */
export async function getRecordType(
  projectId: string,
  id: string,
): Promise<RecordType | null> {
  if (!projectId || !ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const doc = (await db
    .collection(RECORD_TYPES_COLL)
    .findOne({ _id: new ObjectId(id), projectId })) as RecordTypeDoc | null;
  return doc ? toRecordType(doc) : null;
}

/** Record types for one object. `activeOnly` filters out disabled variants. */
export async function getRecordTypesForObject(
  projectId: string,
  object: string,
  activeOnly = false,
): Promise<RecordType[]> {
  if (!projectId || !object) return [];
  const { db } = await connectToDatabase();
  const query: Record<string, unknown> = { projectId, object };
  if (activeOnly) query.active = { $ne: false };
  const docs = (await db
    .collection(RECORD_TYPES_COLL)
    .find(query)
    .sort({ updatedAt: -1 })
    .limit(200)
    .toArray()) as unknown as RecordTypeDoc[];
  return docs.map(toRecordType);
}

/** Create or update a record type. Config collections MAY bump updatedAt. */
export async function upsertRecordType(
  projectId: string,
  input: RecordTypeInput,
): Promise<RecordType> {
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  const fields = {
    object: input.object,
    name: input.name?.trim() || 'Untitled',
    active: input.active !== false,
    layoutId: input.layoutId?.trim() || undefined,
    restrictedPicklists: cleanRestrictions(input.restrictedPicklists),
    defaultValues:
      input.defaultValues && typeof input.defaultValues === 'object'
        ? input.defaultValues
        : {},
    updatedAt: now,
  };
  if (input.id && ObjectId.isValid(input.id)) {
    await db
      .collection(RECORD_TYPES_COLL)
      .updateOne(
        { _id: new ObjectId(input.id), projectId },
        { $set: fields, $setOnInsert: { createdAt: now, projectId } },
        { upsert: true },
      );
    const saved = await getRecordType(projectId, input.id);
    if (saved) return saved;
  }
  const res = await db
    .collection(RECORD_TYPES_COLL)
    .insertOne({ projectId, createdAt: now, ...fields });
  return toRecordType({ _id: res.insertedId, projectId, createdAt: now, ...fields });
}

/** Delete a record type by id. */
export async function deleteRecordType(
  projectId: string,
  id: string,
): Promise<boolean> {
  if (!projectId || !ObjectId.isValid(id)) return false;
  const { db } = await connectToDatabase();
  const res = await db
    .collection(RECORD_TYPES_COLL)
    .deleteOne({ _id: new ObjectId(id), projectId });
  return res.deletedCount > 0;
}

/* -------------------------------------------------------------------------- */
/* Resolution                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the record type a record (or a record's `data`) is bound to, reading
 * the chosen id from `data.recordTypeId`. Accepts either a full record
 * (`{ object, data }`) or a bare `data` map plus an explicit object slug.
 * Returns `null` when the field is empty / the id no longer exists. Best-effort
 * (never throws): an unreadable store resolves to `null`.
 */
export async function resolveRecordTypeForRecord(
  projectId: string,
  record:
    | { object?: string; data?: Record<string, unknown> }
    | Record<string, unknown>,
  objectSlug?: string,
): Promise<RecordType | null> {
  try {
    if (!projectId) return null;
    const data =
      (record && typeof record === 'object' && 'data' in record
        ? (record as { data?: Record<string, unknown> }).data
        : (record as Record<string, unknown>)) ?? {};
    const object =
      objectSlug ??
      (record && typeof record === 'object' && 'object' in record
        ? String((record as { object?: unknown }).object ?? '')
        : '');
    const rawId = data[RECORD_TYPE_FIELD_KEY];
    if (typeof rawId !== 'string' || !ObjectId.isValid(rawId)) return null;
    const rt = await getRecordType(projectId, rawId);
    // Guard against an id that belongs to a different object's variant.
    if (rt && object && rt.object !== object) return null;
    return rt;
  } catch {
    return null;
  }
}

/**
 * The allowed picklist values for `fieldKey` on a record, given its chosen
 * record type. Convenience wrapper over the pure {@link pickAllowedValues} that
 * loads the record type first. Best-effort; falls back to `allValues` when the
 * record type cannot be resolved.
 */
export async function allowedPicklistValuesForRecord(
  projectId: string,
  object: string,
  data: Record<string, unknown>,
  fieldKey: string,
  allValues: string[],
): Promise<string[]> {
  const rt = await resolveRecordTypeForRecord(projectId, data, object);
  return pickAllowedValues(rt, fieldKey, allValues);
}

/**
 * Whether a candidate picklist value is permitted for `fieldKey` under the
 * record type chosen in `data`. Used as a write-time gate. Best-effort: an
 * unresolvable record type → allowed (fail-open, since defaults aren't a
 * security boundary). Re-exported pure {@link isValueAllowed} does the check.
 */
export async function isValueAllowedForRecord(
  projectId: string,
  object: string,
  data: Record<string, unknown>,
  fieldKey: string,
  value: string,
): Promise<boolean> {
  const rt = await resolveRecordTypeForRecord(projectId, data, object);
  return isValueAllowed(rt, fieldKey, value);
}

/**
 * Apply the default field values of the record type referenced in `data`
 * (`data.recordTypeId`) onto `data`, returning a NEW object. Loads the record
 * type, then delegates to the pure {@link applyDefaults}. No-op (shallow copy)
 * when no record type is chosen / resolvable. Call this on the create path
 * BEFORE persisting the record so defaults land in the creating write.
 */
export async function applyRecordTypeDefaults(
  projectId: string,
  object: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const rt = await resolveRecordTypeForRecord(projectId, data, object);
  return applyDefaults(rt, data);
}

/** Used by tooling to discover projects that have configured record types. */
export async function listProjectsWithRecordTypes(
  db: import('mongodb').Db,
): Promise<string[]> {
  try {
    const ids = (await db
      .collection(RECORD_TYPES_COLL)
      .distinct('projectId')) as string[];
    return ids.filter(Boolean);
  } catch {
    return [];
  }
}
