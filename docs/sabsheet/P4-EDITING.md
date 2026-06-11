# SabSheet v2 — P4: Editing depth

Status: **core editing depth landed** (undo/redo, clipboard, fill handle, formatting, number formats).
Merges and frozen-pane *rendering* remain (the engine ops exist; the grid drawing does not yet).

## What shipped

- **Undo/redo** — `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`, plus toolbar buttons, via the engine's native
  history (`SabEngine::undo/redo`). In-session, fully working. *Persisting undo through the op log for
  collab/reload needs a diff-apply endpoint (the engine emits inverse diffs on undo) — a tracked
  follow-up; local undo is correct for the single-session case today.*
- **Clipboard** — `Ctrl+C` / `Ctrl+X` / `Ctrl+V`. Copy serializes the selection to TSV
  (`clipboard/tsv.ts`, **4 tests**) and writes it to the system clipboard (with an internal-buffer
  fallback for non-secure contexts). Paste feeds the text straight into the engine's
  `paste_csv_string` via a `PasteCsv` command (tab-delimited, multi-cell). Cut = copy + clear.
- **Fill handle** — the selection's bottom-right square is draggable; dragging down issues
  `AutoFillRows`, dragging right `AutoFillColumns` (IronCalc's series detection: copy / linear / date /
  known lists). Painted in the overlay; hit-tested via `GridRenderer.isOnFillHandle`.
- **Formatting toolbar** (`chrome/toolbar.tsx`) — bold / italic / underline (IronCalc style paths via
  `SetStyle`) and a number-format preset dropdown (General / Number / Percent / Currency / Date / Text
  as ECMA-376 codes). Applied across the whole selection; the engine re-renders formatted text on the
  next viewport read.
- **Save-state indicator** — the workbench shows Saving… / All changes saved / Save failed from
  `onSaveStateChange`.

All driven through the `SheetCanvasHandle` (`applyStyle`, `undo`, `redo`, `commitActiveInput`). The
full P4 set typechecks clean against the project tsconfig.

## Deferred (with the engine support already present)
- **Merged cells** — needs wrapper-level merge support (IronCalc `UserModel` has no merge method; it
  lives on the worksheet model). Render + hit-test once the wrapper exposes it.
- **Frozen-pane rendering** — `SetFrozenRows/Columns` ops exist and persist; the grid renderer paints a
  single scroll region today. The 4-quadrant clipped paint is the remaining piece.
- **Paste-special** (values / formats / formulas / transpose) and **marching-ants** cut border.
- **Virtual scrollbars** and self-blit scroll optimization.
