import "server-only";

/**
 * SabCRM — import / export server helpers.
 *
 * Two primary concerns:
 *
 *   IMPORT: Given a set of raw string rows (from a parsed CSV or XLSX file),
 *   a column→field mapping, and the target object slug, validate each row
 *   against the object's FieldMetadata types and bulk-insert tenant-scoped
 *   records via the existing `createRecord` runtime. Validation errors are
 *   collected per-row (import continues) so the caller can report them back to
 *   the user in the UI.
 *
 *   EXPORT: Read all (or a paginated slice of) records for one object slug and
 *   return a serialisable `ExportRow[]` array + ordered header strings. The
 *   client-side helpers in `@/lib/crm-list-export` (`downloadCsv`,
 *   `downloadXlsx`) consume exactly this shape — pass the result straight
 *   through to them without further transformation.
 *
 * Design constraints:
 *   - MongoDB only; tenant-scoped by `projectId` on every read/write.
 *   - Reuses `createRecord` (from `./records.server`) for all inserts so
 *     `sanitiseData` + defaults are applied uniformly.
 *   - Reuses `getObject` / `listObjects` for metadata resolution.
 *   - No `any` — every field value is either coerced to its declared
 *     FieldType or surfaces as a typed validation error.
 *   - RELATION fields are skipped on import (relations are stored as record-id
 *     strings that the UI sets post-import) and exported as their raw stored
 *     value (typically an id string) — callers display relation labels
 *     separately.
 *   - FILE fields are excluded from import (SabFiles manages uploads) and
 *     exported as the stored value (a SabFiles `fileId`) for round-trip fidelity.
 *
 * Cap limits:
 *   - Import: up to MAX_IMPORT_ROWS rows per call. Callers should chunk
 *     larger files and call repeatedly.
 *   - Export: up to MAX_EXPORT_ROWS rows (newest-first) to keep the payload
 *     manageable in a serverless function.
 */

import type { Filter } from "mongodb";

import { sabcrmRecords } from "./db";
import { getObject, listObjects } from "./objects.server";
import { createRecord } from "./records.server";
import type {
  CrmRecord,
  FieldMetadata,
  FieldType,
  ObjectMetadata,
} from "./types";
import type { ExportRow } from "@/lib/crm-list-export";

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export const MAX_IMPORT_ROWS = 5_000;
export const MAX_EXPORT_ROWS = 10_000;

/**
 * Maximum validation error strings collected per row.
 * Prevents a pathologically-bad row from generating unbounded error arrays.
 */
export const MAX_ROW_ERRORS = 20;

/* -------------------------------------------------------------------------- */
/* Shared types                                                                */
/* -------------------------------------------------------------------------- */

/**
 * A raw row from a parsed CSV / XLSX file: column header → raw cell string.
 * Empty cells are represented as empty strings, never null/undefined.
 */
export type RawRow = Record<string, string>;

/**
 * Mapping from an object's field key to the CSV column header that supplies
 * its data. Only the entries present in this map are imported — unmapped
 * fields are skipped (their declared `defaultValue`, if any, is applied by
 * `createRecord`).
 */
export type ColumnMapping = Record<string, string>;

/** Result from importing one row (success or failure). */
export type ImportRowResult =
  | { ok: true; record: CrmRecord }
  | { ok: false; errors: string[] };

/** Aggregate result returned to the caller after a batch import. */
export interface ImportBatchResult {
  /** Total rows that were processed. */
  total: number;
  /** Rows successfully inserted into MongoDB. */
  succeeded: number;
  /** Rows that failed validation or insert. */
  failed: number;
  /** Per-row results in input order (length === `total`). */
  rows: ImportRowResult[];
}

