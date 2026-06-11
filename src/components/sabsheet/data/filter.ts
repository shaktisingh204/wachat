/**
 * Auto-filter logic (pure, testable). Given the filter range's cells + per-column allowed-value sets,
 * compute which data rows should be hidden. The first row of the range is treated as headers.
 * The grid hides those rows client-side (AxisIndex size 0) — engine data is untouched.
 */
import type { CellView } from "../../../lib/sabsheet/commands/ops.ts";

export interface FilterBox {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

/** Per-column-offset (0-based within the box) → the set of values still shown. Absent = no filter. */
export type ColumnFilters = Record<number, string[]>;

/** Distinct values in each filterable column (offset → sorted distinct cell texts, blanks as ""). */
export function distinctByColumn(cells: CellView[], box: FilterBox): Record<number, string[]> {
  const byKey = new Map<string, string>();
  for (const c of cells) byKey.set(`${c.row},${c.col}`, c.text);
  const out: Record<number, string[]> = {};
  for (let col = box.left; col <= box.right; col++) {
    const offset = col - box.left;
    const seen = new Set<string>();
    for (let row = box.top + 1; row <= box.bottom; row++) {
      seen.add(byKey.get(`${row},${col}`) ?? "");
    }
    out[offset] = [...seen].sort((a, b) => a.localeCompare(b));
  }
  return out;
}

/** Returns the 1-based data row numbers to HIDE given the active column filters. */
export function computeHiddenRows(cells: CellView[], box: FilterBox, filters: ColumnFilters): number[] {
  const byKey = new Map<string, string>();
  for (const c of cells) byKey.set(`${c.row},${c.col}`, c.text);
  const hidden: number[] = [];
  for (let row = box.top + 1; row <= box.bottom; row++) {
    let keep = true;
    for (const [offsetStr, allowed] of Object.entries(filters)) {
      const col = box.left + Number(offsetStr);
      const value = byKey.get(`${row},${col}`) ?? "";
      if (!allowed.includes(value)) {
        keep = false;
        break;
      }
    }
    if (!keep) hidden.push(row);
  }
  return hidden;
}
