/**
 * TypeScript twin of `rust/crates/sabsheet-engine/src/ops.rs`.
 *
 * This MUST stay byte-compatible with the Rust serde representation: a tagged union
 * `{ type: "setCellInput", sheet, row, col, input }` with camelCase variant names + fields.
 * The wasm engine (`WasmEngine.apply`) deserializes exactly these shapes via serde-wasm-bindgen, and
 * the server `sabsheet-ops` endpoint deserializes them via serde_json — so a drift here is a runtime
 * decode error, not a type error. `ops.contract.test.ts` pins the JSON shapes against the Rust tests.
 */

/** Rectangular range — mirrors IronCalc `Area` (1-based row/col, 0-based sheet index). */
export interface RangeRef {
  sheet: number;
  row: number;
  col: number;
  width: number;
  height: number;
}

export type Command =
  | { type: "setCellInput"; sheet: number; row: number; col: number; input: string }
  | { type: "clearContents"; range: RangeRef }
  | { type: "clearAll"; range: RangeRef }
  | { type: "setStyle"; range: RangeRef; path: string; value: string }
  | { type: "insertRows"; sheet: number; row: number; count: number }
  | { type: "insertColumns"; sheet: number; col: number; count: number }
  | { type: "deleteRows"; sheet: number; row: number; count: number }
  | { type: "deleteColumns"; sheet: number; col: number; count: number }
  | { type: "setRowHeight"; sheet: number; row: number; count: number; height: number }
  | { type: "setColumnWidth"; sheet: number; col: number; count: number; width: number }
  | { type: "setFrozenRows"; sheet: number; count: number }
  | { type: "setFrozenColumns"; sheet: number; count: number }
  | { type: "autoFillRows"; source: RangeRef; toRow: number }
  | { type: "autoFillColumns"; source: RangeRef; toCol: number }
  | { type: "pasteCsv"; range: RangeRef; csv: string }
  | { type: "sortRange"; range: RangeRef; keyColOffset: number; ascending: boolean; hasHeader: boolean }
  | { type: "replaceAll"; range: RangeRef; find: string; replace: string; matchCase: boolean }
  | { type: "newSheet" }
  | { type: "deleteSheet"; sheet: number }
  | { type: "renameSheet"; sheet: number; name: string }
  | { type: "setSheetColor"; sheet: number; color: string }
  | { type: "hideSheet"; sheet: number }
  | { type: "unhideSheet"; sheet: number }
  | { type: "setShowGridLines"; sheet: number; show: boolean }
  | { type: "newDefinedName"; name: string; scope: number | null; formula: string }
  | {
      type: "updateDefinedName";
      name: string;
      scope: number | null;
      newName: string;
      newScope: number | null;
      newFormula: string;
    }
  | { type: "deleteDefinedName"; name: string; scope: number | null };

/** One materialized cell from a viewport read — mirrors Rust `CellView`. */
export interface CellView {
  row: number;
  col: number;
  text: string;
  /** Present (and equal to `=...`) when the cell holds a formula. */
  formula: string | null;
}

/** A single cell as a 1×1 range. */
export function cellRange(sheet: number, row: number, col: number): RangeRef {
  return { sheet, row, col, width: 1, height: 1 };
}

/** Concise command builders — the chrome calls these instead of writing object literals. */
export const cmd = {
  setCell: (sheet: number, row: number, col: number, input: string): Command => ({
    type: "setCellInput",
    sheet,
    row,
    col,
    input,
  }),
  clearContents: (range: RangeRef): Command => ({ type: "clearContents", range }),
  clearAll: (range: RangeRef): Command => ({ type: "clearAll", range }),
  setStyle: (range: RangeRef, path: string, value: string): Command => ({
    type: "setStyle",
    range,
    path,
    value,
  }),
  insertRows: (sheet: number, row: number, count: number): Command => ({
    type: "insertRows",
    sheet,
    row,
    count,
  }),
  insertColumns: (sheet: number, col: number, count: number): Command => ({
    type: "insertColumns",
    sheet,
    col,
    count,
  }),
  deleteRows: (sheet: number, row: number, count: number): Command => ({
    type: "deleteRows",
    sheet,
    row,
    count,
  }),
  deleteColumns: (sheet: number, col: number, count: number): Command => ({
    type: "deleteColumns",
    sheet,
    col,
    count,
  }),
  autoFillRows: (source: RangeRef, toRow: number): Command => ({
    type: "autoFillRows",
    source,
    toRow,
  }),
  pasteCsv: (range: RangeRef, csv: string): Command => ({ type: "pasteCsv", range, csv }),
  sortRange: (range: RangeRef, keyColOffset: number, ascending: boolean, hasHeader: boolean): Command => ({
    type: "sortRange",
    range,
    keyColOffset,
    ascending,
    hasHeader,
  }),
  replaceAll: (range: RangeRef, find: string, replace: string, matchCase: boolean): Command => ({
    type: "replaceAll",
    range,
    find,
    replace,
    matchCase,
  }),
  newSheet: (): Command => ({ type: "newSheet" }),
  renameSheet: (sheet: number, name: string): Command => ({ type: "renameSheet", sheet, name }),
} as const;

/** Common IronCalc style paths, for typo-free `setStyle` calls from the toolbar. */
export const StylePath = {
  bold: "font.b",
  italic: "font.i",
  underline: "font.u",
  strike: "font.strike",
  fontColor: "font.color",
  fontName: "font.name",
  fontSize: "font.sz",
  fillColor: "fill.fg_color",
  numberFormat: "num_fmt",
  alignHorizontal: "alignment.horizontal",
  alignVertical: "alignment.vertical",
} as const;