/** Options for `importRecords`. */
export interface ImportRecordsOptions {
  /** Object slug to import into (e.g. `"companies"`). */
  object: string;
  /**
   * Column→field mapping. Key = object field key; value = CSV column header.
   * Fields absent from the mapping fall back to their `defaultValue`.
   */
  columnMapping: ColumnMapping;
  /**
   * Raw rows (one object per row, header name → raw string value).
   * Must not exceed {@link MAX_IMPORT_ROWS}.
   */
  rows: RawRow[];
  /** Tenant project id. */
  projectId: string;
  /** Owning user id (stored on each inserted record). */
  userId: string;
  /**
   * When `true`, the entire batch is aborted on the first validation error
   * and `ImportBatchResult.rows` will have exactly one failure entry.
   * Default: `false` — validation errors are collected per-row and import
   * continues for valid rows.
   */
  stopOnFirstError?: boolean;
}

/** Options for `exportRecords`. */
export interface ExportRecordsOptions {
  /** Object slug to export (e.g. `"opportunities"`). */
  object: string;
  /** Tenant project id. */
  projectId: string;
  /** Owning user id — only this user's records are exported. */
  userId: string;
  /**
   * Optional ordered list of field keys to include in the export.
   * Defaults to every non-RELATION, non-FILE field declared on the object.
   * Pass an explicit list to control column order in the downloaded file.
   */
  fields?: string[];
  /** Max rows to export; capped at {@link MAX_EXPORT_ROWS}. Default: 1000. */
  limit?: number;
}

/** The serialisable payload returned by `exportRecords`. */
export interface ExportRecordsResult {
  /**
   * Ordered column headers corresponding to the selected fields.
   * First column is always `"id"` (the record's MongoDB hex id), last two
   * are `"createdAt"` / `"updatedAt"`.
   */
  headers: string[];
  /** Serialisable rows ready to pass to `downloadCsv` / `downloadXlsx`. */
  rows: ExportRow[];
  /** Total matching records in the collection (may exceed `rows.length`). */
  total: number;
  /** Whether the result was truncated to {@link MAX_EXPORT_ROWS}. */
  capped: boolean;
}

/* -------------------------------------------------------------------------- */
/* Field-type coercion (import path)                                          */
/* -------------------------------------------------------------------------- */

/**
 * Coerces a raw cell string into the value expected by the field's `FieldType`.
 *
 * Returns `{ ok: true, value }` on success where `value` is ready to store
 * in `record.data[field.key]`, or `{ ok: false, error }` describing what went
 * wrong. An empty cell for a non-required field returns `{ ok: true, value:
 * undefined }` so `createRecord` can apply the field's `defaultValue`.
 *
 * RELATION fields always return `{ ok: true, value: undefined }` — they are
 * not settable via CSV import (the picker sets them post-import).
 *
 * FILE fields always return `{ ok: true, value: undefined }` — uploads come
 * exclusively through SabFiles; raw cell values are not accepted.
 */
