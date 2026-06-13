import 'server-only';

/**
 * SabCRM — global value-sets runtime (server-only).
 *
 * Persists reusable picklist value-sets in `sabcrm_value_sets` (projectId-scoped,
 * the native config pattern of `./formula.server.ts` / `./scoring.server.ts`)
 * and resolves a set into live records-engine {@link FieldOption}s for the SELECT
 * fields that reference it.
 *
 * ## How a SELECT field opts in
 *
 * A field references a value-set by storing its id under the field metadata's
 * type-discriminated `settings` blob:
 *
 * ```jsonc
 * { "key": "industry", "type": "SELECT", "settings": { "valueSetId": "<setId>" } }
 * ```
 *
 * The record form / option resolver then calls
 * {@link resolveOptionsForField}`(projectId, field)` (or the lower-level
 * {@link resolveOptionsForValueSet}) which expands the reference into the set's
 * **active** values; a field WITHOUT `settings.valueSetId` keeps its own inline
 * `field.options` (unchanged legacy behaviour). Deprecated values are excluded
 * from the resolved options so they stop appearing in new picks while existing
 * records keep their stored scalar.
 *
 * Config writes here MAY bump the doc's own `updatedAt` (the records-only
 * no-bump rule does not apply — value-sets are config, not records).
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import type { FieldMetadata, FieldOption } from './types';
import {
  activeValues,
  dedupeValues,
  validateValue,
  valueSetToOptions,
  type GlobalValueSet,
  type ValueSetValue,
} from './value-sets';

export {
  activeValues,
  validateValue,
  valueSetToOptions,
  normalizeValue,
  dedupeValues,
  type GlobalValueSet,
  type ValueSetValue,
} from './value-sets';

const VALUE_SETS_COLL = 'sabcrm_value_sets';

/** Field-config key a SELECT field stores to reference a global value-set. */
export const VALUE_SET_SETTINGS_KEY = 'valueSetId';

/** Save-action input (server stamps id / timestamps / project). */
export interface ValueSetInput {
  id?: string;
  name: string;
  values: Array<{
    value: string;
    label?: string;
    color?: string;
    active?: boolean;
  }>;
}

interface ValueSetDoc {
  _id: ObjectId | string;
  projectId: string;
  name: string;
  values?: ValueSetValue[];
  createdAt?: string;
  updatedAt?: string;
}

function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

function toValueSet(doc: ValueSetDoc): GlobalValueSet {
  return {
    id: idHex(doc._id),
    name: doc.name,
    values: dedupeValues(doc.values ?? []),
  };
}

/**
 * Read the value-set id a SELECT/MULTI_SELECT field references, if any. Mirrors
 * `aiFieldConfig`'s defensive parse of the `settings` blob. Returns null when
 * the field is not a picklist, has no `settings`, or the id is blank/non-string.
 */
export function fieldValueSetId(field: FieldMetadata): string | null {
  if (field?.type !== 'SELECT' && field?.type !== 'MULTI_SELECT') return null;
  const settings = field.settings;
  if (!settings || typeof settings !== 'object') return null;
  const raw = (settings as Record<string, unknown>)[VALUE_SET_SETTINGS_KEY];
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  return raw.trim();
}

/* -------------------------------------------------------------------------- */
/* CRUD                                                                        */
/* -------------------------------------------------------------------------- */

export async function listValueSets(projectId: string): Promise<GlobalValueSet[]> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(VALUE_SETS_COLL)
    .find({ projectId })
    .sort({ name: 1 })
    .limit(300)
    .toArray()) as unknown as ValueSetDoc[];
  return docs.map(toValueSet);
}

