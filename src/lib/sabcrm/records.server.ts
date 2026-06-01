import "server-only";

/**
 * SabCRM — generic record runtime (server-only).
 *
 * One implementation drives CRUD + query for *every* object (standard or
 * custom). Records are stored as metadata-driven documents in the
 * `sabcrm_records` collection: a free-form `data` map keyed by the object's
 * field keys, plus scoping + audit columns.
 *
 * Scoping mirrors the rest of SabNode's CRM: every query is tenant-scoped by
 * `projectId` and owner-scoped by `userId`/workspace. Ids are exchanged with
 * callers as ObjectId-safe strings; this module is the single place that
 * crosses the string <-> ObjectId boundary.
 *
 * Display labels are resolved from object metadata (the field flagged
 * `isLabel`, falling back to the first TEXT/EMAIL field, then to the id) so
 * the table/board/command-menu runtimes never need per-object code.
 *
 * The persisted document shape is owned by `./db` ({@link SabcrmRecordDoc});
 * this module maps between that shape and the public {@link CrmRecord}.
 *
 * Query model (all additive / backwards compatible):
 *   - {@link RecordQuery.filters}  — legacy exact-match `{ field: value }` map.
 *   - {@link RecordQueryExtended.conditions} — typed per-field operators
 *     (eq/neq/contains/gt/gte/lt/lte/in/isEmpty …) ANDed together.
 *   - {@link RecordQueryExtended.sort} — multi-key ordering, takes precedence
 *     over the legacy single-key `sortBy` / `sortDir`.
 *   - {@link groupRecords} — bucket records by a SELECT field for kanban.
 */

import { ObjectId, type Filter, type Sort } from "mongodb";

import { sabcrmRecords } from "./db";
import { getObject } from "./objects.server";
import type {
  CrmRecord,
  CrmRecordWithLabel,
  FieldMetadata,
  FieldOption,
  ObjectMetadata,
  RecordPage,
  RecordQuery,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Persisted shape                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Local view of a persisted record as actually stored in `sabcrm_records`.
 *
 * `db.ts` declares the collection type as
 * `WithMongoId & Omit<CrmRecord, "id"> & { projectId }`, which keeps the
 * ISO-string `createdAt`/`updatedAt` from {@link CrmRecord} and a Mongo
 * `_id: ObjectId`. We restate that shape here with an unambiguous
 * `_id: ObjectId` so the mappers below can call `.toHexString()` without
 * fighting the intersection's `_id` type. Field names/types stay identical so
 * documents round-trip through the typed collection cleanly.
 */
interface StoredRecord {
  _id: ObjectId;
  /** Tenant scope — every query is filtered by this. */
  projectId: string;
  /** Owning workspace/user (owner scope — mirrors existing CRM). */
  userId: string;
  /** Object slug this record belongs to. */
  object: string;
  data: Record<string, unknown>;
  /** ISO-8601 timestamp. */
  createdAt: string;
  /** ISO-8601 timestamp. */
  updatedAt: string;
}

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 200;
/**
 * Upper bound on the requested page index. Bounds the computed `skip` so a
 * hostile / runaway `page` can never produce a non-finite skip or an
 * unbounded scan. 1e7 pages × the max page size is already far past any real
 * dataset; callers asking beyond it simply get the last clamped page.
 */
const MAX_PAGE = 10_000_000;

/* -------------------------------------------------------------------------- */
/* Typed query primitives (additive)                                          */
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

/** Operators whose Mongo expression needs a caller-supplied value. */
const OPERATORS_REQUIRING_VALUE: ReadonlySet<FilterOperator> =
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
const VALID_OPERATORS: ReadonlySet<string> = new Set<FilterOperator>([
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
/* Id helpers (the single string <-> ObjectId boundary)                       */
/* -------------------------------------------------------------------------- */

/**
 * Returns an {@link ObjectId} for a caller-supplied id, or `null` if invalid.
 *
 * Hardened against malformed input: `ObjectId.isValid` accepts any 12-byte
 * Buffer or 24-char hex string but will happily coerce a 12-char ASCII string
 * (e.g. `"deletethis!!"`) too, so we additionally require a plain non-empty
 * string. Non-string / empty / whitespace ids short-circuit to `null`, which
 * every caller maps onto a clean not-found result rather than a thrown error.
 */
function toObjectId(id: unknown): ObjectId | null {
  if (typeof id !== "string") return null;
  const trimmed = id.trim();
  if (!trimmed || !ObjectId.isValid(trimmed)) return null;
  return new ObjectId(trimmed);
}

/* -------------------------------------------------------------------------- */
/* Query-value safety ($-injection defence)                                   */
/* -------------------------------------------------------------------------- */

/**
 * A value is "operator-bearing" when it is a plain object that carries a
 * MongoDB operator key (`$gt`, `$where`, `$function`, `$ne`, …) or a dotted
 * path key. Such values must NEVER be spread into a query straight from caller
 * input — doing so would let a request smuggle its own query operators past the
 * typed builder (NoSQL injection). Legitimate composite field values
 * (currency `{ amount, currency }`, relation `{ id, label }`, etc.) contain no
 * `$`/`.`-prefixed keys and are therefore considered safe.
 *
 * Detection is shallow-recursive: nested objects/arrays are inspected too, so a
 * payload like `{ a: { $where: "…" } }` is still rejected.
 */
function hasOperatorKeys(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasOperatorKeys);
  }
  if (value === null || typeof value !== "object") return false;
  if (value instanceof Date) return false;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (key.startsWith("$") || key.includes(".")) return true;
    if (hasOperatorKeys((value as Record<string, unknown>)[key])) return true;
  }
  return false;
}

