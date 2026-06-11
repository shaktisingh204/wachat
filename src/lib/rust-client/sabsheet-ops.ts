import 'server-only';

/**
 * SabSheet ops client — wraps `/v1/sabsheet/ops` (the authoritative op-apply endpoint backed by the
 * server-side `SabEngine`). Applies intent-based command batches, persists the snapshot + op log, and
 * returns the engine diff blob (base64) for the client to replay / broadcast.
 *
 * The `Command` shape is the TS twin in `src/lib/sabsheet/commands/ops.ts`; we re-import the type so
 * callers pass the exact same objects they hand to the wasm engine.
 */
import { rustFetch } from './fetcher';
import type { Command } from '@/lib/sabsheet/commands/ops';

const BASE = '/v1/sabsheet/ops';

export interface ApplyOpsInput {
  workbookId: string;
  /** Seq the batch was based on, for optimistic concurrency. Omit to skip the check. */
  baseSeq?: number;
  commands: Command[];
  /** Provenance: 'ui' | 'import' | 'api' | 'form' | 'connection' | 'ai'. */
  origin?: string;
}

export interface ApplyOpsResponse {
  seq: number;
  /** Engine diff blob, base64. Decode to Uint8Array and `applyRemoteDiffs` on peer engines. */
  diffsB64: string;
  /** True when baseSeq was stale — refetch state before retrying. */
  rejected: boolean;
}

export interface OpEntry {
  seq: number;
  diffsB64: string;
}

/** One cell in a migration payload. `input` is the raw cell text (a formula starts with `=`). */
export interface MigrateCell {
  /** 1-based row. */
  row: number;
  /** 1-based column. */
  col: number;
  /** Raw cell text: `"=SUM(A1:A2)"` for a formula, `"42"` / `"hello"` for a literal. */
  input: string;
}

/** One sheet in a migration payload. */
export interface MigrateSheet {
  name: string;
  cells: MigrateCell[];
}

export interface MigrateResponse {
  seq: number;
  cellCount: number;
}

export interface SnapshotResponse {
  seq: number;
  /** Full-workbook IronCalc snapshot, base64. Empty when the workbook has no persisted state yet. */
  snapshotB64: string;
}

/** Apply a command batch to the authoritative engine. */
export function applyOps(input: ApplyOpsInput): Promise<ApplyOpsResponse> {
  return rustFetch<ApplyOpsResponse>(BASE, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Migrate a legacy per-cell workbook to the IronCalc-snapshot persistence in a
 * single shot. The Rust endpoint rebuilds the workbook from the supplied raw
 * cell inputs, persists the snapshot + op log, and marks the workbook's
 * `schemaVersion = 2` (so the call is idempotent on re-run).
 *
 * Returns the new authoritative `seq` and the number of cells materialised.
 *
 * NOTE on auth: this goes through {@link rustFetch}, which mints the Rust JWT
 * from the in-app session cookie — fine for in-app callers. A standalone
 * migration script has no session cookie, so it must instead mint a JWT for
 * the workbook's `ownerUserId` (see `scripts/sabsheet/migrate-v2.ts`).
 */
export function migrate(
  workbookId: string,
  sheets: MigrateSheet[],
): Promise<MigrateResponse> {
  return rustFetch<MigrateResponse>(`${BASE}/migrate`, {
    method: 'POST',
    body: JSON.stringify({ workbookId, sheets }),
  });
}

/** Fetch op-log diff blobs after `since` seq (tab/poll catch-up). */
export function opsSince(workbookId: string, since = 0): Promise<{ ops: OpEntry[] }> {
  const sp = new URLSearchParams({ workbookId, since: String(since) });
  return rustFetch<{ ops: OpEntry[] }>(`${BASE}?${sp.toString()}`);
}

/** The full-workbook snapshot for engine bootstrap (empty `snapshotB64` ⇒ open fresh). */
export function getSnapshot(workbookId: string): Promise<SnapshotResponse> {
  const sp = new URLSearchParams({ workbookId });
  return rustFetch<SnapshotResponse>(`${BASE}/snapshot?${sp.toString()}`);
}

/** Render the workbook to `.xlsx` (base64). */
export function exportXlsx(workbookId: string): Promise<{ xlsxB64: string }> {
  const sp = new URLSearchParams({ workbookId });
  return rustFetch<{ xlsxB64: string }>(`${BASE}/export.xlsx?${sp.toString()}`);
}

/** Replace a workbook's contents with an uploaded `.xlsx` (base64). Returns the new seq. */
export function importXlsx(
  workbookId: string,
  name: string,
  xlsxB64: string,
): Promise<{ seq: number }> {
  return rustFetch<{ seq: number }>(`${BASE}/import.xlsx`, {
    method: 'POST',
    body: JSON.stringify({ workbookId, name, xlsxB64 }),
  });
}

/** Decode a base64 diff blob to bytes for the wasm engine's `applyRemoteDiffs`. */
export function decodeDiffs(diffsB64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(diffsB64, 'base64'));
}
