import 'server-only';

/**
 * SabSheet v2 — Live data connections, the run engine.
 *
 * Two responsibilities:
 *   1. `runConnection(conn)` — poll the configured source and normalise it into
 *      a 2D block of strings (`rows`). Pure data fetch; never touches the sheet.
 *   2. `landRows(conn, rows)` — write that block into the workbook at the
 *      connection's anchor via the authoritative ops endpoint (`/v1/sabsheet/ops`,
 *      `origin: 'connection'`), then stamp `lastRunAt`/`rowCount`/`lastStatus`
 *      on the connection doc.
 *
 * Both run from either a session-scoped server action (manual "Refresh now") or
 * the credential-less cron tick. Because the cron tick has no session cookie,
 * the ops call mints a JWT for the connection's `ownerUserId` via
 * `rustFetchAs` rather than going through the cookie-bound `applyOps`.
 *
 * Secrets: a connection's REST bearer/api-key is stored encrypted on the doc
 * (`credentialCipher`, AES-256-GCM). It is decrypted only here, server-side.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { decryptData } from '@/lib/sabflow/credentials/encryption';
import { rustFetchAs } from '@/lib/rust-client/fetcher';
import { cmd } from '@/lib/sabsheet/commands/ops';
import type { Command } from '@/lib/sabsheet/commands/ops';
import type {
  SabsheetConnection,
  SabcrmConnectionConfig,
  RestConnectionConfig,
  CsvConnectionConfig,
} from './types';
import { SABSHEET_CONNECTIONS_COLLECTION } from './types';

/* ── Helpers ──────────────────────────────────────────────────────────────── */

/** Resolve a dot-path (`data.items`) inside an arbitrary JSON value. */
function dig(value: unknown, path?: string): unknown {
  if (!path) return value;
  let cur: unknown = value;
  for (const seg of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/** Coerce any cell value to a string the ops engine can ingest. */
function toCell(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/**
 * Project an array of row objects to a 2D string block. `columns` (when given)
 * fixes the column order + header; otherwise the union of each row's own keys
 * is used in first-seen order.
 */
function objectsToRows(
  items: Array<Record<string, unknown>>,
  columns?: string[],
  noHeader?: boolean,
): string[][] {
  let cols = columns && columns.length > 0 ? columns : undefined;
  if (!cols) {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const it of items) {
      for (const k of Object.keys(it ?? {})) {
        if (!seen.has(k)) {
          seen.add(k);
          order.push(k);
        }
      }
    }
    cols = order;
  }
  const out: string[][] = [];
  if (!noHeader) out.push([...cols]);
  for (const it of items) {
    out.push(cols.map((c) => toCell((it ?? {})[c])));
  }
  return out;
}

/**
 * Minimal RFC-4180-ish CSV parser — handles quoted fields, embedded commas,
 * escaped quotes (`""`), and CRLF/LF line endings. Adequate for the v1
 * paste-CSV path; the engine never round-trips this back out.
 */
function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      pushField();
    } else if (ch === '\r') {
      // swallow — handled by the following \n (or treated as line end on its own)
      if (text[i + 1] !== '\n') pushRow();
    } else if (ch === '\n') {
      pushRow();
    } else {
      field += ch;
    }
  }
  // flush trailing field/row unless the input ended on a clean newline
  if (field.length > 0 || row.length > 0) pushRow();
  return rows;
}

/* ── Per-type fetchers ────────────────────────────────────────────────────── */

async function runSabcrm(conn: SabsheetConnection): Promise<string[][]> {
  const cfg = conn.config as SabcrmConnectionConfig;
  if (!cfg.projectId || !cfg.object) {
    throw new Error('sabcrm connection requires projectId + object');
  }
  // The CRM rust-client is cookie-bound (`rustFetch`); to stay usable from the
  // credential-less cron tick we hit the same endpoint via `rustFetchAs` with
  // the connection owner's identity. Endpoint used:
  //   GET /v1/sabcrm/records/{object}?projectId=…&limit=…&sortBy=…&sortDir=…&q=…
  const sp = new URLSearchParams({ projectId: cfg.projectId });
  sp.set('limit', String(cfg.limit ?? 200));
  if (cfg.q) sp.set('q', cfg.q);
  if (cfg.sortBy) sp.set('sortBy', cfg.sortBy);
  if (cfg.sortDir) sp.set('sortDir', cfg.sortDir);
  const path = `/v1/sabcrm/records/${encodeURIComponent(cfg.object)}?${sp.toString()}`;
  const res = await rustFetchAs<{ records: Array<{ data?: Record<string, unknown> }>; total: number }>(
    conn.ownerUserId,
    path,
  );
  const records = res.records ?? [];
  const bags = records.map((r) => r.data ?? {});
  return objectsToRows(bags, cfg.fields);
}

async function runRest(conn: SabsheetConnection): Promise<string[][]> {
  const cfg = conn.config as RestConnectionConfig;
  if (!cfg.url) throw new Error('rest connection requires a url');

  const headers: Record<string, string> = { Accept: 'application/json', ...(cfg.headers ?? {}) };
  const secret = await loadSecret(conn);
  if (secret && !headers.Authorization && !headers.authorization) {
    headers.Authorization = secret.startsWith('Bearer ') ? secret : `Bearer ${secret}`;
  }

  const res = await fetch(cfg.url, {
    method: cfg.method ?? 'GET',
    headers,
    body: cfg.method === 'POST' ? cfg.body : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`REST source ${res.status} ${res.statusText}`);
  }
  const json: unknown = await res.json();
  const arr = dig(json, cfg.rowsPath);
  if (!Array.isArray(arr)) {
    throw new Error(
      cfg.rowsPath
        ? `rowsPath "${cfg.rowsPath}" did not resolve to an array`
        : 'REST response was not an array (set rowsPath)',
    );
  }
  const items = arr.map((x) =>
    x && typeof x === 'object' ? (x as Record<string, unknown>) : { value: x },
  );
  return objectsToRows(items, cfg.columns, cfg.noHeader);
}

