/**
 * SabCRM — record types — PURE model + helpers.
 *
 * `'server-only'`- and I/O-free (unit-testable). A RECORD TYPE is a per-object
 * variant (Salesforce "record types"): it (a) constrains the values an object's
 * picklist (SELECT / MULTI_SELECT) fields may offer, (b) maps the record to a
 * specific page layout, and (c) seeds default field values on create. A record
 * carries its chosen record type at `data.recordTypeId` (a plain scalar, same
 * envelope as every other field), so the records engine stores/filters it with
 * zero change.
 *
 * The Mongo persistence + recompute live in `./record-types.server.ts`; this
 * module is just the deterministic types + pure selectors the unit tests and
 * the `'use client'` settings editor import directly.
 */

/** Field key → the picklist values that record type permits. */
export type RestrictedPicklists = Record<string, string[]>;

/** Field key → default value seeded on create when the record type is chosen. */
export type RecordTypeDefaults = Record<string, unknown>;

/** A per-object record-type variant. */
export interface RecordType {
  /** Stable id (hex ObjectId from the store). */
  id: string;
  /** Object slug this variant belongs to. */
  object: string;
  /** Human label, e.g. "Enterprise deal". */
  name: string;
  /** Inactive record types are hidden from new-record pickers. */
  active: boolean;
  /**
   * Optional page-layout reference this record type maps to. SabCRM keeps one
   * configurable layout per object (see `./sabcrm-page-layouts`), so this is the
   * stored layout's id; absent → the object's default layout.
   */
  layoutId?: string;
  /**
   * Per-field allowed picklist values. A field present here is constrained to
   * exactly its listed values; a field absent here is unconstrained.
   */
  restrictedPicklists?: RestrictedPicklists;
  /** Field key → default value applied on create (only when absent on the record). */
  defaultValues?: RecordTypeDefaults;
}

/** Save-action input (server stamps id / timestamps / project). */
export interface RecordTypeInput {
  id?: string;
  object: string;
  name: string;
  active: boolean;
  layoutId?: string;
  restrictedPicklists?: RestrictedPicklists;
  defaultValues?: RecordTypeDefaults;
}

/** The field key on every record that stores its chosen record type. */
export const RECORD_TYPE_FIELD_KEY = 'recordTypeId';

/**
 * The picklist values a record type permits for `fieldKey`, intersected with
 * the field's full option set so a stale restriction can never widen the field.
 * Order follows `allValues` (the canonical field option order). When the record
 * type does not restrict `fieldKey`, every value in `allValues` is returned.
 * Pure + deterministic; `recordType` may be null/undefined (→ unconstrained).
 */
export function pickAllowedValues(
  recordType: Pick<RecordType, 'restrictedPicklists'> | null | undefined,
  fieldKey: string,
  allValues: string[],
): string[] {
  const all = Array.isArray(allValues) ? allValues : [];
  const restriction = recordType?.restrictedPicklists?.[fieldKey];
  if (!Array.isArray(restriction)) return [...all];
  const allowed = new Set(restriction);
  return all.filter((v) => allowed.has(v));
}

/** Whether a record type constrains the given picklist field. */
export function isPicklistRestricted(
  recordType: Pick<RecordType, 'restrictedPicklists'> | null | undefined,
  fieldKey: string,
): boolean {
  return Array.isArray(recordType?.restrictedPicklists?.[fieldKey]);
}

/**
 * Whether a candidate value is allowed for `fieldKey` under a record type.
 * Unconstrained fields (no restriction) accept any value. Used at write-time to
 * reject a picklist value the chosen record type does not permit.
 */
export function isValueAllowed(
  recordType: Pick<RecordType, 'restrictedPicklists'> | null | undefined,
  fieldKey: string,
  value: string,
): boolean {
  const restriction = recordType?.restrictedPicklists?.[fieldKey];
  if (!Array.isArray(restriction)) return true;
  return restriction.includes(value);
}

/**
 * Apply a record type's default values onto a record's `data`, returning a NEW
 * object (the input is never mutated). Only keys ABSENT on `data` (undefined or
 * not present) are seeded — explicit caller values, including `null`/`''`/`0`/
 * `false`, always win. Returns `data` shallow-copied even when there are no
 * defaults. Pure + deterministic.
 */
export function applyDefaults(
  recordType: Pick<RecordType, 'defaultValues'> | null | undefined,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...(data ?? {}) };
  const defaults = recordType?.defaultValues;
  if (!defaults || typeof defaults !== 'object') return base;
  for (const [key, value] of Object.entries(defaults)) {
    if (base[key] === undefined) base[key] = value;
  }
  return base;
}
