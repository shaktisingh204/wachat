/**
 * Unit tests for the pure pivot computation. Run with:
 *   npx tsx --test src/components/sabsheet/pivot/pivot-compute.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { computePivot, type PivotBox } from "./pivot-compute.ts";
import type { CellView } from "../../../lib/sabsheet/commands/ops.ts";

/** Build CellViews from a dense 2D string array starting at (top,left). */
function cellsFromGrid(
  rows: string[][],
  top = 1,
  left = 1,
): { cells: CellView[]; box: PivotBox } {
  const cells: CellView[] = [];
  rows.forEach((r, ri) => {
    r.forEach((text, ci) => {
      if (text === "") return; // sparse — only non-empty
      cells.push({ row: top + ri, col: left + ci, text, formula: null });
    });
  });
  const box: PivotBox = {
    top,
    left,
    bottom: top + rows.length - 1,
    right: left + (rows[0]?.length ?? 1) - 1,
  };
  return { cells, box };
}

// Sample data: Region | Product | Amount
const SALES: string[][] = [
  ["Region", "Product", "Amount"],
  ["East", "Apple", "10"],
  ["East", "Banana", "20"],
  ["West", "Apple", "5"],
  ["West", "Banana", "15"],
  ["East", "Apple", "30"],
];

test("sum by one dimension (region)", () => {
  const { cells, box } = cellsFromGrid(SALES);
  const r = computePivot(cells, box, {
    rowField: 0,
    colField: null,
    valueField: 2,
    agg: "sum",
  });
  assert.deepEqual(r.rowKeys, ["East", "West"]);
  assert.deepEqual(r.colKeys, [""]);
  // East = 10+20+30 = 60, West = 5+15 = 20
  assert.deepEqual(r.matrix, [[60], [20]]);
  assert.deepEqual(r.rowTotals, [60, 20]);
  assert.equal(r.grandTotal, 80);
});

test("count by one dimension", () => {
  const { cells, box } = cellsFromGrid(SALES);
  const r = computePivot(cells, box, {
    rowField: 0,
    colField: null,
    valueField: 2,
    agg: "count",
  });
  assert.deepEqual(r.rowKeys, ["East", "West"]);
  // East has 3 records, West has 2
  assert.deepEqual(r.matrix, [[3], [2]]);
  assert.deepEqual(r.rowTotals, [3, 2]);
  assert.equal(r.grandTotal, 5);
});

test("two-dimension cross-tab (region x product, sum)", () => {
  const { cells, box } = cellsFromGrid(SALES);
  const r = computePivot(cells, box, {
    rowField: 0,
    colField: 1,
    valueField: 2,
    agg: "sum",
  });
  assert.deepEqual(r.rowKeys, ["East", "West"]);
  assert.deepEqual(r.colKeys, ["Apple", "Banana"]);
  // East: Apple = 10+30 = 40, Banana = 20
  // West: Apple = 5, Banana = 15
  assert.deepEqual(r.matrix, [
    [40, 20],
    [5, 15],
  ]);
  assert.deepEqual(r.rowTotals, [60, 20]);
  assert.deepEqual(r.colTotals, [45, 35]);
  assert.equal(r.grandTotal, 80);
});

test("average aggregation", () => {
  const { cells, box } = cellsFromGrid(SALES);
  const r = computePivot(cells, box, {
    rowField: 0,
    colField: null,
    valueField: 2,
    agg: "average",
  });
  assert.deepEqual(r.rowKeys, ["East", "West"]);
  // East = (10+20+30)/3 = 20, West = (5+15)/2 = 10
  assert.deepEqual(r.matrix, [[20], [10]]);
  assert.equal(r.grandTotal, 80 / 5);
});

test("min and max aggregations", () => {
  const { cells, box } = cellsFromGrid(SALES);
  const mn = computePivot(cells, box, {
    rowField: 0,
    colField: null,
    valueField: 2,
    agg: "min",
  });
  // East min = 10, West min = 5
  assert.deepEqual(mn.matrix, [[10], [5]]);
  assert.equal(mn.grandTotal, 5);

  const mx = computePivot(cells, box, {
    rowField: 0,
    colField: null,
    valueField: 2,
    agg: "max",
  });
  // East max = 30, West max = 15
  assert.deepEqual(mx.matrix, [[30], [15]]);
  assert.equal(mx.grandTotal, 30);
});

test("totals are consistent across rows and cols", () => {
  const { cells, box } = cellsFromGrid(SALES);
  const r = computePivot(cells, box, {
    rowField: 0,
    colField: 1,
    valueField: 2,
    agg: "sum",
  });
  // Sum of rowTotals === grandTotal === sum of colTotals.
  const sumRow = r.rowTotals.reduce((a, b) => a + b, 0);
  const sumCol = r.colTotals.reduce((a, b) => a + b, 0);
  assert.equal(sumRow, r.grandTotal);
  assert.equal(sumCol, r.grandTotal);
});

test("blank value cells are excluded from numeric aggregation but missing rows handled", () => {
  // Row "South / Apple" has a blank amount — should produce a 0 cell under sum.
  const data: string[][] = [
    ["Region", "Product", "Amount"],
    ["East", "Apple", "10"],
    ["South", "Apple", ""], // blank value
    ["South", "Apple", "7"],
  ];
  const { cells, box } = cellsFromGrid(data);
  const r = computePivot(cells, box, {
    rowField: 0,
    colField: null,
    valueField: 2,
    agg: "sum",
  });
  assert.deepEqual(r.rowKeys, ["East", "South"]);
  // East = 10, South = 0 + 7 = 7 (blank skipped)
  assert.deepEqual(r.matrix, [[10], [7]]);
  assert.equal(r.grandTotal, 17);

  // Under count, the blank value cell does NOT count as a record.
  const c = computePivot(cells, box, {
    rowField: 0,
    colField: null,
    valueField: 2,
    agg: "count",
  });
  // East = 1, South = 1 (only the "7" row counts; blank skipped)
  assert.deepEqual(c.matrix, [[1], [1]]);
  assert.equal(c.grandTotal, 2);
});

test("empty / too-small selection returns an empty result", () => {
  const r = computePivot([], { top: 1, left: 1, bottom: 1, right: 1 }, {
    rowField: 0,
    colField: null,
    valueField: 0,
    agg: "sum",
  });
  assert.deepEqual(r.rowKeys, []);
  assert.equal(r.grandTotal, 0);
});

test("parseNumeric tolerates currency/thousands in the value field", () => {
  const data: string[][] = [
    ["Region", "Amount"],
    ["East", "$1,000"],
    ["East", "$2,500"],
  ];
  const { cells, box } = cellsFromGrid(data);
  const r = computePivot(cells, box, {
    rowField: 0,
    colField: null,
    valueField: 1,
    agg: "sum",
  });
  assert.deepEqual(r.matrix, [[3500]]);
  assert.equal(r.grandTotal, 3500);
});