function coerceCell(
  raw: string,
  field: FieldMetadata,
): { ok: true; value: unknown } | { ok: false; error: string } {
  // RELATION and FILE fields are not importable via CSV.
  if (field.type === "RELATION" || field.type === "FILE") {
    return { ok: true, value: undefined };
  }

  const str = raw.trim();

  if (str.length === 0) {
    if (field.required) {
      return { ok: false, error: `Required field "${field.label}" is missing.` };
    }
    return { ok: true, value: undefined };
  }

  switch (field.type as FieldType) {
    case "TEXT":
    case "EMAIL":
    case "PHONE":
    case "LINK":
      return { ok: true, value: str };

    case "NUMBER": {
      const n = Number(str.replace(/,/g, ""));
      if (!Number.isFinite(n)) {
        return {
          ok: false,
          error: `Field "${field.label}" expects a number, got: ${str}`,
        };
      }
      return { ok: true, value: n };
    }

    case "CURRENCY": {
      // Currency is stored as a number (amount in the base unit).
      // Strip currency symbols, spaces, and thousands separators.
      // Keep digits, decimal point, and an optional leading minus sign.
      const stripped = str.replace(/[^0-9.-]/g, "");
      // Reject if nothing numeric remains after stripping (e.g. pure alpha input).
      const n = stripped.length === 0 ? NaN : Number(stripped);
      if (!Number.isFinite(n)) {
        return {
          ok: false,
          error: `Field "${field.label}" expects a numeric currency value, got: ${str}`,
        };
      }
      return { ok: true, value: n };
    }

    case "BOOLEAN": {
      const truthy = new Set(["true", "yes", "1", "y", "on"]);
      const falsy = new Set(["false", "no", "0", "n", "off"]);
      const lc = str.toLowerCase();
      if (truthy.has(lc)) return { ok: true, value: true };
      if (falsy.has(lc)) return { ok: true, value: false };
      return {
        ok: false,
        error: `Field "${field.label}" expects true/false, got: ${str}`,
      };
    }

    case "DATE": {
      const d = new Date(str);
      if (Number.isNaN(d.getTime())) {
        return {
          ok: false,
          error: `Field "${field.label}" expects a date (YYYY-MM-DD), got: ${str}`,
        };
      }
      return { ok: true, value: d.toISOString().slice(0, 10) };
    }

    case "DATE_TIME": {
      const d = new Date(str);
      if (Number.isNaN(d.getTime())) {
        return {
          ok: false,
          error: `Field "${field.label}" expects a date-time (ISO 8601), got: ${str}`,
        };
      }
      return { ok: true, value: d.toISOString() };
    }

    case "SELECT": {
      const options = field.options ?? [];
      // Case-insensitive match against declared option values or labels.
      const match =
        options.find((o) => o.value.toLowerCase() === str.toLowerCase()) ??
        options.find((o) => o.label.toLowerCase() === str.toLowerCase());
      if (!match) {
        const allowed = options.map((o) => o.value).join(", ");
        return {
          ok: false,
          error: `Field "${field.label}" must be one of: ${allowed || "(none defined)"}. Got: ${str}`,
        };
      }
      return { ok: true, value: match.value };
    }

    case "MULTI_SELECT": {
      const options = field.options ?? [];
      // Accepts pipe-separated or comma-separated values.
      const parts = str
        .split(/[|,]/)
        .map((p) => p.trim())
        .filter(Boolean);
      const resolved: string[] = [];
      for (const part of parts) {
        const match =
          options.find((o) => o.value.toLowerCase() === part.toLowerCase()) ??
          options.find((o) => o.label.toLowerCase() === part.toLowerCase());
        if (!match) {
          const allowed = options.map((o) => o.value).join(", ");
          return {
            ok: false,
            error: `Field "${field.label}" got unknown option "${part}". Allowed: ${allowed || "(none defined)"}`,
          };
        }
        resolved.push(match.value);
      }
      return { ok: true, value: resolved };
    }

    case "RATING": {
      const n = Number(str);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return {
          ok: false,
          error: `Field "${field.label}" expects a rating from 1 to 5, got: ${str}`,
        };
      }
      return { ok: true, value: n };
    }

    // RELATION + FILE are handled above. Any unknown future FieldType falls
    // through here: store the raw string rather than dropping data.
    default: {
      // Narrow the unreachable arms at compile time without an `any` cast.
      const _exhaustive: never = field.type as never;
      void _exhaustive;
      return { ok: true, value: str };
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Row validation (import path)                                               */
/* -------------------------------------------------------------------------- */

/**
 * Validates a single raw row against the object's field metadata + the caller's
 * column mapping. Returns either a ready-to-insert data map or an array of
 * human-readable error strings (capped at {@link MAX_ROW_ERRORS}).
 *
 * Fields absent from `mapping` are skipped — `createRecord` will apply any
 * declared `defaultValue`. RELATION and FILE fields are always skipped.
 * Columns present in `rawRow` that are not referenced by any field mapping are
 * silently ignored (unknown-column skip).
 */
function validateRow(
  rawRow: RawRow,
  object: ObjectMetadata,
  mapping: ColumnMapping,
): { ok: true; data: Record<string, unknown> } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  /** Append an error only while we are below the per-row cap. */
  const addError = (msg: string): void => {
    if (errors.length < MAX_ROW_ERRORS) {
      errors.push(msg);
    }
  };

  for (const field of object.fields) {
    // Skip system, relation, and file fields — not settable via import.
    if (field.type === "RELATION" || field.type === "FILE") continue;

    const columnHeader = mapping[field.key];
    // If no column is mapped to this field, skip (defaults applied by createRecord).
    if (!columnHeader) {
      // Still check for required fields that have no default value.
      if (field.required && field.defaultValue === undefined) {
        addError(
          `Required field "${field.label}" (${field.key}) has no column mapping and no default value.`,
        );
      }
      continue;
    }

    // Unknown column: the mapped CSV header does not exist in this row.
    // Treat exactly as an empty cell — the field may have a default value.
    const raw: string = Object.prototype.hasOwnProperty.call(rawRow, columnHeader)
      ? rawRow[columnHeader]
      : "";

    const coerced = coerceCell(raw, field);
    if (!coerced.ok) {
      addError(coerced.error);
      continue;
    }
    if (coerced.value !== undefined) {
      data[field.key] = coerced.value;
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data };
}

/* -------------------------------------------------------------------------- */
/* Public: importRecords                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Validates and bulk-inserts records from a parsed CSV/XLSX file.
 *
 * For each raw row:
 *   1. Maps column headers to field keys via `columnMapping`.
 *   2. Coerces each cell to the field's declared FieldType.
 *   3. Collects validation errors per-row (capped at {@link MAX_ROW_ERRORS})
 *      without aborting the rest of the batch — unless `stopOnFirstError` is
 *      set, in which case the first failure (validation OR insert) marks all
 *      remaining rows as skipped and returns immediately.
 *   4. Calls `createRecord` for valid rows (applies `sanitiseData` + defaults).
 *      A transient insert error on one row is recorded and the batch continues
 *      (non-fatal) unless `stopOnFirstError` is set.
 *
 * RELATION and FILE columns are silently skipped — they cannot be set from
 * a flat file; use the record-detail UI post-import.
 *
 * Unknown CSV columns (headers present in `rawRow` but not referenced by any
 * field mapping) are silently ignored — they do not cause validation errors.
 *
 * Returns an {@link ImportBatchResult} so the caller can show a per-row
 * summary in the import wizard UI.
 *
 * @throws `Error` (fatal, no result returned) when:
 *   - `rows.length > MAX_IMPORT_ROWS`
 *   - The object slug is unknown
 */
export async function importRecords(
  opts: ImportRecordsOptions,
): Promise<ImportBatchResult> {
  const { object: slug, columnMapping, rows, projectId, userId, stopOnFirstError } =
    opts;

  if (rows.length === 0) {
    return { total: 0, succeeded: 0, failed: 0, rows: [] };
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `Import exceeds the maximum of ${MAX_IMPORT_ROWS} rows per batch (got ${rows.length}). ` +
        `Split the file into smaller chunks and import each in sequence.`,
    );
  }

  const objectMeta = await getObject(projectId, slug);
  if (!objectMeta) {
    throw new Error(`Unknown SabCRM object: "${slug}". Cannot import records.`);
  }

  let succeeded = 0;
  let failed = 0;
  const rowResults: ImportRowResult[] = [];

  /**
   * Mark all rows from the current cursor position to the end of the input
   * as skipped ("aborted due to earlier error"), update the failed counter,
   * and break out of the loop.
   *
   * Called only when `stopOnFirstError` is true.
   */
  const abortRemaining = (): void => {
    const abortMsg = "Import aborted due to earlier error.";
    const remaining = rows.length - rowResults.length;
    for (let i = 0; i < remaining; i++) {
      rowResults.push({ ok: false, errors: [abortMsg] });
      failed += 1;
    }
  };

  for (const rawRow of rows) {
    const validated = validateRow(rawRow, objectMeta, columnMapping);

    if (!validated.ok) {
      failed += 1;
      rowResults.push({ ok: false, errors: validated.errors });
      if (stopOnFirstError) {
        abortRemaining();
        break;
      }
      continue;
    }

    try {
      const record = await createRecord(projectId, userId, slug, validated.data);
      succeeded += 1;
      rowResults.push({ ok: true, record });
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : "Insert failed.";
      rowResults.push({ ok: false, errors: [msg] });
      if (stopOnFirstError) {
        abortRemaining();
        break;
      }
      // Non-fatal: continue with next row.
    }
  }

  return {
    total: rows.length,
    succeeded,
    failed,
    rows: rowResults,
  };
}

/* -------------------------------------------------------------------------- */
/* Field-value serialisation (export path)                                    */
/* -------------------------------------------------------------------------- */

/**
 * Serialises a single field value into a string suitable for CSV/XLSX cells.
 * Arrays are joined with ` | `. Dates are emitted as ISO strings. Booleans
 * become `"true"` / `"false"`. Objects (e.g. currency composites) are JSON.
 */
function serialiseValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map(serialiseValue).filter(Boolean).join(" | ");
  }
  if (typeof value === "object") {
    // Prefer a human-readable sub-field for composite types.
    const obj = value as Record<string, unknown>;
    for (const k of ["label", "name", "value", "url", "text"]) {
      const v = obj[k];
      if (typeof v === "string" && v) return v;
      if (typeof v === "number") return String(v);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}

/* -------------------------------------------------------------------------- */
/* Header label helpers (export path)                                         */
/* -------------------------------------------------------------------------- */

/**
 * Returns a human-friendly column label for a field key. Uses the field's
 * declared `label` when the field is found on the object. Falls back to the
 * key itself for audit columns (`id`, `createdAt`, `updatedAt`).
 */
function columnLabel(fieldKey: string, object: ObjectMetadata): string {
  if (fieldKey === "id") return "ID";
  if (fieldKey === "createdAt") return "Created At";
  if (fieldKey === "updatedAt") return "Updated At";
  const field = object.fields.find((f) => f.key === fieldKey);
  return field?.label ?? fieldKey;
}

/* -------------------------------------------------------------------------- */
/* Public: exportRecords                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Reads records for one object and serialises them into a flat
 * `{ headers, rows }` shape ready to hand off to `downloadCsv` or
 * `downloadXlsx` from `@/lib/crm-list-export`.
 *
 * Column selection:
 *   - First column: `id` (the record's MongoDB hex string).
 *   - Middle columns: the object's non-RELATION / non-FILE fields, in their
 *     declared order, or the subset/order specified by `opts.fields`.
 *   - Last two columns: `createdAt` / `updatedAt`.
 *
 * RELATION fields are excluded by default (they hold opaque ids that aren't
 * useful in a spreadsheet). Pass them in `opts.fields` explicitly if you want
 * the raw id values.
 *
 * The `rows` array uses field keys as the property names, matching the
 * `ExportRow` type from `@/lib/crm-list-export`. This means you can pass
 * `result.rows` directly to `downloadCsv(filename, result.headers, result.rows)`.
 *
 * @throws `Error` when the object slug is unknown.
 */
export async function exportRecords(
  opts: ExportRecordsOptions,
): Promise<ExportRecordsResult> {
  const { object: slug, projectId, userId } = opts;

  const objectMeta = await getObject(projectId, slug);
  if (!objectMeta) {
    throw new Error(`Unknown SabCRM object: "${slug}". Cannot export records.`);
  }

  // Resolve the list of field keys to export.
  let fieldKeys: string[];
  if (opts.fields && opts.fields.length > 0) {
    // Caller-supplied; validate that each key exists on the object.
    const knownKeys = new Set(objectMeta.fields.map((f) => f.key));
    fieldKeys = opts.fields.filter(
      (k) =>
        knownKeys.has(k) || k === "createdAt" || k === "updatedAt" || k === "id",
    );
  } else {
    // Default: exclude RELATION and FILE fields — they hold opaque ids.
    fieldKeys = objectMeta.fields
      .filter((f) => f.type !== "RELATION" && f.type !== "FILE")
      .map((f) => f.key);
  }

  // Always prepend `id` and append the audit timestamps.
  const exportKeys = [
    "id",
    ...fieldKeys.filter((k) => k !== "id" && k !== "createdAt" && k !== "updatedAt"),
    "createdAt",
    "updatedAt",
  ];

  // Header labels in the same order as exportKeys.
  const headers = exportKeys.map((k) => columnLabel(k, objectMeta));

  const limit = Math.min(
    MAX_EXPORT_ROWS,
    Math.max(1, opts.limit ?? 1_000),
  );

  const col = await sabcrmRecords();
  const filter: Filter<Record<string, unknown>> = {
    projectId,
    userId,
    object: slug,
  } as Filter<Record<string, unknown>>;

  const [rawDocs, total] = await Promise.all([
    col.find(filter).sort({ createdAt: -1 }).limit(limit).toArray(),
    col.countDocuments(filter),
  ]);

  const rows: ExportRow[] = rawDocs.map((doc) => {
    const d = doc as Record<string, unknown>;
    const data = (d.data as Record<string, unknown>) ?? {};

    const row: ExportRow = {};
    for (const key of exportKeys) {
      if (key === "id") {
        // Map the header label "ID" to the id value, and also store under
        // the key "id" so `downloadCsv(headers, rows)` can look it up.
        row["id"] = serialiseValue(
          d._id != null ? String(d._id) : "",
        );
      } else if (key === "createdAt" || key === "updatedAt") {
        row[key] = serialiseValue(d[key]);
      } else {
        row[key] = serialiseValue(data[key]);
      }
    }
    return row;
  });

  return {
    headers,
    rows,
    total,
    capped: total > limit,
  };
}

/* -------------------------------------------------------------------------- */
/* Public: exportAllObjectHeaders                                              */
/* -------------------------------------------------------------------------- */

/**
 * Returns the export header configuration for every object visible to a
 * project. Useful for a "choose object to export" UI that shows a preview of
 * the columns that will be downloaded without fetching any record data.
 *
 * Only non-RELATION, non-FILE fields are included in each object's header list
 * (same default as `exportRecords`). The `id`, `createdAt`, `updatedAt` audit
 * columns are included in every object.
 */
export interface ObjectExportMeta {
  slug: string;
  label: string;
  headers: string[];
  /** The field keys corresponding to `headers` (same order). */
  fieldKeys: string[];
}

export async function exportAllObjectHeaders(
  projectId: string,
): Promise<ObjectExportMeta[]> {
  const objects = await listObjects(projectId);

  return objects.map((obj) => {
    const dataFields = obj.fields.filter(
      (f) => f.type !== "RELATION" && f.type !== "FILE",
    );
    const fieldKeys = [
      "id",
      ...dataFields.map((f) => f.key),
      "createdAt",
      "updatedAt",
    ];
    const headers = fieldKeys.map((k) => columnLabel(k, obj));
    return {
      slug: obj.slug,
      label: obj.labelPlural,
      headers,
      fieldKeys,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Public: buildColumnMappingSuggestions                                      */
/* -------------------------------------------------------------------------- */

/**
 * Given the headers from a CSV/XLSX file and a target object slug, returns a
 * suggested `ColumnMapping` by fuzzy-matching column headers against field
 * labels and field keys.
 *
 * Matching strategy (in priority order):
 *   1. Exact match between `csvHeader` (lowercased) and `field.key` (lowercased).
 *   2. Exact match between `csvHeader` (lowercased) and `field.label` (lowercased).
 *   3. Partial containment: the field key or label is a substring of the header,
 *      or the header is a substring of the field key / label.
 *
 * Returns only mappings where a match was found; unmatched headers are omitted
 * so the UI can prompt the user to map them manually.
 *
 * RELATION and FILE fields are excluded — they are never importable via CSV.
 */
export async function buildColumnMappingSuggestions(
  projectId: string,
  object: string,
  csvHeaders: string[],
): Promise<ColumnMapping> {
  const objectMeta = await getObject(projectId, object);
  if (!objectMeta) return {};

  const importableFields = objectMeta.fields.filter(
    (f) => f.type !== "RELATION" && f.type !== "FILE",
  );

  const mapping: ColumnMapping = {};

  for (const field of importableFields) {
    const keyLc = field.key.toLowerCase();
    const labelLc = field.label.toLowerCase();

    // Attempt each strategy in priority order.
    let matched: string | undefined;

    // 1. Exact match on key.
    matched = csvHeaders.find((h) => h.toLowerCase() === keyLc);
    if (!matched) {
      // 2. Exact match on label.
      matched = csvHeaders.find((h) => h.toLowerCase() === labelLc);
    }
    if (!matched) {
      // 3. Partial containment.
      matched = csvHeaders.find(
        (h) => {
          const hLc = h.toLowerCase();
          return (
            hLc.includes(keyLc) ||
            hLc.includes(labelLc) ||
            keyLc.includes(hLc) ||
            labelLc.includes(hLc)
          );
        },
      );
    }

    if (matched) {
      mapping[field.key] = matched;
    }
  }

  return mapping;
}

/* -------------------------------------------------------------------------- */
/* Public: validateImportMapping                                              */
/* -------------------------------------------------------------------------- */

/**
 * Validates a caller-supplied `ColumnMapping` against the target object's
 * field metadata. Returns an array of validation issues (empty = no issues).
 *
 * Checks:
 *   - Required fields with no mapping AND no declared `defaultValue`.
 *   - Column headers in the mapping that do not appear in `availableHeaders`.
 *   - Field keys in the mapping that do not exist on the object.
 *   - RELATION or FILE field keys in the mapping (not importable).
 */
export interface MappingValidationIssue {
  kind: "required_unmapped" | "unknown_header" | "unknown_field" | "non_importable_field";
  fieldKey?: string;
  fieldLabel?: string;
  header?: string;
  message: string;
}

export async function validateImportMapping(
  projectId: string,
  object: string,
  columnMapping: ColumnMapping,
  availableHeaders: string[],
): Promise<MappingValidationIssue[]> {
  const objectMeta = await getObject(projectId, object);
  if (!objectMeta) {
    return [
      {
        kind: "unknown_field",
        message: `Object "${object}" does not exist in this project.`,
      },
    ];
  }

  const issues: MappingValidationIssue[] = [];
  const fieldByKey = new Map<string, FieldMetadata>(
    objectMeta.fields.map((f) => [f.key, f]),
  );
  const headerSet = new Set(availableHeaders);

  // Check every mapping entry.
  for (const [fieldKey, header] of Object.entries(columnMapping)) {
    const field = fieldByKey.get(fieldKey);
    if (!field) {
      issues.push({
        kind: "unknown_field",
        fieldKey,
        header,
        message: `Field key "${fieldKey}" does not exist on object "${object}".`,
      });
      continue;
    }
    if (field.type === "RELATION" || field.type === "FILE") {
      issues.push({
        kind: "non_importable_field",
        fieldKey,
        fieldLabel: field.label,
        header,
        message: `Field "${field.label}" (${field.type}) cannot be imported from a spreadsheet.`,
      });
      continue;
    }
    if (!headerSet.has(header)) {
      issues.push({
        kind: "unknown_header",
        fieldKey,
        fieldLabel: field.label,
        header,
        message: `Column "${header}" mapped to "${field.label}" was not found in the file headers.`,
      });
    }
  }

  // Check for required fields with no mapping and no default.
  for (const field of objectMeta.fields) {
    if (field.type === "RELATION" || field.type === "FILE") continue;
    if (!field.required) continue;
    if (field.defaultValue !== undefined) continue;
    if (columnMapping[field.key]) continue;
    issues.push({
      kind: "required_unmapped",
      fieldKey: field.key,
      fieldLabel: field.label,
      message: `Required field "${field.label}" has no column mapping and no default value.`,
    });
  }

  return issues;
}

/* -------------------------------------------------------------------------- */
/* @internal — test-only exports                                               */
/*                                                                             */
/* These are NOT part of the public API. They expose the private helpers       */
/* coerceCell and validateRow so that the node:test unit tests in __tests__/  */
/* can exercise them directly without a live MongoDB connection.               */
/*                                                                             */
/* Do not import these in application code.                                   */
/* -------------------------------------------------------------------------- */

/** @internal */
export { coerceCell as _coerceCell, validateRow as _validateRow };