/**
 * Sanitises a caller-supplied value destined to be used as a *raw* match value
 * (i.e. placed into the query without our own wrapping operator). Returns the
 * value unchanged when it is injection-safe, or `undefined` when it carries
 * Mongo operators / dotted keys (signalling the caller to drop the clause).
 *
 * Primitives, `Date`s and arrays/objects free of `$`/`.` keys pass through
 * untouched so all legitimate exact-match queries keep working.
 */
function safeMatchValue(value: unknown): unknown | undefined {
  return hasOperatorKeys(value) ? undefined : value;
}

/**
 * Rejects legacy-filter / field keys that could escape the `data.<key>` path or
 * pollute the query object: anything containing `$`, `.` or the well-known
 * prototype-pollution keys. Field keys in this module are always simple
 * identifiers, so this is a tightening with no effect on valid input.
 */
function isSafeFilterKey(key: string): boolean {
  if (!key) return false;
  if (key.includes("$") || key.includes(".")) return false;
  if (key === "__proto__" || key === "constructor" || key === "prototype") {
    return false;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/* Serialisation                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Normalises a raw collection document into our {@link StoredRecord} view.
 * The collection's declared `_id` type is an awkward intersection, so we read
 * the document loosely and re-narrow `_id` to a concrete {@link ObjectId}.
 */
function asStored(doc: Record<string, unknown>): StoredRecord {
  const rawId = doc._id;
  const _id = rawId instanceof ObjectId ? rawId : new ObjectId(String(rawId));
  return {
    _id,
    projectId: String(doc.projectId ?? ""),
    userId: String(doc.userId ?? ""),
    object: String(doc.object ?? ""),
    data: (doc.data as Record<string, unknown>) ?? {},
    createdAt: String(doc.createdAt ?? new Date().toISOString()),
    updatedAt: String(doc.updatedAt ?? new Date().toISOString()),
  };
}

function toCrmRecord(doc: StoredRecord): CrmRecord {
  return {
    _id: doc._id.toHexString(),
    object: doc.object,
    userId: doc.userId,
    data: doc.data ?? {},
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Display-label resolution                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Picks the field whose value is used as a record's human title.
 * Order: the explicit `isLabel` field → first required TEXT/EMAIL field →
 * first TEXT/EMAIL field → first field of any type.
 */
function pickLabelField(object: ObjectMetadata): FieldMetadata | undefined {
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

function stringifyValue(value: unknown): string {
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

function resolveLabel(record: CrmRecord, object: ObjectMetadata): string {
  const field = pickLabelField(object);
  if (field) {
    const raw = stringifyValue(record.data[field.key]);
    if (raw.trim()) return raw;
  }
  return `${object.labelSingular} ${record._id.slice(-6)}`;
}

function withLabel(
  record: CrmRecord,
  object: ObjectMetadata,
): CrmRecordWithLabel {
  return { ...record, label: resolveLabel(record, object) };
}

/* -------------------------------------------------------------------------- */
/* Query building                                                             */
/* -------------------------------------------------------------------------- */

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Resolve a queryable field key to its Mongo document path. */
function fieldPath(field: string): string {
  return field === "createdAt" || field === "updatedAt"
    ? field
    : `data.${field}`;
}

/**
 * Translate one typed condition into a Mongo expression keyed by the field's
 * document path. Returns `null` when the condition is a no-op (e.g. an unknown
 * operator, or a comparison operator given no value).
 */
function conditionToMongo(
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

  // Operators that place a *raw* caller value into the query run it through the
  // injection guard first: an operator-bearing object (e.g. `{ $where: "…" }`)
  // makes the whole clause a no-op rather than smuggling a Mongo operator in.
  // `in`/`notIn` additionally drop any operator-bearing array elements so a
  // single poisoned member can't taint the set.
  const safeArray = (raw: unknown): unknown[] | null => {
    const arr = Array.isArray(raw) ? raw : [raw];
    const clean = arr.filter((item) => safeMatchValue(item) !== undefined);
    return clean.length > 0 ? clean : null;
  };

  switch (op) {
    case "eq": {
      const safe = safeMatchValue(value);
      return safe === undefined ? null : { path, expr: safe };
    }
    case "neq": {
      const safe = safeMatchValue(value);
      return safe === undefined ? null : { path, expr: { $ne: safe } };
    }
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
    case "gt": {
      const safe = safeMatchValue(value);
      return safe === undefined ? null : { path, expr: { $gt: safe } };
    }
    case "gte": {
      const safe = safeMatchValue(value);
      return safe === undefined ? null : { path, expr: { $gte: safe } };
    }
    case "lt": {
      const safe = safeMatchValue(value);
      return safe === undefined ? null : { path, expr: { $lt: safe } };
    }
    case "lte": {
      const safe = safeMatchValue(value);
      return safe === undefined ? null : { path, expr: { $lte: safe } };
    }
    case "in": {
      const arr = safeArray(value);
      return arr ? { path, expr: { $in: arr } } : null;
    }
    case "notIn": {
      const arr = safeArray(value);
      return arr ? { path, expr: { $nin: arr } } : null;
    }
    case "isEmpty":
      // Missing, null, or empty string.
      return { path, expr: { $in: [null, ""] } };
    case "isNotEmpty":
      return { path, expr: { $exists: true, $nin: [null, ""] } };
    default:
      return null;
  }
}

/**
 * Builds the Mongo filter for a list query: tenant + owner scope, object slug,
 * legacy exact-match field filters, typed per-field conditions, and a free-text
 * search across the object's searchable (TEXT/EMAIL/PHONE/LINK) fields.
 *
 * `search` (an `$or` over searchable fields) and the typed conditions (an
 * `$and` of per-field clauses) are kept in separate operators so they compose
 * correctly — search OR-matches widen, conditions AND-narrow.
 */
function buildFilter(
  projectId: string,
  userId: string,
  query: RecordQueryExtended,
  object: ObjectMetadata,
): Filter<StoredRecord> {
  const filter: Filter<StoredRecord> = {
    projectId,
    userId,
    object: query.object,
  };

  // Legacy exact-match filters (Record<field, value>). Both the key and the
  // value are caller-supplied, so we (a) reject keys that could escape the
  // `data.<key>` path or pollute the query object and (b) drop values that
  // carry Mongo operators / dotted keys — only injection-safe scalars, dates,
  // and operator-free composite objects are passed straight through.
  if (query.filters) {
    for (const [key, value] of Object.entries(query.filters)) {
      if (value === undefined || value === null || value === "") continue;
      if (!isSafeFilterKey(key)) continue;
      const safe = safeMatchValue(value);
      if (safe === undefined) continue;
      (filter as Record<string, unknown>)[`data.${key}`] = safe;
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
      (filter as Record<string, unknown>).$and = and;
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
    const or: Array<Filter<StoredRecord>> =
      searchable.length > 0
        ? searchable.map(
            (f) =>
              ({ [`data.${f.key}`]: rx }) as unknown as Filter<StoredRecord>,
          )
        : [{ data: rx } as unknown as Filter<StoredRecord>];
    filter.$or = or;
  }

  return filter;
}

/**
 * Builds the Mongo sort. Prefers the multi-key {@link RecordQueryExtended.sort}
 * array (preserving its order), falling back to the legacy single-key
 * `sortBy` / `sortDir`, then to newest-first.
 *
 * Only known field keys (and the audit columns) are honoured so callers can't
 * sort by arbitrary paths.
 */
function buildSort(query: RecordQueryExtended, object: ObjectMetadata): Sort {
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

/**
 * Clamps a requested page size into `[1, MAX_PAGE_SIZE]`, defaulting when the
 * input is missing / non-finite (NaN, ±Infinity) / non-positive. The result is
 * always a positive integer so it is safe to hand to Mongo's `.limit()`.
 */
function clampPageSize(pageSize?: number): number {
  if (typeof pageSize !== "number" || !Number.isFinite(pageSize)) {
    return DEFAULT_PAGE_SIZE;
  }
  if (pageSize <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(pageSize), MAX_PAGE_SIZE);
}

/**
 * Clamps a requested page index into `[1, MAX_PAGE]`, defaulting to `1` when the
 * input is missing / non-finite / below 1. Capping the upper bound keeps the
 * computed `skip` finite (an `Infinity` page would otherwise produce an
 * `Infinity`/`NaN` skip and throw inside the driver).
 */
function clampPage(page?: number): number {
  if (typeof page !== "number" || !Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.floor(page), MAX_PAGE);
}

/* -------------------------------------------------------------------------- */
/* Data sanitisation                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Restricts a caller-supplied data map to the object's declared field keys and
 * (optionally) fills in declared default values. This keeps documents tidy and
 * prevents callers from writing arbitrary top-level data keys.
 */
function sanitiseData(
  object: ObjectMetadata,
  data: Record<string, unknown>,
  opts: { applyDefaults: boolean },
): Record<string, unknown> {
  const allowed = new Set(object.fields.map((f) => f.key));
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data ?? {})) {
    if (allowed.has(key)) out[key] = value;
  }

  if (opts.applyDefaults) {
    for (const field of object.fields) {
      if (field.defaultValue !== undefined && out[field.key] === undefined) {
        out[field.key] = field.defaultValue;
      }
    }
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Lists records for one object with filter/search/sort/pagination, returning a
 * {@link RecordPage} whose records carry a resolved display label.
 *
 * Accepts the extended query shape (typed `conditions` + multi-key `sort`); a
 * plain {@link RecordQuery} is a valid argument too, so existing callers are
 * unaffected.
 *
 * @throws if the requested object does not exist for this project.
 */
export async function listRecords(
  projectId: string,
  userId: string,
  query: RecordQueryExtended,
): Promise<RecordPage> {
  const object = await getObject(projectId, query.object);
  if (!object) {
    throw new Error(`Unknown SabCRM object: ${query.object}`);
  }

  const col = await sabcrmRecords();
  const filter = buildFilter(projectId, userId, query, object);
  const sort = buildSort(query, object);
  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize);

  const [rawDocs, total] = await Promise.all([
    col
      // The collection's declared filter/sort generics differ from our local
      // StoredRecord view; the underlying Mongo query is identical.
      .find(filter as unknown as Filter<Record<string, unknown>>)
      .sort(sort)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
    col.countDocuments(filter as unknown as Filter<Record<string, unknown>>),
  ]);

  const records = rawDocs.map((doc) =>
    withLabel(toCrmRecord(asStored(doc as Record<string, unknown>)), object),
  );

  return { records, total, page, pageSize };
}

/**
 * Fetches a single record by id, scoped to the project + owner. Returns `null`
 * when the id is malformed or no matching record exists.
 */
export async function getRecord(
  projectId: string,
  userId: string,
  id: string,
): Promise<CrmRecordWithLabel | null> {
  const _id = toObjectId(id);
  if (!_id) return null;

  const col = await sabcrmRecords();
  const raw = await col.findOne({
    _id,
    projectId,
    userId,
  } as unknown as Filter<Record<string, unknown>>);
  if (!raw) return null;

  const record = toCrmRecord(asStored(raw as Record<string, unknown>));
  const object = await getObject(projectId, record.object);
  if (!object) return null;

  return withLabel(record, object);
}

/**
 * Creates a record under `object`, scoped to the project + owner. Unknown keys
 * in `data` are dropped so the document only ever holds declared field keys;
 * declared `defaultValue`s fill in any omitted fields.
 *
 * @throws if the object does not exist for this project.
 */
export async function createRecord(
  projectId: string,
  userId: string,
  object: string,
  data: Record<string, unknown>,
): Promise<CrmRecord> {
  const meta = await getObject(projectId, object);
  if (!meta) {
    throw new Error(`Unknown SabCRM object: ${object}`);
  }

  const clean = sanitiseData(meta, data, { applyDefaults: true });
  const now = new Date().toISOString();

  const doc = {
    projectId,
    userId,
    object,
    data: clean,
    createdAt: now,
    updatedAt: now,
  };

  const col = await sabcrmRecords();
  // The collection's insert type expects its own intersection shape; our `doc`
  // is the runtime-correct subset (Mongo assigns `_id`).
  const result = await col.insertOne(
    doc as unknown as Parameters<typeof col.insertOne>[0],
  );

  return toCrmRecord({ ...doc, _id: result.insertedId });
}

/**
 * Patches a record's `data` (shallow merge of known field keys) and bumps
 * `updatedAt`. Returns the updated record, or `null` if it does not exist /
 * the id is malformed.
 *
 * @throws if the underlying object metadata is missing.
 */
export async function updateRecord(
  projectId: string,
  userId: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<CrmRecord | null> {
  const _id = toObjectId(id);
  if (!_id) return null;

  const col = await sabcrmRecords();
  const existingRaw = await col.findOne({
    _id,
    projectId,
    userId,
  } as unknown as Filter<Record<string, unknown>>);
  if (!existingRaw) return null;

  const existing = asStored(existingRaw as Record<string, unknown>);
  const meta = await getObject(projectId, existing.object);
  if (!meta) {
    throw new Error(`Unknown SabCRM object: ${existing.object}`);
  }

  const clean = sanitiseData(meta, patch, { applyDefaults: false });

  // Build a dotted $set so we only touch the supplied keys.
  const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const [key, value] of Object.entries(clean)) {
    set[`data.${key}`] = value;
  }

  const updated = await col.findOneAndUpdate(
    { _id, projectId, userId } as unknown as Filter<Record<string, unknown>>,
    { $set: set },
    { returnDocument: "after" },
  );

  return updated
    ? toCrmRecord(asStored(updated as Record<string, unknown>))
    : null;
}

/**
 * Deletes a record, scoped to the project + owner. Returns `true` when a
 * document was removed.
 */
export async function deleteRecord(
  projectId: string,
  userId: string,
  id: string,
): Promise<boolean> {
  const _id = toObjectId(id);
  if (!_id) return false;

  const col = await sabcrmRecords();
  const result = await col.deleteOne({
    _id,
    projectId,
    userId,
  } as unknown as Filter<Record<string, unknown>>);
  return result.deletedCount === 1;
}

/* -------------------------------------------------------------------------- */
/* Board grouping (kanban)                                                    */
/* -------------------------------------------------------------------------- */

/** One bucket of records sharing the same value of a SELECT field. */
export interface RecordGroup {
  /** The SELECT option value (or "" for the unassigned/empty bucket). */
  value: string;
  /** Human label for the option; falls back to the raw value. */
  label: string;
  /** Optional option colour from the field metadata. */
  color?: string;
  records: CrmRecordWithLabel[];
  /** Records in this bucket (within the board read cap). */
  total: number;
}

/** Result of {@link groupRecords}. */
export interface GroupedRecords {
  object: string;
  groupByField: string;
  groups: RecordGroup[];
  /** Total records across all groups (within the board read cap). */
  total: number;
}

/** Sentinel value/key for records whose group field is empty. */
const UNGROUPED_VALUE = "";
const UNGROUPED_LABEL = "Unassigned";

const DEFAULT_BOARD_CAP = 500;
const MAX_BOARD_CAP = 1000;

/**
 * Buckets records by the value of a SELECT field, for kanban-style boards.
 *
 * Every declared option of the SELECT field gets a column (even when empty), in
 * option order, followed by any unexpected/renamed values, then an "Unassigned"
 * column for records with no value.
 *
 * Honours all standard {@link RecordQueryExtended} filtering (search, legacy
 * filters, typed conditions) and ordering within each bucket. Reads are capped
 * per-board (not per-column) via `query.pageSize` to avoid unbounded scans.
 *
 * @throws if the object is unknown, the field is unknown, or the field is not a
 *         SELECT field.
 */
export async function groupRecords(
  projectId: string,
  userId: string,
  object: string,
  groupByFieldKey: string,
  query?: Omit<RecordQueryExtended, "object" | "page">,
): Promise<GroupedRecords> {
  const meta = await getObject(projectId, object);
  if (!meta) {
    throw new Error(`Unknown SabCRM object: ${object}`);
  }

  const field = meta.fields.find((f) => f.key === groupByFieldKey);
  if (!field) {
    throw new Error(`Unknown SabCRM field: ${groupByFieldKey} on ${object}`);
  }
  if (field.type !== "SELECT") {
    throw new Error(
      `Cannot group by "${groupByFieldKey}": only SELECT fields are groupable (got ${field.type}).`,
    );
  }

  const fullQuery: RecordQueryExtended = { ...(query ?? {}), object };

  const col = await sabcrmRecords();
  const filter = buildFilter(projectId, userId, fullQuery, meta);
  const sort = buildSort(fullQuery, meta);

  // Per-board read cap. Guard the caller-supplied `pageSize` against
  // missing / non-finite values so the `.limit()` below is always a positive
  // integer in `[1, MAX_BOARD_CAP]`.
  const requestedCap =
    typeof query?.pageSize === "number" && Number.isFinite(query.pageSize)
      ? Math.floor(query.pageSize)
      : DEFAULT_BOARD_CAP;
  const cap = Math.min(MAX_BOARD_CAP, Math.max(1, requestedCap));

  const rawDocs = await col
    .find(filter as unknown as Filter<Record<string, unknown>>)
    .sort(sort)
    .limit(cap)
    .toArray();

  const records = rawDocs.map((doc) =>
    withLabel(toCrmRecord(asStored(doc as Record<string, unknown>)), meta),
  );

  // Seed buckets in option order so empty columns still render.
  const options: FieldOption[] = field.options ?? [];
  const buckets = new Map<string, RecordGroup>();
  for (const opt of options) {
    buckets.set(opt.value, {
      value: opt.value,
      label: opt.label,
      color: opt.color,
      records: [],
      total: 0,
    });
  }
  buckets.set(UNGROUPED_VALUE, {
    value: UNGROUPED_VALUE,
    label: UNGROUPED_LABEL,
    records: [],
    total: 0,
  });

  for (const record of records) {
    const raw = record.data[groupByFieldKey];
    const value =
      raw === undefined || raw === null || raw === ""
        ? UNGROUPED_VALUE
        : String(raw);

    let bucket = buckets.get(value);
    if (!bucket) {
      // A value not present in the field's declared options (e.g. a renamed
      // option). Surface it as its own column rather than dropping records.
      bucket = { value, label: value, records: [], total: 0 };
      buckets.set(value, bucket);
    }
    bucket.records.push(record);
    bucket.total += 1;
  }

  // Order: declared options first (in declaration order), then any unexpected
  // values (in insertion order), then the Unassigned column last.
  const declared = new Set(options.map((o) => o.value));
  const ordered: RecordGroup[] = [];
  for (const opt of options) {
    const b = buckets.get(opt.value);
    if (b) ordered.push(b);
  }
  for (const [key, b] of buckets) {
    if (key === UNGROUPED_VALUE || declared.has(key)) continue;
    ordered.push(b);
  }
  const ungrouped = buckets.get(UNGROUPED_VALUE);
  if (ungrouped) ordered.push(ungrouped);

  return {
    object,
    groupByField: groupByFieldKey,
    groups: ordered,
    total: records.length,
  };
}
