/**
 * SabSheet v2 migration driver.
 *
 * Converts legacy per-cell workbooks (the `sabsheet_workbooks` /
 * `sabsheet_sheets` / `sabsheet_cells` collections) to the new
 * IronCalc-snapshot persistence by replaying every cell's raw input through the
 * Rust `POST /v1/sabsheet/ops/migrate` endpoint.
 *
 *   npx tsx scripts/sabsheet/migrate-v2.ts            # migrate everything pending
 *   npx tsx scripts/sabsheet/migrate-v2.ts --dry-run  # build payloads + report, no calls
 *   npx tsx scripts/sabsheet/migrate-v2.ts --workbook <id>  # just one workbook
 *
 * Env (load via .env / .env.local or export before running):
 *   MONGODB_URI, MONGODB_DB   — Mongo connection
 *   RUST_API_URL              — Rust BFF base (default http://localhost:8080)
 *   RUST_JWT_SECRET           — shared HS256 secret used to mint the per-owner JWT
 *
 * ## Why we don't call the rust-client `migrate()` directly
 * `src/lib/rust-client/sabsheet-ops.ts#migrate` goes through `rustFetch`, which
 * mints its JWT from the **session cookie** via `next/headers` `cookies()`.
 * A standalone Node script has no request context and no session cookie, so
 * `rustFetch` would throw `No active session`. Instead, we replicate the exact
 * low-level transport `rustFetch`/`rustFetchAs` uses (base URL + HS256 bearer)
 * but mint the token for each workbook's `ownerUserId` with the repo's own
 * `issueRustJwt` helper (`src/lib/jwt-for-rust.ts`) — identical signing logic,
 * identical claim shape, no cookie dependency.
 *
 * The endpoint marks `schemaVersion = 2` on success, so re-runs are idempotent;
 * this script also re-selects only un-migrated workbooks each run. The legacy
 * `sabsheet_cells` collection is read-only here — nothing is deleted.
 */

import 'dotenv/config';
import { MongoClient, ObjectId, type Db, type Document } from 'mongodb';

import { issueRustJwt } from '../../src/lib/jwt-for-rust';
import type { MigrateSheet, MigrateCell, MigrateResponse } from '../../src/lib/rust-client/sabsheet-ops';

const COLL_WORKBOOKS = 'sabsheet_workbooks';
const COLL_SHEETS = 'sabsheet_sheets';
const COLL_CELLS = 'sabsheet_cells';

const DEFAULT_RUST_BASE = 'http://localhost:8080';
const TARGET_SCHEMA_VERSION = 2;

// --------------------------------------------------------------------------- //
// CLI args
// --------------------------------------------------------------------------- //

interface Args {
  dryRun: boolean;
  /** Single workbook id (hex ObjectId string) to migrate, if provided. */
  workbookId: string | null;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, workbookId: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') {
      args.dryRun = true;
    } else if (a === '--workbook') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('--workbook requires a workbook id argument');
      }
      args.workbookId = next;
      i++;
    } else if (a.startsWith('--workbook=')) {
      args.workbookId = a.slice('--workbook='.length);
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return args;
}

// --------------------------------------------------------------------------- //
// Legacy → migration mapping
// --------------------------------------------------------------------------- //

/**
 * Render a legacy cell doc to the raw `input` string the endpoint expects:
 *   - a present, non-empty `formula`  → `'=' + formula`
 *   - otherwise the `value`, stringified (number → String(n),
 *     boolean → "TRUE"/"FALSE")
 *   - null / undefined / empty value with no formula → `null` (caller skips it)
 */
function cellInput(cell: Document): string | null {
  const formula = cell.formula;
  if (typeof formula === 'string' && formula.trim() !== '') {
    // A legacy formula may or may not already carry the leading '='.
    return formula.startsWith('=') ? formula : `=${formula}`;
  }

  const value = cell.value;
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (typeof value === 'string') {
    return value === '' ? null : value;
  }
  // Unknown shape (object/array) — stringify defensively rather than drop silently.
  try {
    const s = String(value);
    return s === '' ? null : s;
  } catch {
    return null;
  }
}

interface BuiltWorkbook {
  workbookId: string;
  ownerUserId: string;
  title: string;
  sheets: MigrateSheet[];
  cellCount: number;
}

/** Build the migration payload for one workbook from its legacy sheets + cells. */
async function buildWorkbookPayload(db: Db, wb: Document): Promise<BuiltWorkbook> {
  const workbookId = String(wb._id);
  const ownerUserId = String(wb.ownerUserId);

  // Legacy ids are stored as ObjectIds; cells/sheets reference them as ObjectIds.
  const sheets = await db
    .collection(COLL_SHEETS)
    .find({ workbookId: wb._id })
    .sort({ position: 1, _id: 1 })
    .toArray();

  const builtSheets: MigrateSheet[] = [];
  let cellCount = 0;

  for (const sheet of sheets) {
    const cells = await db
      .collection(COLL_CELLS)
      .find({ sheetId: sheet._id })
      .toArray();

    const migrateCells: MigrateCell[] = [];
    for (const cell of cells) {
      const input = cellInput(cell);
      if (input === null) continue; // skip empty cells
      const row = Number(cell.row);
      const col = Number(cell.col);
      if (!Number.isInteger(row) || !Number.isInteger(col) || row < 1 || col < 1) {
        // Defensive: legacy rows/cols are 1-based; skip anything malformed.
        continue;
      }
      migrateCells.push({ row, col, input });
    }

    cellCount += migrateCells.length;
    builtSheets.push({ name: String(sheet.name ?? ''), cells: migrateCells });
  }

  return {
    workbookId,
    ownerUserId,
    title: String(wb.title ?? '(untitled)'),
    sheets: builtSheets,
    cellCount,
  };
}

