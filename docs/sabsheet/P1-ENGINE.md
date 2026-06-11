# SabSheet v2 — P1: Engine crates + ops + wasm packaging

Status: **core landed and verified.** Server persistence crates (`sabsheet-docs`, `sabsheet-ops`)
are the remaining P1/P3 boundary work.

## What shipped (all compiling + tested)

### `rust/crates/sabsheet-engine` (native, workspace member)
Framework-free wrapper over IronCalc `UserModel` speaking the canonical [`Command`] op model.
- `src/ops.rs` — the **single source of truth** `Command` enum (serde tagged union, intent-based,
  position-addressed) + `RangeRef`. 25 variants covering cells, styles, structural row/col ops,
  freeze, auto-fill, paste-csv, sheets, defined names.
- `src/lib.rs` — `SabEngine`: `apply(&[Command]) -> diff bytes`, `apply_remote_diffs`, `undo/redo`,
  `to_snapshot/from_snapshot`, `formatted/content`, `read_viewport` (blank-skipping hot read).
- 9 unit tests pass: batch+recalc, **collab diff replay into a peer**, snapshot roundtrip, undo/redo,
  viewport, and ops JSON-shape contract (guards the TS twin).

### `rust/crates/sabsheet-engine-wasm` (standalone workspace, cdylib)
wasm-bindgen façade `WasmEngine` over `SabEngine`. Detached `[workspace]` so it is never built by
`cargo build --bin sabnode-api` or `cargo --workspace`. Commands/viewport cross as JSON
(serde-wasm-bindgen); diffs/snapshots as `Uint8Array`. `wasm-opt = false` in metadata (wasm-pack's
bundled wasm-opt rejects current bulk-memory ops).

### `scripts/build-sabsheet-wasm.sh` + `npm run sabsheet:wasm`
`wasm-pack build --target web` → content-hashed `public/sabsheet-engine/<hash>/` + `manifest.json`.
Bundler-agnostic (no Turbopack wasm handling). **Measured output: 2.9 MB raw / 784 KB gzipped.**
Artifacts gitignored.

### Client bridge (TypeScript, typecheck clean)
- `src/lib/sabsheet/commands/ops.ts` — TS twin of `ops.rs` + `cmd.*` builders + `StylePath` map.
  `ops.contract.test.ts` (6 tests) pins JSON shapes against the Rust serde representation.
- `src/lib/sabsheet/engine/protocol.ts` — worker RPC envelopes.
- `src/workers/sabsheet/calc.worker.ts` — module worker; loads wasm from the manifest by runtime URL
  (no build-time bundler resolution), drives one `WasmEngine` per workbook off the main thread.
- `src/lib/sabsheet/engine/worker-client.ts` — `CalcEngineClient`: typed promise API the grid consumes.

## Architecture confirmed by the build

- **One engine, two targets, identical semantics** — the same `sabsheet-engine` compiles native and
  wasm32 from one source. No risk of client/server recalc divergence.
- **The op log is free** — `flush_diffs()` returns IronCalc's bitcode diff stream; that *is* the
  `sabsheet_ops` payload and the collab relay. No separate OT/CRDT op model to build.
- **Undo/redo, auto-fill, snapshots are engine-native** — three planned build items removed.

## Server-side op-apply — LANDED (`rust/crates/sabsheet-ops`, compiles inside `sabnode-api`)

`POST /v1/sabsheet/ops` and `GET /v1/sabsheet/ops?workbookId=..&since=N`, mounted in
`rust/crates/api/src/router.rs` (`.nest("/v1/sabsheet/ops", …)`). The full `sabnode-api` binary
compiles with it wired in.

- `apply_ops`: auth (`user_oid`) + `assert_workbook_access` (owner scoping; extends to `members[]` in
  Superpower A) → load latest snapshot → **construct + apply + reserialize the `SabEngine` inside one
  synchronous block** (engine never crosses an `.await`, so no `Send` bound is needed) → persist
  snapshot (`sabsheet_engine_state`) + append op log (`sabsheet_ops`, raw bitcode diffs as Binary +
  intent JSON) → return new seq + base64 diffs. Optimistic concurrency via `baseSeq` (stale ⇒ rejected).
- `ops_since`: diff blobs after a seq, for other tabs to catch up (SSE/poll); the same path the collab
  gateway will relay through in Superpower A.
- TS client: `src/lib/rust-client/sabsheet-ops.ts` (`applyOps` / `opsSince` / `decodeDiffs`).

**Deliberately deferred to P3** (the block-tiling upgrade, isolated and non-breaking):
- `sabsheet-docs` extraction + block-tiled store (`sabsheet_blocks` 128×32, `sabsheet_styles`) so
  viewport loads fetch only visible tiles instead of the whole-workbook snapshot. The op-log shape and
  apply path do **not** change — only `docs.rs`'s load/save internals.
- In-process LRU engine cache keyed by workbookId (the snapshot-per-request path is correct but
  rebuilds the engine each call; the cache is a latency optimization, not a correctness need).

## P0 open items — status
1. **Merge cells** — still wrapper TODO (UserModel has no merge method). Deferred to P4.
2. **Spill / dynamic arrays** — not yet exercised; wrapper `spill.rs` deferred to P4/P5.
3. **Incremental recalc at scale** — benchmark added (`tests/recalc_bench.rs`); numbers recorded below.

## Benchmark numbers (Apple Silicon, release)
(see `tests/recalc_bench.rs`; run `cargo test -p sabsheet-engine --release --test recalc_bench -- --ignored --nocapture`)

| Scenario | Time |
|---|---|
| Build 100,000-formula dependency chain | **412 ms** |
| Single head edit → recalc 100,000-deep chain | **58 ms** |
| Viewport read 50×32 from mid-sheet | **134 µs** |
| Build 50,000 SUM formulas | **3.12 s** |
| Single edit → recalc 50,000 dependents | **55 ms** |

**Bug found + fixed during this benchmark:** IronCalc's `set_user_input` recalculates after *every*
cell, so a naive batch apply is O(N²) — building 50k SUM formulas one-by-one measured **684,283 ms
(~11 min)**. `SabEngine::apply` now pauses evaluation for multi-command batches and recalcs once,
cutting that to **3,123 ms — a 219× speedup**. Incremental single-edit recalc was already fast
(~55 ms for 50k dependents) and is unaffected. All 9 unit tests still pass, so correctness held.
This closes P0 open item #3: incremental recalc at scale is production-viable.
