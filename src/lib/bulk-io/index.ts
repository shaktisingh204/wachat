/**
 * Bulk I/O — shared CSV import/export utilities (CRM_REBUILD_PLAN §5.9).
 *
 * - `parseCsv` / `serializeCsv` — pure, RFC-4180-ish primitives.
 * - `runBulkImport` — pipeline that parses CSV, narrows rows via a
 *   per-entity adapter, dedupes against the file and (optionally)
 *   against the DB, then commits or returns a dry-run preview.
 *
 * Per-entity wiring lives in the entity's actions file — e.g.
 * `src/app/actions/crm-leads.actions.ts` would export a
 * `LeadImportAdapter` and a thin `importLeadsCsv(csv: string)` action.
 */

export { parseCsv, serializeCsv } from './csv';
export type { ParseCsvOptions, ParsedCsv, SerializeCsvOptions } from './csv';

export { runBulkImport } from './import';
export type {
  BulkImportAdapter,
  BulkImportContext,
  BulkImportInput,
  BulkImportReport,
  BulkImportRowError,
  DedupPolicy,
} from './import';
