/**
 * Unit tests for the pure chart-data extractor.
 * Run: npx tsx --test src/components/sabsheet/charts/chart-data.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { extractChartData, toRechartsRows } from "./chart-data.ts";
import type { ChartBox } from "./chart-data.ts";
import type { CellView } from "../../../lib/sabsheet/commands/ops.ts";

function cell(row: number, col: number, text: string): CellView {
  return { row, col, text, formula: null };
}

test("labels in col A + one numeric series, with header row", () => {
  // A1 "Month" | B1 "Sales"
  // A2 "Jan"   | B2 100
  // A3 "Feb"   | B3 200
  const cells: CellView[] = [
    cell(1, 1, "Month"),
    cell(1, 2, "Sales"),
    cell(2, 1, "Jan"),
    cell(2, 2, "100"),
    cell(3, 1, "Feb"),
    cell(3, 2, "200"),
  ];
  const box: ChartBox = { top: 1, left: 1, bottom: 3, right: 2 };
  const out = extractChartData(cells, box, { headerRow: true, headerCol: true });

  assert.deepEqual(out.categories, ["Jan", "Feb"]);
  assert.equal(out.series.length, 1);
  assert.equal(out.series[0].name, "Sales");
  assert.deepEqual(out.series[0].values, [100, 200]);
});

test("labels in col A + two numeric series", () => {
  const cells: CellView[] = [
    cell(1, 1, "Region"),
    cell(1, 2, "Q1"),
    cell(1, 3, "Q2"),
    cell(2, 1, "East"),
    cell(2, 2, "10"),
    cell(2, 3, "15"),
    cell(3, 1, "West"),
    cell(3, 2, "20"),
    cell(3, 3, "25"),
  ];
  const box: ChartBox = { top: 1, left: 1, bottom: 3, right: 3 };
  const out = extractChartData(cells, box, { headerRow: true, headerCol: true });

  assert.deepEqual(out.categories, ["East", "West"]);
  assert.equal(out.series.length, 2);
  assert.deepEqual(out.series.map((s) => s.name), ["Q1", "Q2"]);
  assert.deepEqual(out.series[0].values, [10, 20]);
  assert.deepEqual(out.series[1].values, [15, 25]);
});

test("no headers — generated category indices and series names", () => {
  const cells: CellView[] = [
    cell(5, 3, "7"),
    cell(6, 3, "8"),
    cell(7, 3, "9"),
  ];
  const box: ChartBox = { top: 5, left: 3, bottom: 7, right: 3 };
  const out = extractChartData(cells, box, { headerRow: false, headerCol: false });

  assert.deepEqual(out.categories, ["1", "2", "3"]);
  assert.equal(out.series.length, 1);
  assert.equal(out.series[0].name, "Series 1");
  assert.deepEqual(out.series[0].values, [7, 8, 9]);
});

test("header detection — headerCol only (categories, no named series)", () => {
  const cells: CellView[] = [
    cell(1, 1, "Jan"),
    cell(1, 2, "100"),
    cell(2, 1, "Feb"),
    cell(2, 2, "200"),
  ];
  const box: ChartBox = { top: 1, left: 1, bottom: 2, right: 2 };
  const out = extractChartData(cells, box, { headerRow: false, headerCol: true });

  assert.deepEqual(out.categories, ["Jan", "Feb"]);
  assert.equal(out.series.length, 1);
  assert.equal(out.series[0].name, "Series 1");
  assert.deepEqual(out.series[0].values, [100, 200]);
});

test("blank / sparse cells fill to zero and empty category labels", () => {
  // B2 missing entirely; A3 label missing.
  const cells: CellView[] = [
    cell(1, 1, "Label"),
    cell(1, 2, "Value"),
    cell(2, 1, "First"),
    // (2,2) blank
    // (3,1) blank label
    cell(3, 2, "42"),
  ];
  const box: ChartBox = { top: 1, left: 1, bottom: 3, right: 2 };
  const out = extractChartData(cells, box, { headerRow: true, headerCol: true });

  assert.deepEqual(out.categories, ["First", ""]);
  assert.equal(out.series[0].name, "Value");
  assert.deepEqual(out.series[0].values, [0, 42]);
});

test("non-numeric values (currency, percent, parens) parse via parseNumeric", () => {
  const cells: CellView[] = [
    cell(1, 1, "Item"),
    cell(1, 2, "Amount"),
    cell(2, 1, "A"),
    cell(2, 2, "$1,200"),
    cell(3, 1, "B"),
    cell(3, 2, "(300)"),
    cell(4, 1, "C"),
    cell(4, 2, "50%"),
  ];
  const box: ChartBox = { top: 1, left: 1, bottom: 4, right: 2 };
  const out = extractChartData(cells, box, { headerRow: true, headerCol: true });

  assert.deepEqual(out.series[0].values, [1200, -300, 0.5]);
});

test("reversed box coordinates are normalized", () => {
  const cells: CellView[] = [
    cell(1, 1, "X"),
    cell(1, 2, "Y"),
    cell(2, 1, "a"),
    cell(2, 2, "5"),
  ];
  // bottom/right given smaller than top/left
  const box: ChartBox = { top: 2, left: 2, bottom: 1, right: 1 };
  const out = extractChartData(cells, box, { headerRow: true, headerCol: true });

  assert.deepEqual(out.categories, ["a"]);
  assert.deepEqual(out.series[0].values, [5]);
});

test("toRechartsRows produces row-per-category records", () => {
  const data = {
    categories: ["Jan", "Feb"],
    series: [
      { name: "Sales", values: [100, 200] },
      { name: "Costs", values: [40, 80] },
    ],
  };
  const rows = toRechartsRows(data);
  assert.deepEqual(rows, [
    { __category: "Jan", Sales: 100, Costs: 40 },
    { __category: "Feb", Sales: 200, Costs: 80 },
  ]);
});
