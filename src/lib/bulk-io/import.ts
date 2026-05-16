/**
 * Bulk import pipeline (CRM_REBUILD_PLAN §5.9).
 *
 * Per-entity adapter contract:
 *
 *   • `mapRow(raw, ctx)`  — narrow a parsed CSV row to your entity shape;
 *     return `{ ok: true, value: T }` or `{ ok: false, error: string }`.
 *   • `dedupKey(value)`   — return a stable string used to detect dupes
 *     across the import set and (optionally) against existing DB rows.
 *   • `insertOne(value)`  — persist a single row. Called only during the
 *     COMMIT phase. The caller is responsible for RBAC + tenant scoping.
 *   • `existingKeys(values)` — optional. Given the candidate values,
 *     return the subset of `dedupKey`s already present in the DB. The
 *     pipeline drops these (or marks them for skip per the dedup policy).
 *
 * Pipeline phases (per `runBulkImport`):
 *
 *   1. parse  — CSV → array of `Record<header, cell>`
 *   2. map    — adapter narrows each row; failures collected as errors
 *   3. dedup  — drop intra-set + DB-existing dupes per policy
 *   4. commit — call `insertOne` for each remaining row
 *
 * `dryRun: true` runs phases 1-3 only and returns the would-insert set.
 * Inserts are sequential by design — bulk operators usually need a
 * deterministic insert order for audit purposes. A future iteration can
 * parallelize with a bounded queue.
 */

import { parseCsv } from './csv';

export type DedupPolicy = 'skip' | 'error' | 'allow';

export interface BulkImportAdapter<T> {
  /** Friendly name used in audit reasons + report headings (e.g. "leads"). */
  entityKind: string;
  /** Map a parsed CSV row → entity shape. */
  mapRow: (
    raw: Record<string, string>,
    ctx: BulkImportContext,
  ) => { ok: true; value: T } | { ok: false; error: string };
  /** Stable key (e.g. lowercased email, gstin, code). Empty string disables dedup for this row. */
  dedupKey: (value: T) => string;
  /** Optional dedup-against-DB hook. */
  existingKeys?: (values: T[], ctx: BulkImportContext) => Promise<Set<string>>;
  /** Persist a single row. */
  insertOne: (value: T, ctx: BulkImportContext) => Promise<{ id: string }>;
}

export interface BulkImportContext {
  /** Tenant user id (Mongo `userId`). */
  userId: string;
  /** Per-entity options passed by the caller. */
  options?: Record<string, unknown>;
}

export interface BulkImportInput<T> {
  csv: string;
  adapter: BulkImportAdapter<T>;
  ctx: BulkImportContext;
  /** When true, runs phases 1-3 only and returns the would-insert set. */
  dryRun?: boolean;
  /** How to handle duplicates. Defaults to `'skip'`. */
  dedup?: DedupPolicy;
  /** Hard cap on rows processed. Defaults to 10_000. */
  maxRows?: number;
}

export interface BulkImportRowError {
  /** 1-based row index (header excluded). */
  rowIndex: number;
  raw: Record<string, string>;
  error: string;
}

export interface BulkImportReport<T> {
  entityKind: string;
  total: number;
  imported: number;
  skipped: number;
  errors: BulkImportRowError[];
  /** Rows that would be inserted on a dry run. Empty on a real run. */
  preview: T[];
  /** Inserted entity ids. Empty on a dry run. */
  insertedIds: string[];
  dryRun: boolean;
}

export async function runBulkImport<T>(
  input: BulkImportInput<T>,
): Promise<BulkImportReport<T>> {
  const { csv, adapter, ctx } = input;
  const dryRun = input.dryRun === true;
  const policy: DedupPolicy = input.dedup ?? 'skip';
  const maxRows = Math.max(1, Math.min(100_000, input.maxRows ?? 10_000));

  const parsed = parseCsv(csv);
  if (parsed.rows.length === 0) {
    return {
      entityKind: adapter.entityKind,
      total: 0,
      imported: 0,
      skipped: 0,
      errors: [],
      preview: [],
      insertedIds: [],
      dryRun,
    };
  }

  const rows = parsed.rows.slice(0, maxRows);
  const errors: BulkImportRowError[] = [];
  const candidates: { row: number; value: T; key: string }[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const raw = rows[i]!;
    const res = adapter.mapRow(raw, ctx);
    if (!res.ok) {
      errors.push({ rowIndex: i + 1, raw, error: res.error });
      continue;
    }
    const key = adapter.dedupKey(res.value);
    candidates.push({ row: i + 1, value: res.value, key });
  }

  // Intra-set dedup
  const seenIntra = new Set<string>();
  const afterIntra: typeof candidates = [];
  for (const c of candidates) {
    if (c.key && seenIntra.has(c.key)) {
      if (policy === 'error') {
        errors.push({
          rowIndex: c.row,
          raw: rows[c.row - 1]!,
          error: `Duplicate within file: "${c.key}"`,
        });
      }
      continue;
    }
    if (c.key) seenIntra.add(c.key);
    afterIntra.push(c);
  }

  // DB dedup
  let afterDb = afterIntra;
  if (adapter.existingKeys) {
    const keys = afterIntra.map((c) => c.key).filter((k) => k.length > 0);
    if (keys.length > 0) {
      const existing = await adapter.existingKeys(
        afterIntra.map((c) => c.value),
        ctx,
      );
      afterDb = [];
      for (const c of afterIntra) {
        if (c.key && existing.has(c.key)) {
          if (policy === 'error') {
            errors.push({
              rowIndex: c.row,
              raw: rows[c.row - 1]!,
              error: `Already exists: "${c.key}"`,
            });
          }
          continue;
        }
        afterDb.push(c);
      }
    }
  }

  if (dryRun) {
    return {
      entityKind: adapter.entityKind,
      total: rows.length,
      imported: 0,
      skipped: rows.length - afterDb.length,
      errors,
      preview: afterDb.map((c) => c.value),
      insertedIds: [],
      dryRun: true,
    };
  }

  const insertedIds: string[] = [];
  for (const c of afterDb) {
    try {
      const { id } = await adapter.insertOne(c.value, ctx);
      insertedIds.push(id);
    } catch (e) {
      errors.push({
        rowIndex: c.row,
        raw: rows[c.row - 1]!,
        error: e instanceof Error ? e.message : 'insertOne failed',
      });
    }
  }

  return {
    entityKind: adapter.entityKind,
    total: rows.length,
    imported: insertedIds.length,
    skipped: rows.length - insertedIds.length - errors.length,
    errors,
    preview: [],
    insertedIds,
    dryRun: false,
  };
}
