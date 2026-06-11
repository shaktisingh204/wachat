# SabSheet v2 — P3: Persistence v2 + migration (COMPLETE)

Built with two parallel agents (Rust persistence hardening + TS migration driver) against a shared
endpoint contract, then integrated and verified.

## Architecture note — why not block tiles

The original plan called for a block-tiled cell store (`sabsheet_blocks`, 128×32) so the client could
fetch only the visible viewport. That does **not** fit the architecture we actually shipped: the
**fat client** runs the whole IronCalc engine in WASM (for offline + instant recalc), so it always
needs the full workbook — partial tile loads wouldn't give it enough data to recalculate formulas
referencing off-screen cells. The storage is therefore the IronCalc **snapshot**, and the
architecture-correct P3 hardening is snapshot **chunking** (for Mongo's 16 MB limit) plus a server
engine **cache** and the **migration**.

## What shipped

### 1. Snapshot chunking (`sabsheet-ops/src/docs.rs`)
`save_state`/`load_state` now transparently handle snapshots over `CHUNK_THRESHOLD` (15 MB): they are
split into 8 MB chunks in `sabsheet_engine_chunks` (`{workbookId, idx, bytes}`), and the state doc
records `{chunked: true, chunkCount}` with no inline `snapshot`. Small snapshots keep the inline
single-Binary form (backward-compatible with all pre-P3 docs). Switching representations deletes the
unused side so no stale snapshot can be reassembled. Pure `split_chunks`/`join_chunks` helpers are
unit-tested (incl. a >15 MB round-trip).

### 2. LRU engine cache (`sabsheet-ops/src/cache.rs`)
`SabEngine` was confirmed `Send` (compile-time assertion), so a bounded (32-entry) in-process LRU
keyed by workbookId caches warm engines. `apply_ops`/`export_xlsx`/`migrate` `take(id, seq)` a warm
engine (only on a seq match) instead of `from_snapshot` every request, and `put(id, newSeq, engine)`
after; `import_xlsx` invalidates. The lock is held only for O(1) map ops — the engine never crosses
an `.await`, preserving the no-Send-needed handler discipline.

### 3. Migration v1→v2 (`POST /v1/sabsheet/ops/migrate` + `scripts/sabsheet/migrate-v2.ts`)
- Endpoint (contract): `{ workbookId, sheets: [{ name, cells: [{row, col, input}] }] }` →
  `{ seq, cellCount }`. Owner-scoped; builds a fresh engine (NewSheet/RenameSheet per sheet, all cells
  applied as one paused-eval batch), snapshots it, saves at seq 1, and marks
  `sabsheet_workbooks.schemaVersion = 2`. All-or-nothing (a rejected cell fails with `BadRequest`).
- Driver script (`npm run sabsheet:migrate`): scans `sabsheet_workbooks` lacking `schemaVersion >= 2`,
  reads their legacy `sabsheet_sheets` (by `position`) + `sabsheet_cells`, maps each legacy cell to an
  `input` (`'=' + formula`, else the stringified value; empties skipped), and calls the endpoint —
  minting a per-owner Rust JWT via the repo's `issueRustJwt` (`src/lib/jwt-for-rust.ts`) since a CLI
  has no session. `--dry-run` and `--workbook <id>` supported. The legacy `sabsheet_cells` is left
  untouched (read-only — rollback-safe); the run is idempotent.

## Verification
- `cargo test -p sabsheet-ops` → **7 passed** (chunking round-trips, Send verdict, migrate logic, cache).
- `cargo check -p sabnode-api` → clean (the `/migrate` route is live via the mounted router).
- Scoped `tsc` of `migrate-v2.ts` + `sabsheet-ops.ts` → clean; the TS `migrate()` matches the Rust DTO.

## Operational note
Old workbooks created via the legacy editor show empty in `/dashboard/sabsheet/v2` until
`npm run sabsheet:migrate` is run (requires `MONGODB_URI`, `RUST_JWT_SECRET`, `RUST_API_URL`).
