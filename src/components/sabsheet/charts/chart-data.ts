/**
 * SabSheet charts — pure data extraction.
 *
 * Turns a sparse list of `CellView`s (only non-empty cells are materialized by the
 * engine) plus the selection box into the dense `{ categories, series }` shape that
 * recharts consumes. No React, no DOM — kept side-effect free so it can be unit
 * tested with `npx tsx --test`.
 */
import type { CellView } from "../../../lib/sabsheet/commands/ops.ts";
import { parseNumeric } from "../grid/aggregate.ts";

/** The rectangular selection the chart was created from (1-based, inclusive). */
export interface ChartBox {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface ChartExtractOptions {
  /** First row of the box holds series names. */
  headerRow: boolean;
  /** First column of the box holds category labels. */
  headerCol: boolean;
}

export interface ChartSeries {
  name: string;
  values: number[];
}

export interface ChartData {
  categories: string[];
  series: ChartSeries[];
}

/**
 * Lay the sparse cells into a dense `grid[r][c]` (string) over the box, then derive
 * categories + numeric series according to the header toggles.
 *
 * Common case ("labels in col A, one or more numeric columns" with `headerCol: true`):
 * col A becomes `categories`, every other column becomes a series whose name comes
 * from the header row (when `headerRow`) or a generated "Series N".
 */
export function extractChartData(
  cells: CellView[],
  box: ChartBox,
  opts: ChartExtractOptions,
): ChartData {
  const top = Math.min(box.top, box.bottom);
  const bottom = Math.max(box.top, box.bottom);
  const left = Math.min(box.left, box.right);
  const right = Math.max(box.left, box.right);

  const rowCount = bottom - top + 1;
  const colCount = right - left + 1;
  if (rowCount <= 0 || colCount <= 0) {
    return { categories: [], series: [] };
  }

  // Dense grid of displayed text, indexed [rowOffset][colOffset] within the box.
  const grid: string[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length: colCount }, () => ""),
  );
  for (const c of cells) {
    if (c.row < top || c.row > bottom || c.col < left || c.col > right) continue;
    grid[c.row - top][c.col - left] = c.text ?? "";
  }

  const { headerRow, headerCol } = opts;
  const dataRowStart = headerRow ? 1 : 0;
  const dataColStart = headerCol ? 1 : 0;

  // Categories — the label column (or generated 1-based indices).
  const categories: string[] = [];
  for (let r = dataRowStart; r < rowCount; r++) {
    if (headerCol) {
      categories.push(grid[r][0] ?? "");
    } else {
      categories.push(String(r - dataRowStart + 1));
    }
  }

  // One series per data column.
  const series: ChartSeries[] = [];
  for (let c = dataColStart; c < colCount; c++) {
    const name = headerRow
      ? (grid[0][c] || `Series ${c - dataColStart + 1}`)
      : `Series ${c - dataColStart + 1}`;
    const values: number[] = [];
    for (let r = dataRowStart; r < rowCount; r++) {
      const parsed = parseNumeric(grid[r][c] ?? "");
      values.push(parsed ?? 0);
    }
    series.push({ name, values });
  }

  return { categories, series };
}

/**
 * Reshape `ChartData` into recharts' row-per-category records, one numeric key per
 * series. Keys are the series names; the category label lives under `__category`.
 */
export function toRechartsRows(
  data: ChartData,
): Array<Record<string, string | number>> {
  return data.categories.map((category, i) => {
    const row: Record<string, string | number> = { __category: category };
    for (const s of data.series) {
      row[s.name] = s.values[i] ?? 0;
    }
    return row;
  });
}
