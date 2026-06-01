import "server-only";

/**
 * SabCRM — metadata data-migration helpers (server-only).
 *
 * When an object's schema changes at runtime (a user deletes a field, retypes
 * it, or makes it required), the records already persisted in `sabcrm_records`
 * may hold data under the affected key that no longer matches the new metadata.
 * Left untouched, that data becomes orphaned (a dropped field) or invalid (a
 * value that no longer parses under the new {@link FieldType}).
 *
 * This module is the single, tenant-scoped place that reconciles existing
 * record `data` with a metadata change. It is consumed by the objects-engine
 * (`objects.server.ts`) on field **delete** and **retype**, and exposes a pure
 * coercion primitive plus dry-run preview so callers can warn before they
 * mutate.
 *
 * Design rules (mirrors the rest of the SabCRM server layer):
 *   - Every operation is scoped by `projectId` + `object` slug. We never touch
 *     another tenant's or another object's documents.
 *   - We only ever read/write the `data.<key>` sub-path; scoping and audit
 *     columns are immutable here.
 *   - Coercion is **best-effort and lossless-by-preference**: a value that
 *     cannot be represented under the target type is reported (preview) and,
 *     when applied, replaced with `null` (cleared) rather than silently kept in
 *     an invalid shape — never throws on a single bad value.
 *
 * The persisted document shape is owned by `./db` ({@link SabcrmRecordDoc}).
 */

import type { Filter } from "mongodb";

import { sabcrmRecords } from "./db";
import type { FieldType } from "./types";

/* -------------------------------------------------------------------------- */
/* Result shapes                                                              */
/* -------------------------------------------------------------------------- */

/** Outcome of a bulk migration applied to `sabcrm_records`. */
export interface MigrationResult {
  /** Object slug the migration ran against. */
  object: string;
  /** Field key the migration touched. */
  fieldKey: string;
  /** Records that matched the scope (project + object) and held the key. */
  matched: number;
  /** Records actually written (a value changed). */
  modified: number;
}

/** Per-record diagnostics produced by a dry-run preview. */
export interface MigrationPreview {
  object: string;
  fieldKey: string;
  /** Records in scope that currently hold a non-empty value for the key. */
  populated: number;
  /**
   * Records whose value cannot be losslessly represented under the target
   * type and would be **cleared** (set to `null`) if the migration is applied.
   * For a drop, this is the count of populated records (all data is removed).
   */
  lossy: number;
  /**
   * Records whose value coerces cleanly (no data loss) under the target type.
   * Always `0` for a drop migration.
   */
  clean: number;
  /**
   * A bounded sample of values that would be lost, for surfacing in a
   * confirmation dialog. Capped at {@link PREVIEW_SAMPLE_LIMIT}.
   */
  lossySamples: Array<{ recordId: string; value: unknown }>;
}

/* -------------------------------------------------------------------------- */
/* Internal constants                                                         */
/* -------------------------------------------------------------------------- */

/** Max number of lossy example values returned by a preview. */
const PREVIEW_SAMPLE_LIMIT = 20;

/** A value treated as "no value present" for migration purposes. */
function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

/* -------------------------------------------------------------------------- */
/* Pure type coercion                                                         */
/* -------------------------------------------------------------------------- */

/** Result of attempting to coerce one value to a target {@link FieldType}. */
export interface CoercionOutcome {
  /** The coerced value (or `null` when the source could not be represented). */
  value: unknown;
  /**
   * True when coercing required discarding information (the source value was
   * non-empty but could not be losslessly represented and was cleared).
   */
  lossy: boolean;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["true", "yes", "1", "on"].includes(v)) return true;
    if (["false", "no", "0", "off"].includes(v)) return false;
    return null;
  }
  return null;
}

function toIsoDate(value: unknown, withTime: boolean): string | null {
  if (isEmptyValue(value)) return null;
  let d: Date | null = null;
  if (value instanceof Date) {
    d = value;
  } else if (typeof value === "number") {
    d = new Date(value);
  } else if (typeof value === "string") {
    const parsed = new Date(value.trim());
    d = parsed;
  }
  if (!d || Number.isNaN(d.getTime())) return null;
  return withTime ? d.toISOString() : d.toISOString().slice(0, 10);
}