// --------------------------------------------------------------------------- //
// Rust transport (cookie-free; mirrors rustFetchAs but mints per-owner)
// --------------------------------------------------------------------------- //

function rustBaseUrl(): string {
  return process.env.RUST_API_URL || DEFAULT_RUST_BASE;
}

async function callMigrate(
  ownerUserId: string,
  workbookId: string,
  sheets: MigrateSheet[],
): Promise<MigrateResponse> {
  const token = await issueRustJwt({
    userId: ownerUserId,
    tenantId: ownerUserId,
    roles: [],
  });

  const res = await fetch(`${rustBaseUrl()}/v1/sabsheet/ops/migrate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ workbookId, sheets }),
  });

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.text();
      if (body) detail += ` — ${body}`;
    } catch {
      // ignore
    }
    throw new Error(`migrate failed for workbook ${workbookId}: ${detail}`);
  }

  return (await res.json()) as MigrateResponse;
}

// --------------------------------------------------------------------------- //
// Driver
// --------------------------------------------------------------------------- //

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var ${name} (set it in .env / .env.local or export it).`);
  }
  return v;
}

/** Workbooks that still need migrating: active + (schemaVersion missing or < 2). */
function pendingFilter(workbookId: string | null): Document {
  const filter: Document = {
    status: 'active',
    $or: [
      { schemaVersion: { $exists: false } },
      { schemaVersion: { $lt: TARGET_SCHEMA_VERSION } },
    ],
  };
  if (workbookId) {
    let oid: ObjectId;
    try {
      oid = new ObjectId(workbookId);
    } catch {
      throw new Error(`--workbook value is not a valid ObjectId: ${workbookId}`);
    }
    filter._id = oid;
  }
  return filter;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const uri = requireEnv('MONGODB_URI');
  const dbName = requireEnv('MONGODB_DB');
  if (!args.dryRun) {
    // The JWT secret is only needed when we actually call the endpoint.
    requireEnv('RUST_JWT_SECRET');
  }

  console.log(
    `SabSheet v2 migration — ${args.dryRun ? 'DRY RUN (no endpoint calls)' : 'LIVE'}` +
      (args.workbookId ? `, single workbook ${args.workbookId}` : '') +
      `\n  Mongo: ${dbName}` +
      (args.dryRun ? '' : `\n  Rust:  ${rustBaseUrl()}`),
  );

  const client = new MongoClient(uri);
  await client.connect();

  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  let totalCells = 0;

  try {
    const db = client.db(dbName);
    const cursor = db.collection(COLL_WORKBOOKS).find(pendingFilter(args.workbookId));
    const pending = await cursor.toArray();
    const total = pending.length;

    if (total === 0) {
      console.log('\nNothing to migrate — no active workbooks below schemaVersion 2.');
      return;
    }

    console.log(`\nFound ${total} workbook(s) to migrate.\n`);

    for (let i = 0; i < total; i++) {
      const wb = pending[i];
      const n = i + 1;
      let built: BuiltWorkbook;
      try {
        built = await buildWorkbookPayload(db, wb);
      } catch (e) {
        failed++;
        console.error(
          `[${n}/${total}] FAIL build  workbook ${String(wb._id)} — ${(e as Error).message}`,
        );
        continue;
      }

      const label =
        `[${n}/${total}] ${built.title} (${built.workbookId}) — ` +
        `${built.sheets.length} sheet(s), ${built.cellCount} cell(s)`;

      if (args.dryRun) {
        totalCells += built.cellCount;
        migrated++; // counts as "would migrate" in dry-run
        console.log(`${label}  [dry-run]`);
        continue;
      }

      try {
        const resp = await callMigrate(built.ownerUserId, built.workbookId, built.sheets);
        totalCells += resp.cellCount;
        migrated++;
        console.log(`${label}  → seq ${resp.seq}, ${resp.cellCount} cell(s) persisted [OK]`);
      } catch (e) {
        // The endpoint is idempotent and marks schemaVersion=2 on success, so a
        // re-run naturally skips done workbooks; a failure here is a real error.
        failed++;
        console.error(`${label}  [FAIL] ${(e as Error).message}`);
      }
    }
  } finally {
    await client.close();
  }

  console.log(
    `\nDone. ${migrated} ${args.dryRun ? 'would migrate' : 'migrated'}, ` +
      `${skipped} skipped, ${failed} failed; ${totalCells} cell(s) total.`,
  );

  if (failed > 0) process.exit(1);
  process.exit(0);
}

main().catch((e: unknown) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