export async function getValueSet(
  projectId: string,
  id: string,
): Promise<GlobalValueSet | null> {
  if (!projectId || !ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const doc = (await db
    .collection(VALUE_SETS_COLL)
    .findOne({ _id: new ObjectId(id), projectId })) as ValueSetDoc | null;
  return doc ? toValueSet(doc) : null;
}

export async function upsertValueSet(
  projectId: string,
  input: ValueSetInput,
): Promise<GlobalValueSet> {
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  const fields = {
    name: input.name?.trim() || 'Untitled value set',
    values: dedupeValues(input.values ?? []),
    updatedAt: now,
  };
  if (input.id && ObjectId.isValid(input.id)) {
    await db
      .collection(VALUE_SETS_COLL)
      .updateOne(
        { _id: new ObjectId(input.id), projectId },
        { $set: fields, $setOnInsert: { createdAt: now, projectId } },
        { upsert: true },
      );
    const saved = await getValueSet(projectId, input.id);
    if (saved) return saved;
  }
  const res = await db
    .collection(VALUE_SETS_COLL)
    .insertOne({ projectId, createdAt: now, ...fields });
  return toValueSet({ _id: res.insertedId, projectId, createdAt: now, ...fields });
}

export async function deleteValueSet(
  projectId: string,
  id: string,
): Promise<boolean> {
  if (!projectId || !ObjectId.isValid(id)) return false;
  const { db } = await connectToDatabase();
  const res = await db
    .collection(VALUE_SETS_COLL)
    .deleteOne({ _id: new ObjectId(id), projectId });
  return res.deletedCount > 0;
}

/* -------------------------------------------------------------------------- */
/* Value lifecycle — add / deprecate                                           */
/* -------------------------------------------------------------------------- */

/**
 * Add a new value (or re-activate an existing one with the same `value`) to a
 * set. Idempotent on the `value` key: an existing entry has its label/color
 * refreshed and is re-activated rather than duplicated. Returns the updated set
 * or null when the set does not exist.
 */
export async function addValue(
  projectId: string,
  id: string,
  value: { value: string; label?: string; color?: string },
): Promise<GlobalValueSet | null> {
  const set = await getValueSet(projectId, id);
  if (!set) return null;
  const v = value.value?.trim();
  if (!v) return set;
  const next = set.values.filter((o) => o.value !== v);
  next.push({
    value: v,
    label: value.label?.trim() || v,
    color: value.color?.trim() || undefined,
    active: true,
  });
  return upsertValueSet(projectId, { id, name: set.name, values: next });
}

/**
 * Deprecate (deactivate) a value — it stays in the set for historical records
 * but is excluded from new picks. Idempotent. Returns the updated set or null
 * when the set does not exist.
 */
export async function deprecateValue(
  projectId: string,
  id: string,
  value: string,
): Promise<GlobalValueSet | null> {
  const set = await getValueSet(projectId, id);
  if (!set) return null;
  const v = value?.trim();
  if (!v) return set;
  const next = set.values.map((o) =>
    o.value === v ? { ...o, active: false } : o,
  );
  return upsertValueSet(projectId, { id, name: set.name, values: next });
}

/* -------------------------------------------------------------------------- */
/* Field-option resolution (the records-form integration point)                */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the live {@link FieldOption}s for a value-set id. Returns the set's
 * **active** values projected into records-engine options, or `[]` when the set
 * is missing/empty. This is the call the record form / option resolver makes
 * for a SELECT field whose `settings.valueSetId` points here.
 */
export async function resolveOptionsForField(
  projectId: string,
  valueSetId: string,
): Promise<FieldOption[]> {
  if (!projectId || !valueSetId) return [];
  const set = await getValueSet(projectId, valueSetId);
  if (!set) return [];
  return valueSetToOptions(set);
}

/**
 * Resolve the effective options for a FieldMetadata: when the field references a
 * global value-set (`settings.valueSetId`) the set's active values win;
 * otherwise the field's own inline `options` are returned unchanged. The record
 * form / record-surface option resolver calls this per SELECT/MULTI_SELECT
 * field so a referenced set is transparently expanded.
 */
export async function resolveOptionsForFieldMetadata(
  projectId: string,
  field: FieldMetadata,
): Promise<FieldOption[]> {
  const vsId = fieldValueSetId(field);
  if (!vsId) return field.options ?? [];
  const resolved = await resolveOptionsForField(projectId, vsId);
  return resolved.length > 0 ? resolved : field.options ?? [];
}

/**
 * Whether `value` is acceptable for a field that references a value-set. Used by
 * a write-validation gate: an unreferenced field always passes (the engine owns
 * its inline options); a referenced field requires an ACTIVE set value. An empty
 * value passes here (required-ness is enforced elsewhere). Best-effort: a
 * missing set passes rather than blocking the save.
 */
export async function isValueAllowedForField(
  projectId: string,
  field: FieldMetadata,
  value: unknown,
): Promise<boolean> {
  const vsId = fieldValueSetId(field);
  if (!vsId) return true;
  if (value === null || value === undefined || value === '') return true;
  const set = await getValueSet(projectId, vsId);
  if (!set || activeValues(set).length === 0) return true;
  const values = Array.isArray(value) ? value : [value];
  return values.every((v) => v === null || v === undefined || v === '' || validateValue(set, v));
}