async function runCsv(conn: SabsheetConnection): Promise<string[][]> {
  const cfg = conn.config as CsvConnectionConfig;
  if (cfg.fileId && !cfg.csv) {
    // v2 TODO: stream the file's bytes from SabFiles by id and parse here. For
    // v1 we require the CSV text inline; surface a clear error rather than
    // silently landing nothing.
    throw new Error('csv-from-SabFiles fileId is not wired yet — paste raw CSV (v1)');
  }
  if (!cfg.csv) throw new Error('csv connection requires csv text');
  return parseCsv(cfg.csv, cfg.delimiter ?? ',');
}

/** Decrypt the connection's stored secret, if any. */
async function loadSecret(conn: SabsheetConnection): Promise<string | undefined> {
  try {
    const { db } = await connectToDatabase();
    const doc = await db
      .collection(SABSHEET_CONNECTIONS_COLLECTION)
      .findOne({ _id: new ObjectId(conn._id) });
    const cipher = doc?.credentialCipher as string | undefined;
    if (!cipher) return undefined;
    return decryptData(cipher);
  } catch {
    return undefined;
  }
}

/* ── Public API ───────────────────────────────────────────────────────────── */

export interface RunConnectionResult {
  rows: string[][];
  error?: string;
}

/**
 * Poll the connection's source and return a normalised 2D block. Never throws —
 * a source failure is captured in `error` with `rows: []` so the cron tick can
 * keep going and the action can persist the failure.
 */
export async function runConnection(conn: SabsheetConnection): Promise<RunConnectionResult> {
  try {
    let rows: string[][];
    switch (conn.type) {
      case 'sabcrm':
        rows = await runSabcrm(conn);
        break;
      case 'rest':
        rows = await runRest(conn);
        break;
      case 'csv':
        rows = await runCsv(conn);
        break;
      default:
        throw new Error(`unknown connection type: ${String((conn as { type?: unknown }).type)}`);
    }
    return { rows };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/** Resolve the 0-based engine sheet index for a connection's target sheet. */
async function resolveSheetIndex(conn: SabsheetConnection): Promise<number> {
  if (!conn.sheetId) return 0;
  try {
    const { db } = await connectToDatabase();
    const sheet = await db
      .collection('sabsheet_sheets')
      .findOne({ _id: new ObjectId(conn.sheetId) });
    const pos = sheet?.position;
    return typeof pos === 'number' && pos >= 0 ? pos : 0;
  } catch {
    return 0;
  }
}

export interface LandRowsResult {
  ok: boolean;
  rowCount: number;
  error?: string;
}

/**
 * Write a 2D block into the connection's sheet at its anchor and stamp run
 * metadata onto the connection doc. Uses one `setCellInput` command per cell,
 * applied through `/v1/sabsheet/ops` with `origin: 'connection'` as the owner.
 */
export async function landRows(
  conn: SabsheetConnection,
  rows: string[][],
  fetchError?: string,
): Promise<LandRowsResult> {
  const { db } = await connectToDatabase();
  const connId = new ObjectId(conn._id);
  const now = new Date();

  // A fetch failure short-circuits the write but still records the run.
  if (fetchError) {
    await db.collection(SABSHEET_CONNECTIONS_COLLECTION).updateOne(
      { _id: connId },
      { $set: { lastRunAt: now, lastStatus: 'error', lastError: fetchError, updatedAt: now } },
    );
    return { ok: false, rowCount: 0, error: fetchError };
  }

  try {
    const sheetIndex = await resolveSheetIndex(conn);
    const { anchorRow, anchorCol } = conn.target;
    const commands: Command[] = [];
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        commands.push(cmd.setCell(sheetIndex, anchorRow + r, anchorCol + c, row[c] ?? ''));
      }
    }

    if (commands.length > 0) {
      // Direct ops apply as the owner (no session cookie required from cron).
      await rustFetchAs(conn.ownerUserId, '/v1/sabsheet/ops', {
        method: 'POST',
        body: JSON.stringify({
          workbookId: conn.workbookId,
          commands,
          origin: 'connection',
        }),
      });
    }

    // rowCount excludes a header row only when the source emitted one; we record
    // the raw block height minus one when >1, else the block height.
    const dataRowCount = rows.length > 1 ? rows.length - 1 : rows.length;
    await db.collection(SABSHEET_CONNECTIONS_COLLECTION).updateOne(
      { _id: connId },
      {
        $set: {
          lastRunAt: now,
          lastStatus: 'ok',
          lastError: null,
          rowCount: dataRowCount,
          updatedAt: now,
        },
      },
    );
    return { ok: true, rowCount: dataRowCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.collection(SABSHEET_CONNECTIONS_COLLECTION).updateOne(
      { _id: connId },
      { $set: { lastRunAt: now, lastStatus: 'error', lastError: message, updatedAt: now } },
    );
    return { ok: false, rowCount: 0, error: message };
  }
}

/** Convenience: fetch + land in one shot. Used by `runConnectionNow` and cron. */
export async function runAndLand(conn: SabsheetConnection): Promise<LandRowsResult> {
  const { rows, error } = await runConnection(conn);
  return landRows(conn, rows, error);
}
