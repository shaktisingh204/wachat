import "server-only";

/**
 * SabCRM — analytics aggregation layer (server-only).
 *
 * Read-only roll-ups over the `sabcrm_records` collection, computed with Mongo
 * `$group` aggregation pipelines so the work happens in the database rather than
 * by streaming every document into Node. Every helper is tenant-scoped by
 * `projectId`; callers may additionally narrow to a single owner with
 * `userId` (matching the owner-scoping that `records.server.ts` applies to
 * reads/writes). When `userId` is omitted the aggregate spans the whole
 * project — the right default for project-wide dashboards.
 *
 * Field keys are validated against the object's live metadata
 * (`objects.server.ts#getObject`) before they reach a pipeline, so a caller can
 * never aggregate by an undeclared `data.*` path. The audit columns
 * `createdAt` / `updatedAt` are also accepted as aggregation keys.
 *
 * Pipeline notes
 * --------------
 *  • The leading `$match` is always `{ projectId[, object][, userId] }`, which
 *    is fully covered by the `{projectId, object, ...}` indexes declared in
 *    `db.ts` (and the wildcard `data.$**` index covers grouping field paths).
 *  • `$group` buckets keep memory bounded server-side; results are returned as
 *    plain serialisable arrays so they cross the server-action boundary cleanly.
 */

import type { Document } from "mongodb";

import { sabcrmRecords } from "./db";
import { getObject } from "./objects.server";
import type { FieldMetadata, FieldOption, ObjectMetadata } from "./types";

/* -------------------------------------------------------------------------- */
/* Public result shapes                                                       */
/* -------------------------------------------------------------------------- */

/** One bucket produced by {@link countByField}. */
export interface CountBucket {
  /** Raw grouped value as a string ("" for the empty / unset bucket). */
  value: string;
  /** Human label resolved from the field's SELECT options, else the raw value. */
  label: string;
  /** Option colour token from field metadata, when the field is a SELECT. */
  color?: string;
  /** Number of records in this bucket. */
  count: number;
}

/** Result of {@link countByField}. */
export interface CountByFieldResult {
  object: string;
  field: string;
  /** Buckets, descending by count (empty bucket sorted last on ties). */
  buckets: CountBucket[];
  /** Total records considered (sum of all bucket counts). */
  total: number;
}

/** One bucket produced by {@link sumByField}. */
export interface SumBucket {
  value: string;
  label: string;
  color?: string;
  /** Summed numeric value of `sumField` across the bucket. */
  sum: number;
  /** Number of records in the bucket (for averages / weighting). */
  count: number;
}

/** Result of {@link sumByField}. */
export interface SumByFieldResult {
  object: string;
  /** Field the records were grouped by. */
  groupField: string;
  /** Field whose numeric values were summed. */
  sumField: string;
  buckets: SumBucket[];
  /** Grand total across all buckets. */
  total: number;
}

/** Granularity for {@link timeSeries} bucketing. */
export type TimeInterval = "day" | "week" | "month";

/** One point in a {@link timeSeries}. */
export interface TimeSeriesPoint {
  /** Bucket start as an ISO date (`YYYY-MM-DD`, UTC) — week buckets use the ISO week's first day. */
  date: string;
  count: number;
}

/** Result of {@link timeSeries}. */
export interface TimeSeriesResult {
  object: string;
  dateField: string;
  interval: TimeInterval;
  points: TimeSeriesPoint[];
  /** Total records placed in any bucket (records with an unparseable / missing date are excluded). */
  total: number;
}

/** One row produced by {@link recordTotals}. */
export interface RecordTotal {
  object: string;
  /** Plural human label of the object, when its metadata is known. */
  label: string;
  count: number;
}

