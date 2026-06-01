/**
 * SabCRM — pure filter / sort helpers.
 *
 * Extracted from records.server.ts so they can be unit-tested without loading
 * the `server-only` barrier or a live Mongo connection. This file MUST remain
 * free of `server-only`, `db`, or any I/O imports so that `tsx --test` can
 * import it directly.
 *
 * All types that require the Mongo driver (e.g. `Filter`, `Sort`) are imported
 * from `mongodb` which is a plain npm package — no server-only constraint.
 */

import type { Filter, Sort } from "mongodb";

import type {
  CrmRecord,
  CrmRecordWithLabel,
  FieldMetadata,
  ObjectMetadata,
  RecordQuery,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Exported query-primitive types                                              */
/* -------------------------------------------------------------------------- */

/**
 * Per-field filter operators. Each maps onto MongoDB query operators against
 * the `data.<fieldKey>` path of a record. `contains` / `notContains` perform a
 * case-insensitive substring match; `isEmpty` / `isNotEmpty` treat missing,
 * null and empty-string as "empty".
 */
export type FilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "notContains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "notIn"
  | "isEmpty"
  | "isNotEmpty";

/** A single typed condition against one field of the active object. */
export interface FilterCondition {
  /** Field key (or `createdAt` / `updatedAt`). */
  field: string;
  op: FilterOperator;
  /** Required for every operator except `isEmpty` / `isNotEmpty`. */
  value?: unknown;
}

/** Multi-key sort descriptor. */
export interface SortKey {
  /** Field key (or `createdAt` / `updatedAt`). */
  field: string;
  dir: "asc" | "desc";
}

/**
 * Extended record query. Structurally a superset of {@link RecordQuery}, so
 * every existing caller (which passes a plain `RecordQuery`) keeps working:
 * - `filters` (legacy exact-match map) is still honoured.
 * - `conditions` adds typed per-field operators (ANDed together, and ANDed
 *   with `filters` / `search`).
 * - `sort` adds multi-key ordering and takes precedence over the legacy
 *   single-key `sortBy` / `sortDir`.
 */
export interface RecordQueryExtended extends RecordQuery {
  conditions?: FilterCondition[];
  sort?: SortKey[];
}

/* -------------------------------------------------------------------------- */
/* Internal operator sets (exported so tests can reference canonical members) */
/* -------------------------------------------------------------------------- */

/** Operators whose Mongo expression needs a caller-supplied value. */
export const OPERATORS_REQUIRING_VALUE: ReadonlySet<FilterOperator> =
  new Set<FilterOperator>([
    "eq",
    "neq",
    "contains",
    "notContains",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "notIn",
  ]);

/** Every recognised operator (used to reject unknown op strings). */
export const VALID_OPERATORS: ReadonlySet<string> = new Set<FilterOperator>([
  "eq",
  "neq",
  "contains",
  "notContains",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "notIn",
  "isEmpty",
  "isNotEmpty",
]);

/* -------------------------------------------------------------------------- */
/* String helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Escapes all special RegExp metacharacters in an input string. */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Resolve a queryable field key to its Mongo document path. */
export function fieldPath(field: string): string {
  return field === "createdAt" || field === "updatedAt"
    ? field
    : `data.${field}`;
}

/* -------------------------------------------------------------------------- */
/* Condition → Mongo expression                                               */
/* -------------------------------------------------------------------------- */

/**
 * Translate one typed condition into a Mongo expression keyed by the field's
 * document path. Returns `null` when the condition is a no-op (e.g. an unknown
 * operator, or a comparison operator given no value).
 */
export function conditionToMongo(
  condition: FilterCondition,
): { path: string; expr: unknown } | null {
  const { field, op, value } = condition;
  if (!field || !VALID_OPERATORS.has(op)) return null;

  // Value-less comparison operators (everything except in/notIn, which can take
  // an array) are treated as no-ops rather than matching everything/nothing.
  if (
    OPERATORS_REQUIRING_VALUE.has(op) &&
    op !== "in" &&
    op !== "notIn" &&
    (value === undefined || value === null || value === "")
  ) {
    return null;
  }

  const path = fieldPath(field);

  switch (op) {
    case "eq":
      return { path, expr: value };
    case "neq":
      return { path, expr: { $ne: value } };
    case "contains":
      return {
        path,
        expr: { $regex: escapeRegExp(String(value)), $options: "i" },
      };
    case "notContains":
      return {
        path,
        expr: { $not: { $regex: escapeRegExp(String(value)), $options: "i" } },
      };
    case "gt":
      return { path, expr: { $gt: value } };
    case "gte":
      return { path, expr: { $gte: value } };
    case "lt":
      return { path, expr: { $lt: value } };
    case "lte":
      return { path, expr: { $lte: value } };
    case "in":
      return { path, expr: { $in: Array.isArray(value) ? value : [value] } };
    case "notIn":
      return { path, expr: { $nin: Array.isArray(value) ? value : [value] } };
    case "isEmpty":
      // Missing, null, or empty string.
      return { path, expr: { $in: [null, ""] } };
    case "isNotEmpty":
      return { path, expr: { $exists: true, $nin: [null, ""] } };
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Filter / sort builders                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Builds the Mongo filter for a list query: tenant + owner scope, object slug,
 * legacy exact-match field filters, typed per-field conditions, and a free-text
 * search across the object's searchable (TEXT/EMAIL/PHONE/LINK) fields.
 *
 * `search` (an `$or` over searchable fields) and the typed conditions (an
 * `$and` of per-field clauses) are kept in separate operators so they compose
 * correctly — search OR-matches widen, conditions AND-narrow.
 */
export function buildFilter(
  projectId: string,
  userId: string,
  query: RecordQueryExtended,
  object: ObjectMetadata,
): Filter<Record<string, unknown>> {
  const filter: Record<string, unknown> = {
    projectId,
    userId,
    object: query.object,
  };

  // Legacy exact-match filters (Record<field, value>).
  if (query.filters) {
    for (const [key, value] of Object.entries(query.filters)) {
      if (value === undefined || value === null || value === "") continue;
      filter[`data.${key}`] = value;
    }
  }

  // Typed conditions. Each is ANDed; collected into a single `$and` so multiple
  // conditions on the same field don't clobber one another in the filter map.
  if (query.conditions && query.conditions.length > 0) {
    const and: Array<Record<string, unknown>> = [];
    for (const condition of query.conditions) {
      const mongo = conditionToMongo(condition);
      if (!mongo) continue;
      and.push({ [mongo.path]: mongo.expr });
    }
    if (and.length > 0) {
      filter.$and = and;
    }
  }

  const search = query.search?.trim();
  if (search) {
    const rx = { $regex: escapeRegExp(search), $options: "i" };
    const searchable = object.fields.filter(
      (f) =>
        f.type === "TEXT" ||
        f.type === "EMAIL" ||
        f.type === "PHONE" ||
        f.type === "LINK",
    );
    const or: Array<Record<string, unknown>> =
      searchable.length > 0
        ? searchable.map((f) => ({ [`data.${f.key}`]: rx }))
        : [{ data: rx }];
    filter.$or = or;
  }

  return filter as Filter<Record<string, unknown>>;
}

/**
 * Builds the Mongo sort. Prefers the multi-key {@link RecordQueryExtended.sort}
 * array (preserving its order), falling back to the legacy single-key
 * `sortBy` / `sortDir`, then to newest-first.
 *
 * Only known field keys (and the audit columns) are honoured so callers can't
 * sort by arbitrary paths.
 */
export function buildSort(
  query: RecordQueryExtended,
  object: ObjectMetadata,
): Sort {
  const known = new Set(object.fields.map((f) => f.key));
  const isSortable = (field: string): boolean =>
    field === "createdAt" || field === "updatedAt" || known.has(field);

  // Multi-key sort takes precedence.
  if (query.sort && query.sort.length > 0) {
    const sort: Record<string, 1 | -1> = {};
    for (const key of query.sort) {
      if (!key.field || !isSortable(key.field)) continue;
      sort[fieldPath(key.field)] = key.dir === "asc" ? 1 : -1;
    }
    if (Object.keys(sort).length > 0) return sort;
  }

  // Legacy single-key sort.
  const dir = query.sortDir === "asc" ? 1 : -1;
  if (query.sortBy && isSortable(query.sortBy)) {
    return { [fieldPath(query.sortBy)]: dir };
  }

  return { createdAt: -1 };
}

/* -------------------------------------------------------------------------- */
/* Pagination helpers                                                          */
/* -------------------------------------------------------------------------- */

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 200;

export function clampPageSize(pageSize?: number): number {
  if (!pageSize || pageSize <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(pageSize, MAX_PAGE_SIZE);
}

export function clampPage(page?: number): number {
  if (!page || page < 1) return 1;
  return Math.floor(page);
}

/* -------------------------------------------------------------------------- */
/* Display-label helpers                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Picks the field whose value is used as a record's human title.
 * Order: the explicit `isLabel` field → first required TEXT/EMAIL field →
 * first TEXT/EMAIL field → first field of any type.
 */
export function pickLabelField(
  object: ObjectMetadata,
): FieldMetadata | undefined {
  const labelled = object.fields.find((f) => f.isLabel);
  if (labelled) return labelled;

  const textish = object.fields.filter(
    (f) => f.type === "TEXT" || f.type === "EMAIL",
  );
  const requiredText = textish.find((f) => f.required);
  if (requiredText) return requiredText;
  if (textish.length > 0) return textish[0];

  return object.fields[0];
}

export function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(stringifyValue).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Common composite shapes (currency, link, relation, etc.) — prefer a
    // human-readable sub-field.
    for (const k of ["label", "name", "title", "value", "url", "text"]) {
      const candidate = obj[k];
      if (typeof candidate === "string" && candidate) return candidate;
    }
    return "";
  }
  return "";
}

export function resolveLabel(record: CrmRecord, object: ObjectMetadata): string {
  const field = pickLabelField(object);
  if (field) {
    const raw = stringifyValue(record.data[field.key]);
    if (raw.trim()) return raw;
  }
  return `${object.labelSingular} ${record._id.slice(-6)}`;
}

export function withLabel(
  record: CrmRecord,
  object: ObjectMetadata,
): CrmRecordWithLabel {
  return { ...record, label: resolveLabel(record, object) };
}
