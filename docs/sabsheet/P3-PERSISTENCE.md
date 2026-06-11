# SabSheet v2 — P3: Persistence + autosave loop

Status: **persistence loop closed** (bootstrap + autosave end-to-end). The block-tiling store and the
v1→v2 data migration remain as the second half of P3.

## What shipped — the durable loop

```
open workbook ──getSnapshotAction──▶ GET /v1/sabsheet/ops/snapshot ──▶ engine.init(name, snapshot)
edit cell ──applyLocal──▶ local wasm engine (instant)  +  applyOpsAction ──▶ POST /v1/sabsheet/ops
                                                              └─ persist snapshot + append op log, return new seq
```

- **Snapshot endpoint** — `GET /v1/sabsheet/ops/snapshot?workbookId=` returns the full-workbook
  IronCalc snapshot (base64) + current seq, or empty for a fresh workbook (`rust/crates/sabsheet-ops`,
  compiles).
- **Server actions** — `src/app/actions/sabsheet-ops.actions.ts` (`applyOpsAction`, `opsSinceAction`,
  `getSnapshotAction`) bridge the client to the `server-only` rust-client.
- **Autosave in the grid** — `SheetCanvas` gained an optional `workbookId`. When set:
  - bootstraps the engine from the server snapshot (seeds only a brand-new workbook);
  - every edit goes through `applyLocal`, which applies to the local engine *and* enqueues an
    `applyOpsAction` persist, **serialized through a promise chain** so the op log stays totally ordered;
  - optimistic concurrency: a stale-`baseSeq` rejection re-bootstraps from the authoritative snapshot;
  - `onSaveStateChange('saving'|'saved'|'error')` surfaces status to the chrome.
  - With no `workbookId` (the `/v2` preview), the grid is purely in-memory — unchanged.

All SabSheet TS files typecheck clean against the real project tsconfig (path aliases resolved).

## Remaining in P3 (second half)
- **Block-tiled store** — extract `sabsheet-docs` and replace the whole-workbook snapshot in
  `sabsheet_engine_state` with `sabsheet_blocks` (128×32 tiles) + `sabsheet_styles`, so opening a large
  workbook fetches only the visible tiles + a `Calculating…` hydrate, not the entire snapshot. The
  op-log shape and the apply path do not change — only `docs.rs` load/save internals and a viewport
  bootstrap query. (Snapshot-per-workbook is correct and fine up to a few-MB workbook; this is the
  scale upgrade.)
- **In-process LRU `SabEngine` cache** keyed by workbookId in the Axum process, so hot workbooks skip
  the `from_snapshot` rebuild per request (latency only; correctness already holds).
- **`scripts/sabsheet/migrate-v2.ts`** — fold legacy `sabsheet_cells` (one doc per cell) into the new
  store, recompute once server-side, mark `schemaVersion: 2`, keep the old collection read-only for one
  release as rollback.