/** Result of {@link recordTotals}. */
export interface RecordTotalsResult {
  totals: RecordTotal[];
  /** Sum across every object. */
  total: number;
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                           */
/* -------------------------------------------------------------------------- */

/** Numeric field types eligible for {@link sumByField}'s sum field. */
const NUMERIC_FIELD_TYPES: ReadonlySet<FieldMetadata["type"]> = new Set([
  "NUMBER",
  "CURRENCY",
  "RATING",
]);

/** Date field types eligible for {@link timeSeries}. */
const DATE_FIELD_TYPES: ReadonlySet<FieldMetadata["type"]> = new Set([
  "DATE",
  "DATE_TIME",
]);

/** Audit columns that live at the document root rather than under `data.*`. */
const ROOT_DATE_FIELDS: ReadonlySet<string> = new Set(["createdAt", "updatedAt"]);

/** Resolve a queryable field key to its Mongo document path. */
function fieldPath(field: string): string {
  return ROOT_DATE_FIELDS.has(field) ? field : `data.${field}`;
}

/**
 * Load an object's metadata, throwing a user-facing error if it is unknown for
 * the project. Centralised so every helper rejects bad slugs identically.
 */
async function requireObject(
  projectId: string,
  object: string,
): Promise<ObjectMetadata> {
  const meta = await getObject(projectId, object);
  if (!meta) {
    throw new Error(`Unknown SabCRM object: ${object}`);
  }
  return meta;
}

/**
 * Resolve a declared field on an object, throwing if it is missing. Audit
 * columns (`createdAt` / `updatedAt`) are not "fields" and are handled by the
 * callers that accept them, so they are not resolvable here.
 */
function requireField(meta: ObjectMetadata, key: string): FieldMetadata {
  const field = meta.fields.find((f) => f.key === key);
  if (!field) {
    throw new Error(`Unknown SabCRM field: ${key} on ${meta.slug}`);
  }
  return field;
}

/**
 * Build the leading `$match` stage shared by every pipeline: tenant scope, the
 * object slug, and (optionally) the owner scope.
 */
function baseMatch(
  projectId: string,
  object: string,
  userId?: string,
): Document {
  const match: Document = { projectId, object };
  if (userId) match.userId = userId;
  return match;
}

/** Coerce a grouped `_id` (which may be any BSON scalar / null) to a string. */
function groupKeyToString(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  if (raw instanceof Date) return raw.toISOString();
  return String(raw);
}

/** Coerce a Mongo numeric accumulator to a finite number. */
function toNumber(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Build a `value -> { label, color }` lookup from a field's SELECT options so
 * grouped buckets can be labelled without a second query.
 */
function optionLookup(
  field: FieldMetadata,
): Map<string, { label: string; color?: string }> {
  const map = new Map<string, { label: string; color?: string }>();
  const options: FieldOption[] = field.options ?? [];
  for (const opt of options) {
    map.set(opt.value, { label: opt.label, color: opt.color });
  }
  return map;
}

/* -------------------------------------------------------------------------- */
/* countByField                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Counts records grouped by the value of a single field — e.g. opportunities by
 * `stage`, people by `city`, tasks by `status`.
 *
 * Buckets are returned descending by count. SELECT / MULTI_SELECT option labels
 * and colours are resolved from the field metadata; for MULTI_SELECT the array
 * is unwound so a record contributes to every option it carries (counts may
 * therefore exceed the record total). Records whose value is missing / null /
 * empty fall into a single empty-string bucket.
 *
 * Tenant-scoped by `projectId`; pass `userId` to scope to one owner.
 *
 * @throws if the object or field is unknown for the project.
 */
export async function countByField(
  projectId: string,
  object: string,
  fieldKey: string,
  opts: { userId?: string } = {},
): Promise<CountByFieldResult> {
  const meta = await requireObject(projectId, object);
  const field = requireField(meta, fieldKey);

  const col = await sabcrmRecords();
  const path = fieldPath(fieldKey);
  const isMulti = field.type === "MULTI_SELECT";

  const pipeline: Document[] = [{ $match: baseMatch(projectId, object, opts.userId) }];

  // MULTI_SELECT stores an array; unwind so each chosen option is counted. The
  // `preserveNullAndEmptyArrays` flag keeps records with no selection in the
  // empty bucket rather than dropping them.
  if (isMulti) {
    pipeline.push({
      $unwind: { path: `$${path}`, preserveNullAndEmptyArrays: true },
    });
  }

  pipeline.push(
    {
      $group: {
        _id: { $ifNull: [`$${path}`, ""] },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1, _id: 1 } },
  );

  const rows = await col.aggregate<{ _id: unknown; count: number }>(pipeline).toArray();

  const lookup = optionLookup(field);
  let total = 0;
  const buckets: CountBucket[] = rows.map((row) => {
    const value = groupKeyToString(row._id);
    const count = toNumber(row.count);
    total += count;
    const opt = lookup.get(value);
    return {
      value,
      label: opt?.label ?? (value === "" ? "Empty" : value),
      color: opt?.color,
      count,
    };
  });

  return { object, field: fieldKey, buckets, total };
}

/* -------------------------------------------------------------------------- */
/* sumByField                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Sums a numeric field grouped by another field — e.g. pipeline `amount` by
 * `stage`, total revenue by `accountOwner`.
 *
 * `sumField` must be a NUMBER / CURRENCY / RATING field. Non-numeric stored
 * values (or missing values) contribute 0 via a `$convert` with an `onError` /
 * `onNull` fallback, so a single dirty record never aborts the aggregate.
 * Buckets are returned descending by sum.
 *
 * Tenant-scoped by `projectId`; pass `userId` to scope to one owner.
 *
 * @throws if the object, group field, or sum field is unknown, or the sum field
 *         is not numeric.
 */
export async function sumByField(
  projectId: string,
  object: string,
  groupFieldKey: string,
  sumFieldKey: string,
  opts: { userId?: string } = {},
): Promise<SumByFieldResult> {
  const meta = await requireObject(projectId, object);
  const groupField = requireField(meta, groupFieldKey);
  const sumField = requireField(meta, sumFieldKey);

  if (!NUMERIC_FIELD_TYPES.has(sumField.type)) {
    throw new Error(
      `Cannot sum "${sumFieldKey}": only NUMBER, CURRENCY or RATING fields are summable (got ${sumField.type}).`,
    );
  }

  const col = await sabcrmRecords();
  const groupPath = fieldPath(groupFieldKey);
  const sumPath = fieldPath(sumFieldKey);

  // Coerce the summed value to a double, falling back to 0 for missing /
  // non-numeric data so one malformed record can't break the pipeline.
  const numericExpr: Document = {
    $convert: {
      input: `$${sumPath}`,
      to: "double",
      onError: 0,
      onNull: 0,
    },
  };

  const pipeline: Document[] = [
    { $match: baseMatch(projectId, object, opts.userId) },
    {
      $group: {
        _id: { $ifNull: [`$${groupPath}`, ""] },
        sum: { $sum: numericExpr },
        count: { $sum: 1 },
      },
    },
    { $sort: { sum: -1, _id: 1 } },
  ];

  const rows = await col
    .aggregate<{ _id: unknown; sum: number; count: number }>(pipeline)
    .toArray();

  const lookup = optionLookup(groupField);
  let total = 0;
  const buckets: SumBucket[] = rows.map((row) => {
    const value = groupKeyToString(row._id);
    const sum = toNumber(row.sum);
    total += sum;
    const opt = lookup.get(value);
    return {
      value,
      label: opt?.label ?? (value === "" ? "Empty" : value),
      color: opt?.color,
      sum,
      count: toNumber(row.count),
    };
  });

  return {
    object,
    groupField: groupFieldKey,
    sumField: sumFieldKey,
    buckets,
    total,
  };
}

/* -------------------------------------------------------------------------- */
/* timeSeries                                                                 */
/* -------------------------------------------------------------------------- */

/** Mongo `$dateTrunc` unit for each supported interval. */
const TRUNC_UNIT: Record<TimeInterval, "day" | "week" | "month"> = {
  day: "day",
  week: "week",
  month: "month",
};

/**
 * Buckets records into a time series by a date field, counting records per
 * `interval` (day / week / month) — e.g. opportunities created per week by
 * `createdAt`, deals closing per month by `closeDate`.
 *
 * `dateField` may be a declared DATE / DATE_TIME field or an audit column
 * (`createdAt` / `updatedAt`). Stored values may be ISO strings or `Date`s;
 * both are coerced to a date inside the pipeline. Records whose date is
 * missing / unparseable are excluded (they cannot be placed on an axis).
 * Points are returned in ascending chronological order, in UTC.
 *
 * Tenant-scoped by `projectId`; pass `userId` to scope to one owner.
 *
 * @throws if the object is unknown, or the field is a declared field that is
 *         not a DATE / DATE_TIME type.
 */
export async function timeSeries(
  projectId: string,
  object: string,
  dateField: string,
  interval: TimeInterval = "day",
  opts: { userId?: string } = {},
): Promise<TimeSeriesResult> {
  const meta = await requireObject(projectId, object);

  // Audit columns are always valid; a declared field must be a date type.
  if (!ROOT_DATE_FIELDS.has(dateField)) {
    const field = requireField(meta, dateField);
    if (!DATE_FIELD_TYPES.has(field.type)) {
      throw new Error(
        `Cannot build a time series on "${dateField}": only DATE / DATE_TIME fields are supported (got ${field.type}).`,
      );
    }
  }

  const unit = TRUNC_UNIT[interval] ?? "day";
  const col = await sabcrmRecords();
  const path = fieldPath(dateField);

  // Coerce the stored value (ISO string or Date) to a Date; rows that can't be
  // converted yield null and are dropped by the subsequent $match.
  const dateExpr: Document = {
    $convert: { input: `$${path}`, to: "date", onError: null, onNull: null },
  };

  const pipeline: Document[] = [
    { $match: baseMatch(projectId, object, opts.userId) },
    { $addFields: { __d: dateExpr } },
    { $match: { __d: { $ne: null } } },
    {
      $group: {
        _id: {
          $dateTrunc: { date: "$__d", unit, timezone: "UTC", startOfWeek: "monday" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ];

  const rows = await col
    .aggregate<{ _id: Date | null; count: number }>(pipeline)
    .toArray();

  let total = 0;
  const points: TimeSeriesPoint[] = rows
    .filter((row): row is { _id: Date; count: number } => row._id instanceof Date)
    .map((row) => {
      const count = toNumber(row.count);
      total += count;
      // ISO date portion (YYYY-MM-DD) in UTC.
      return { date: row._id.toISOString().slice(0, 10), count };
    });

  return { object, dateField, interval, points, total };
}

/* -------------------------------------------------------------------------- */
/* recordTotals                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Counts records per object across the whole project in a single aggregation —
 * the headline "how many of each thing do we have" roll-up for a dashboard.
 *
 * Returns a row for every object slug that has at least one record, decorated
 * with the object's plural label when its metadata is known (an unknown slug —
 * e.g. records left behind by a deleted custom object — still surfaces, labelled
 * by its raw slug). Rows are ordered descending by count.
 *
 * Tenant-scoped by `projectId`; pass `userId` to scope to one owner.
 */
export async function recordTotals(
  projectId: string,
  opts: { userId?: string } = {},
): Promise<RecordTotalsResult> {
  const col = await sabcrmRecords();

  const match: Document = { projectId };
  if (opts.userId) match.userId = opts.userId;

  const pipeline: Document[] = [
    { $match: match },
    { $group: { _id: "$object", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ];

  const rows = await col
    .aggregate<{ _id: unknown; count: number }>(pipeline)
    .toArray();

  // Resolve labels from the project's object catalogue without N+1 lookups:
  // fetch each distinct slug's metadata once, in parallel.
  const slugs = rows.map((row) => groupKeyToString(row._id)).filter(Boolean);
  const metas = await Promise.all(
    slugs.map((slug) => getObject(projectId, slug).catch(() => null)),
  );
  const labelBySlug = new Map<string, string>();
  slugs.forEach((slug, i) => {
    const meta = metas[i];
    if (meta) labelBySlug.set(slug, meta.labelPlural);
  });

  let total = 0;
  const totals: RecordTotal[] = rows.map((row) => {
    const slug = groupKeyToString(row._id);
    const count = toNumber(row.count);
    total += count;
    return { object: slug, label: labelBySlug.get(slug) ?? slug, count };
  });

  return { totals, total };
}
