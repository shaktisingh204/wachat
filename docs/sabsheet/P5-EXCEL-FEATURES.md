# SabSheet v2 — P5/P6: Excel feature waves

Status: **xlsx round-trip landed.** The rest of the Excel feature surface (sort, auto-filter,
conditional formatting, data validation, pivots, charts) is scoped but not yet built.

## Landed: xlsx import / export (real Excel-file round-trip)

IronCalc's `ironcalc` umbrella crate (xlsx reader/writer) is wired behind a **cargo feature** so it
ships server-side only and never bloats the client wasm:
- `sabsheet-engine` gains `to_xlsx()` / `from_xlsx()` under `--features xlsx` (engine compiles with and
  without it; `sabsheet-engine-wasm` does **not** enable it).
- `sabsheet-ops` (which enables the feature) exposes:
  - `GET /v1/sabsheet/ops/export.xlsx?workbookId=` → `.xlsx` bytes (base64). Full `sabnode-api` compiles.
  - `POST /v1/sabsheet/ops/import.xlsx` → replaces a workbook with an uploaded file, bumps seq.
- TS: `rust-client/sabsheet-ops.ts` (`exportXlsx`/`importXlsx`) + server actions + a **Download .xlsx**
  toolbar button that decodes the base64 to a Blob and triggers download (persistent workbooks only).
- Because import/export go through the *same* IronCalc model that powers live editing, styles, formulas,
  merges, and number formats round-trip with the fidelity IronCalc's xlsx layer provides — no separate
  exceljs mapping table to maintain.

Import via the UI must source the file through **SabFiles** (`<SabFilePicker>`) per project policy —
that picker wiring is part of the P5 chrome build; the server action + endpoint are ready for it.

## Remaining P5/P6 (scoped, not built)

These need either new engine wrapper work or new chrome, and are the bulk of "everything Excel does":
- **Sort** (multi-key) — IronCalc `UserModel` has no sort; implement in the wrapper (read range →
  reorder → re-emit `SetCellInput`s, adjusting relative refs) or contribute upstream.
- **Auto-filter** — header dropdowns, value checklists, condition filters; hidden-row computation.
- **Conditional formatting** — rule engine (cell-value / formula / color-scale / data-bar / icon-set),
  evaluated at paint time; the renderer must consult the engine for the resolved style.
- **Data validation** — dropdown lists, ranges, custom formula; invalid-cell flagging; server-enforced.
- **Tables / structured references** — `Table1[Col]` resolution (engine dependency).
- **Pivot tables** — server-compute endpoint + field-well panel + anchored read-only region.
- **Charts + floating objects** — Recharts object layer bound to ranges; images via SabFiles.
- **Print / PDF**, **themes**, **cell-styles gallery**, **find & replace**, **group/outline**,
  **protection**.
- The **20ui chrome** (menubar, rich toolbar, sheet tabs, context menus, command palette) that hosts all
  of the above — currently a minimal inline-styled frame.