function toText(value: unknown): string | null {
  if (isEmptyValue(value)) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const parts = value
      .filter((v) => !isEmptyValue(v))
      .map((v) => (typeof v === "string" ? v : String(v)));
    return parts.length > 0 ? parts.join(", ") : null;
  }
  // Objects (e.g. relation refs) are not meaningful free text.
  return null;
}

function toStringArray(value: unknown): string[] | null {
  if (isEmptyValue(value)) return [];
  if (Array.isArray(value)) {
    const out = value
      .filter((v) => !isEmptyValue(v))
      .map((v) => (typeof v === "string" ? v : String(v)));
    return out;
  }
  if (typeof value === "string") return [value];
  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  return null;
}

/**
 * Pure, side-effect-free coercion of a single record value from one
 * {@link FieldType} to another. Returns the coerced value plus whether the
 * conversion was lossy (a non-empty source had to be cleared because it could
 * not be represented under `toType`).
 *
 * Empty/absent source values always coerce to `null` with `lossy: false`.
 *
 * This is the primitive used by both {@link previewFieldRetype} (dry run) and
 * {@link coerceFieldType} (apply), so the preview is an exact forecast of the
 * write.
 */
export function coerceValue(
  value: unknown,
  fromType: FieldType,
  toType: FieldType,
): CoercionOutcome {
  if (isEmptyValue(value)) {
    // Preserve empty arrays for multi-valued targets; everything else clears.
    if (toType === "MULTI_SELECT") return { value: [], lossy: false };
    return { value: null, lossy: false };
  }

  // Same-type (or no-op) — nothing to do.
  if (fromType === toType) return { value, lossy: false };

  const cleared = (v: unknown): CoercionOutcome => ({ value: v, lossy: true });

  switch (toType) {
    case "TEXT":
    case "EMAIL":
    case "PHONE":
    case "LINK": {
      const t = toText(value);
      return t === null ? cleared(null) : { value: t, lossy: false };
    }

    case "NUMBER":
    case "CURRENCY":
    case "RATING": {
      const n = toNumber(value);
      return n === null ? cleared(null) : { value: n, lossy: false };
    }

    case "BOOLEAN": {
      const b = toBoolean(value);
      return b === null ? cleared(null) : { value: b, lossy: false };
    }

    case "DATE": {
      const d = toIsoDate(value, false);
      return d === null ? cleared(null) : { value: d, lossy: false };
    }

    case "DATE_TIME": {
      const d = toIsoDate(value, true);
      return d === null ? cleared(null) : { value: d, lossy: false };
    }

    case "SELECT": {
      // A single-select holds one scalar token. Collapse arrays to their first
      // member (lossy if there were others), stringify scalars.
      if (Array.isArray(value)) {
        const arr = value.filter((v) => !isEmptyValue(v));
        if (arr.length === 0) return { value: null, lossy: false };
        const first = arr[0];
        const token =
          typeof first === "string" ? first : String(first);
        return { value: token, lossy: arr.length > 1 };
      }
      const t = toText(value);
      return t === null ? cleared(null) : { value: t, lossy: false };
    }

    case "MULTI_SELECT": {
      const arr = toStringArray(value);
      return arr === null ? cleared([]) : { value: arr, lossy: false };
    }

    case "RELATION":
    case "FILE": {
      // These hold structured refs (ids / SabFiles refs). There is no safe
      // automatic coercion FROM a scalar/other type — clear and report lossy.
      return cleared(null);
    }

    default: {
      // Exhaustiveness guard: an unhandled FieldType clears the value.
      return cleared(null);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Scoped record cursor helper                                                */
/* -------------------------------------------------------------------------- */

/**
 * Minimal stored shape we read for migrations: just the id and `data` map.
 * The collection's declared generics differ from this projection, so the few
 * cast points below convert through `Record<string, unknown>`.
 */
interface MigrationRow {
  _id: { toHexString(): string };
  data: Record<string, unknown>;
}

/** Build the tenant + object scope filter, optionally requiring the key. */
function scopeFilter(
  projectId: string,
  object: string,
  fieldKey: string,
  opts: { requireKey: boolean },
): Filter<Record<string, unknown>> {
  const filter: Record<string, unknown> = { projectId, object };
  if (opts.requireKey) {
    filter[`data.${fieldKey}`] = { $exists: true };
  }
  return filter as Filter<Record<string, unknown>>;
}

/* -------------------------------------------------------------------------- */
/* Drop a field's data                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Removes a field key from the `data` map of every record for one object in one
 * project. Called by the objects-engine when a custom field is **deleted** so
 * its values do not linger as orphaned keys.
 *
 * Uses a single `$unset` so it is O(1) round-trips regardless of record count.
 * Never throws on missing data — a no-op when no record holds the key.
 */
export async function dropFieldData(
  projectId: string,
  object: string,
  fieldKey: string,
): Promise<MigrationResult> {
  if (!projectId) throw new Error("projectId is required.");
  if (!object) throw new Error("An object slug is required.");
  if (!fieldKey) throw new Error("A field key is required.");

  const col = await sabcrmRecords();
  const filter = scopeFilter(projectId, object, fieldKey, { requireKey: true });

  const matched = await col.countDocuments(filter);
  const res = await col.updateMany(filter, {
    $unset: { [`data.${fieldKey}`]: "" },
    $set: { updatedAt: new Date().toISOString() },
  });

  return {
    object,
    fieldKey,
    matched,
    modified: res.modifiedCount,
  };
}

/* -------------------------------------------------------------------------- */
/* Coerce a field to a new type                                               */
/* -------------------------------------------------------------------------- */

/**
 * Rewrites `data[fieldKey]` for every record of one object in one project,
 * coercing the stored value from `fromType` to `toType` via {@link coerceValue}.
 * Called by the objects-engine when a field is **retyped**.
 *
 * Values that cannot be losslessly represented under the new type are cleared
 * (set to `null`, or `[]` for MULTI_SELECT) so the record never carries data
 * that violates its own metadata. Run {@link previewFieldRetype} first to warn
 * about lossy conversions.
 *
 * Streams records (not load-all) so it is safe for large objects; each changed
 * record is written with a targeted `data.<key>` `$set`.
 */
export async function coerceFieldType(
  projectId: string,
  object: string,
  fieldKey: string,
  fromType: FieldType,
  toType: FieldType,
): Promise<MigrationResult> {
  if (!projectId) throw new Error("projectId is required.");
  if (!object) throw new Error("An object slug is required.");
  if (!fieldKey) throw new Error("A field key is required.");

  const col = await sabcrmRecords();
  const filter = scopeFilter(projectId, object, fieldKey, { requireKey: true });

  // No-op when the type is unchanged.
  if (fromType === toType) {
    const matched = await col.countDocuments(filter);
    return { object, fieldKey, matched, modified: 0 };
  }

  const cursor = col.find(filter, {
    projection: { _id: 1, [`data.${fieldKey}`]: 1 },
  });

  let matched = 0;
  let modified = 0;
  const now = new Date().toISOString();

  for await (const raw of cursor) {
    const row = raw as unknown as MigrationRow;
    matched += 1;
    const current = row.data?.[fieldKey];
    const { value: next } = coerceValue(current, fromType, toType);

    // Skip the write when the stored value already equals the coerced result.
    if (sameValue(current, next)) continue;

    await col.updateOne(
      { _id: row._id } as unknown as Filter<Record<string, unknown>>,
      {
        $set: { [`data.${fieldKey}`]: next, updatedAt: now },
      },
    );
    modified += 1;
  }

  return { object, fieldKey, matched, modified };
}

/** Shallow value-equality good enough to skip no-op writes during coercion. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* Backfill a default                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Backfills `defaultValue` into `data[fieldKey]` for every record of one object
 * in one project that does **not** already hold a non-empty value for the key.
 * Useful when a field is newly made `required` (so legacy records satisfy the
 * constraint) or gains a default that should apply retroactively.
 *
 * Records that already have a non-empty value are left untouched. A no-op when
 * `defaultValue` is itself empty.
 */
export async function setFieldDefault(
  projectId: string,
  object: string,
  fieldKey: string,
  defaultValue: unknown,
): Promise<MigrationResult> {
  if (!projectId) throw new Error("projectId is required.");
  if (!object) throw new Error("An object slug is required.");
  if (!fieldKey) throw new Error("A field key is required.");

  const col = await sabcrmRecords();

  // Target only records where the key is missing, null, or empty string.
  const filter = {
    projectId,
    object,
    $or: [
      { [`data.${fieldKey}`]: { $exists: false } },
      { [`data.${fieldKey}`]: null },
      { [`data.${fieldKey}`]: "" },
    ],
  } as unknown as Filter<Record<string, unknown>>;

  const matched = await col.countDocuments(filter);

  if (isEmptyValue(defaultValue)) {
    return { object, fieldKey, matched, modified: 0 };
  }

  const res = await col.updateMany(filter, {
    $set: {
      [`data.${fieldKey}`]: defaultValue,
      updatedAt: new Date().toISOString(),
    },
  });

  return { object, fieldKey, matched, modified: res.modifiedCount };
}

/* -------------------------------------------------------------------------- */
/* Dry-run previews                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Dry-run forecast for {@link dropFieldData}: how many records would lose data
 * if the field were deleted, with a bounded sample of the values that would be
 * discarded. Does not mutate anything.
 */
export async function previewFieldDrop(
  projectId: string,
  object: string,
  fieldKey: string,
): Promise<MigrationPreview> {
  if (!projectId) throw new Error("projectId is required.");
  if (!object) throw new Error("An object slug is required.");
  if (!fieldKey) throw new Error("A field key is required.");

  const col = await sabcrmRecords();
  const filter = scopeFilter(projectId, object, fieldKey, { requireKey: true });

  const cursor = col.find(filter, {
    projection: { _id: 1, [`data.${fieldKey}`]: 1 },
  });

  let populated = 0;
  const lossySamples: MigrationPreview["lossySamples"] = [];

  for await (const raw of cursor) {
    const row = raw as unknown as MigrationRow;
    const value = row.data?.[fieldKey];
    if (isEmptyValue(value)) continue;
    populated += 1;
    if (lossySamples.length < PREVIEW_SAMPLE_LIMIT) {
      lossySamples.push({ recordId: row._id.toHexString(), value });
    }
  }

  // Dropping a populated field always discards its data.
  return {
    object,
    fieldKey,
    populated,
    lossy: populated,
    clean: 0,
    lossySamples,
  };
}

/**
 * Dry-run forecast for {@link coerceFieldType}: classifies every populated
 * record as `clean` (coerces losslessly) or `lossy` (its value would be
 * cleared), with a bounded sample of the lossy values. Does not mutate
 * anything; mirrors the exact logic {@link coerceFieldType} will apply.
 */
export async function previewFieldRetype(
  projectId: string,
  object: string,
  fieldKey: string,
  fromType: FieldType,
  toType: FieldType,
): Promise<MigrationPreview> {
  if (!projectId) throw new Error("projectId is required.");
  if (!object) throw new Error("An object slug is required.");
  if (!fieldKey) throw new Error("A field key is required.");

  const col = await sabcrmRecords();
  const filter = scopeFilter(projectId, object, fieldKey, { requireKey: true });

  const cursor = col.find(filter, {
    projection: { _id: 1, [`data.${fieldKey}`]: 1 },
  });

  let populated = 0;
  let lossy = 0;
  let clean = 0;
  const lossySamples: MigrationPreview["lossySamples"] = [];

  for await (const raw of cursor) {
    const row = raw as unknown as MigrationRow;
    const value = row.data?.[fieldKey];
    if (isEmptyValue(value)) continue;
    populated += 1;

    const outcome = coerceValue(value, fromType, toType);
    if (outcome.lossy) {
      lossy += 1;
      if (lossySamples.length < PREVIEW_SAMPLE_LIMIT) {
        lossySamples.push({ recordId: row._id.toHexString(), value });
      }
    } else {
      clean += 1;
    }
  }

  return { object, fieldKey, populated, lossy, clean, lossySamples };
}
