# SabSheet v2 — P2: Canvas grid MVP

Status: **MVP landed** — interactive canvas grid driven by the IronCalc engine, typecheck-clean, with
unit-tested geometry. Polish items (frozen data panes, merges, rich cell styling, marching ants,
touch momentum) are scheduled for P4+.

## What shipped (`src/components/sabsheet/`)

### Geometry core (pure, unit-tested)
- `grid/axis-index.ts` — `AxisIndex`: uniform `defaultSize` + sparse overrides (hidden = size 0),
  sorted with a prefix-sum of deltas so `offsetOf` / `indexAt` / `rangeForViewport` are O(log k) in the
  override count, not O(index). Handles 1,000,000 rows × 16,384 columns with no per-line allocation.
  **9 tests** (incl. a 1M-row scale check) pass.
- `grid/selection.ts` — 1-based (engine-space) selection model: `move` / `extend` / `extendTo` with
  axis clamping, plus A1 helpers (`colToLetters` → XFD, `a1ToCell`, `selectionLabel`, `selectionCount`).
  **8 tests** pass.

### Renderer (imperative, layered canvas)
- `grid/grid-renderer.ts` — `GridRenderer`: DPR-aware, two stacked canvases (content: headers +
  gridlines + cell text; overlay: selection fill, active-cell border, header highlight). `cellRect`,
  `cellAt` (hit-test), `visibleRange`. React drives it with setters + `draw()` — no per-cell React.

### Interactive surface (React, thin)
- `grid/sheet-canvas.tsx` — `SheetCanvas` (forwardRef): owns the renderer + a `CalcEngineClient`,
  wires pointer selection + drag-extend, wheel scrolling, keyboard nav (arrows/shift-extend, Tab,
  Enter), Delete-to-clear, type-to-edit + F2, and an in-cell `<textarea>` editor overlay (IME-capable).
  Exposes `SheetCanvasHandle.commitActiveInput` for the formula bar. Reads viewports from the engine
  and repaints on every change.
- `workbench.tsx` — minimal frame: name box + formula bar (shares the engine via the grid handle) +
  status bar. (Full 20ui menubar/toolbar/tabs/context-menus chrome is the P5 build.)

### Preview route
- `src/app/dashboard/sabsheet/v2/page.tsx` — mounts `Workbench` seeded with a small budget + a
  `=SUM(D2:D3)`, **without touching the existing `/dashboard/sabsheet` editor**. Requires the wasm
  engine to be published first (`npm run sabsheet:wasm`).

## How the pieces connect

```
SheetCanvas ──(Command[])──▶ CalcEngineClient ──postMessage──▶ calc.worker ──▶ WasmEngine (IronCalc)
     ▲                                                                              │
     └──────────────── CellView[] (readViewport) ◀───────────────────────────────┘
GridRenderer.setCells(views) → draw()   (canvas paint, off the React tree)
```

The same `Command` objects the grid sends to the local wasm engine are exactly what
`rust-client/sabsheet-ops.applyOps` sends to the server (`/v1/sabsheet/ops`) for authoritative
persistence — wiring that autosave path into `SheetCanvas` is the P3 follow-up.

## Verification
- 23 TS unit tests pass (`ops.contract` + `axis-index` + `selection`).
- Scoped `tsc --noEmit --strict --jsx react-jsx` clean across all grid + component files.
- Visual/interaction verification requires the remote dev server + `npm run sabsheet:wasm`; open
  `/dashboard/sabsheet/v2`.

## Deferred (later phases, by design)
- **Frozen data panes** (header freeze is implicit; frozen rows/cols panes = P4 with `SetFrozen*` ops).
- **Merged cells** rendering + hit-test (needs the wrapper merge support — P4).
- **Rich cell styling** (fonts, fills, borders, number-format-aware paint via the engine's
  `format_value`) — P4/P5 with the style toolbar.
- **Marching ants** copy/cut border, fill-handle drag, touch momentum scrolling — P4.
- **Virtual scrollbars** (currently wheel-only; native-feeling scrollbars) — P4.
- Self-blit scroll optimization (currently full repaint per scroll; fine at MVP sizes) — P4.
