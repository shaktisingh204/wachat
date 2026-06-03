/**
 * Non-async types for {@link file://./sabcrm-bulk.actions.ts}.
 *
 * A `'use server'` module may only export async functions, so the shapes its
 * bulk actions resolve to live here.
 */

/** Result of `bulkDeleteRecordsTw` — the engine's delete count. */
export interface SabcrmBulkDeleteResult {
  ok: boolean;
  /** Number of records actually deleted. */
  deleted: number;
}

/** Result of `bulkUpdateRecordsTw` — the engine's modified count. */
export interface SabcrmBulkUpdateResult {
  ok: boolean;
  /** Number of records actually modified. */
  updated: number;
}
