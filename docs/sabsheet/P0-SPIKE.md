# SabSheet v2 — P0 IronCalc Spike Results (GATE PASSED)

Date: 2026-06-11. Toolchain: cargo/rustc 1.95.0. Engine: **IronCalc `ironcalc_base` v0.7.1**
(git `5e90d02e`, github.com/ironcalc/IronCalc, dual MIT/Apache-2.0).

## Verdict: GREEN — proceed to P1 on IronCalc.

Every load-bearing assumption in the approved plan held. The spike compiled against the real
`UserModel` API on the first try (both native and wasm32) and all probe assertions passed.

## What was proven (native)

Probe (`/tmp/sabsheet-spike`) exercised the full path and all assertions passed:

| Capability | Result |
|---|---|
| `set_user_input` + `=SUM(A1:A3)` recalc | 60 ✓ |
| Dependent recalc (`=A4*2`) | 120 ✓ |
| VLOOKUP / IF / TEXTJOIN / ROUND | all correct ✓ |
| Edit propagation (2 hops) | 150 → 300 ✓ |
| `undo()` / `redo()` (built-in) | reverts/reapplies ✓ |
| **Collab: `flush_send_queue()` → `apply_external_diffs()`** | 198-byte bitcode replays edits into a fresh model ✓ |
| `to_bytes()` / `from_bytes()` snapshot | 562-byte roundtrip restores values ✓ |
| `auto_fill_rows()` (fill handle) | runs ✓ |
| `insert_rows()` structural op | formula result preserved ✓ |

## What was proven (wasm32)

- `ironcalc_base` + `wasm-bindgen` cdylib compiles clean for `wasm32-unknown-unknown` (release).
- Bundle size: **3.0 MB raw / 812 KB gzipped** (pre-`wasm-opt`; `-Oz` should shave another 15–30%).
  Well under the 1.5–2.5 MB-gz planning estimate. Loaded once in a Web Worker, then cached.
- `SabEngine` façade with `setInput`/`formatted`/`flushDiffs`/`applyDiffs` (`Vec<u8>` ↔ JS `Uint8Array`) binds fine.

## Why this de-risks the whole program

`flush_send_queue` / `apply_external_diffs` is IronCalc's **built-in serializable diff transport**
(bitcode-encoded `Vec<QueueDiffs>`). It is exactly the op-log / CRDT-sync primitive the plan needed
to design from scratch. Same engine running deterministically on every client + server means:
- the **op log** is just the flushed diff stream persisted to `sabsheet_ops`;
- **collaboration** (Superpower A) relays diffs through the Yjs gateway with no separate op model;
- **server authoritative recalc** loads `from_bytes`, applies diffs, re-serializes.

Undo/redo, auto-fill, and snapshots being built-in removes three items the plan had budgeted to build.

## IronCalc `UserModel` API surface we will wrap (base/src/user_model/common.rs)

Construction `new_empty("wb","en","UTC","en")` / `from_bytes` / `to_bytes`. Cells: `set_user_input`,
`get_cell_content`, `get_formatted_cell_value`, `get_cell_type`, `range_clear_*`. Eval: `evaluate`,
`pause_evaluation`/`resume_evaluation`. History: `undo`/`redo`/`can_undo`/`can_redo`. Sync:
`flush_send_queue`/`apply_external_diffs`. Structure: `insert_rows`/`insert_columns`/`delete_rows`/
`delete_columns`/`move_row_action`/`move_column_action`, `set_rows_height`/`set_columns_width`,
frozen rows/cols. Styles: `update_range_style`/`get_cell_style`/`on_paste_styles`. Fill:
`auto_fill_rows`/`auto_fill_columns`. Clipboard: `copy_to_clipboard`/`paste_from_clipboard`/
`paste_csv_string`. Names: defined-name CRUD. Sheets: `new_sheet`/`delete_sheet`/`rename_sheet`/
`hide_sheet`/`set_sheet_color`/`get_worksheets_properties`. Used-range probes:
`get_last_non_empty_in_row_before_column` etc. Locale/timezone/language. Functions: 343 enum variants
across math/statistical/financial/date_and_time/text/logical/lookup(+xlookup)/engineering/database/
information. `number_format` module = ECMA-376 format-code rendering.

## Confirmed gaps → wrapper scope for P1

1. **Merge cells** — no `merge_cells` method on `UserModel`; lives on `worksheet.merge_cells`. Wrap via
   `get_model()`/model mutation or contribute upstream. Small.
2. **Dynamic arrays / spill** — not verified present (likely absent in 0.7.1). If a formula can't return
   a spilled range, implement spill in the wrapper (anchor owns formula, wrapper writes/clears the spill
   range + `#SPILL!` detection). Deferrable past first editing milestone.
3. **Incremental recalc at scale** — dependency-aware recalc confirmed correct, but not yet benchmarked on
   a 100k-formula workbook. Benchmark in P1; if full-recalc-only, dirty-subgraph recalc is the top
   upstream-contribution candidate.

## Vendoring decision

Pin by git **tag `v0.7.1`** (rev `5e90d02e`) so we can patch (`[patch]`) for the merge/spill/recalc
work without waiting on upstream releases. `ironcalc_base` is the only crate we need (the engine);
the `ironcalc` umbrella and `xlsx` I/O crate come later in P5.
