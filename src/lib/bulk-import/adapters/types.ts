/**
 * Shared types for §5.9 bulk-import per-entity adapters.
 *
 * Each adapter exports:
 *   • `targetSchema` — describes the entity's import shape; consumed by
 *     the wizard for the field-mapping step and the dry-run preview UI.
 *   • `normalize(row)` — narrow a raw `Record<string, string>` (a parsed
 *     CSV row) into the entity's canonical TS shape, applying trimming +
 *     light type coercion. Returns `{ ok: true, value }` or
 *     `{ ok: false, error }`.
 *   • `dedupe(rows, existing)` — pure helper that splits the candidate
 *     rows into create / update / skip buckets given existing tenant
 *     rows. Used by the wizard's dry-run preview.
 *   • `execute(rows, options)` — server-only entry point that performs
 *     the actual insert/update. Permission-gated inside.
 *
 * Adding a new entity:
 *   1. Drop a new file under `bulk-import/adapters/<name>.ts`.
 *   2. Export the four members above using these types.
 *   3. Register the adapter in `bulk-import/registry.ts`.
 */

export interface BulkImportField {
    /** Canonical name on the entity. */
    field: string;
    /** Human-friendly label shown in the mapper. */
    label: string;
    /** Whether mapping is mandatory. */
    required: boolean;
    /** Optional validator returning an error message (or `null` if ok). */
    validator?: (rawValue: string) => string | null;
    /** Optional dedupe-key contributor — return the row's natural id. */
    deduper?: (value: Record<string, unknown>) => string | null;
}

export interface NormalizeOk<T> {
    ok: true;
    value: T;
    /** Optional warnings that don't block the row. */
    warnings?: string[];
}

export interface NormalizeErr {
    ok: false;
    error: string;
}

export type NormalizeResult<T> = NormalizeOk<T> | NormalizeErr;

export interface DedupeBuckets<T> {
    /** Rows whose dedup key was empty or didn't match any existing row. */
    toCreate: T[];
    /** Rows that matched an existing row by dedup key. */
    toUpdate: Array<{ value: T; existingId: string }>;
    /** Rows skipped (e.g. duplicate within the file). */
    skipped: Array<{ value: T; reason: string }>;
}

export interface ExecuteOptions {
    /**
     * When `true`, matched rows update the existing entity in place. When
     * `false` (default), matched rows are dropped — only new entities get
     * inserted.
     */
    updateExisting?: boolean;
    /** Which adapter field should drive dedup. Adapters may default this. */
    dedupField?: string;
}

export interface ExecuteResult {
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ rowIndex: number; error: string }>;
}

export interface BulkImportAdapterSpec<T> {
    entityKind: string;
    label: string;
    targetSchema: BulkImportField[];
    /** Normalize a raw CSV row into the entity's typed shape. */
    normalize: (row: Record<string, string>) => NormalizeResult<T>;
    /** Pure dedup logic given the candidate rows + the existing tenant rows. */
    dedupe: (rows: T[], existing: T[], dedupField?: string) => DedupeBuckets<T>;
    /** Persist the resolved rows. Server-only. */
    execute: (rows: T[], options?: ExecuteOptions) => Promise<ExecuteResult>;
}
