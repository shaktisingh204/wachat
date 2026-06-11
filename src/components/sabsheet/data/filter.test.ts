/** Run: npx tsx --test src/components/sabsheet/data/filter.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { distinctByColumn, computeHiddenRows } from "./filter.ts";
import type { CellView } from "../../../lib/sabsheet/commands/ops.ts";

const cv = (row: number, col: number, text: string): CellView => ({ row, col, text, formula: null });
// A1:B4 — header row 1, data rows 2..4. Col A = Status, Col B = Owner.
const cells = [
  cv(1, 1, "Status"), cv(1, 2, "Owner"),
  cv(2, 1, "Open"), cv(2, 2, "Ann"),
  cv(3, 1, "Done"), cv(3, 2, "Bob"),
  cv(4, 1, "Open"), cv(4, 2, "Bob"),
];
const box = { top: 1, left: 1, bottom: 4, right: 2 };

test("distinctByColumn collects sorted distinct values per column", () => {
  const d = distinctByColumn(cells, box);
  assert.deepEqual(d[0], ["Done", "Open"]); // col A offset 0
  assert.deepEqual(d[1], ["Ann", "Bob"]); // col B offset 1
});

test("filter on one column hides non-matching data rows", () => {
  // Show only Status=Open → hide row 3 (Done).
  const hidden = computeHiddenRows(cells, box, { 0: ["Open"] });
  assert.deepEqual(hidden, [3]);
});

test("filters across columns are AND-ed", () => {
  // Status=Open AND Owner=Bob → only row 4 kept; hide rows 2,3.
  const hidden = computeHiddenRows(cells, box, { 0: ["Open"], 1: ["Bob"] });
  assert.deepEqual(hidden, [2, 3]);
});

test("no filters hides nothing", () => {
  assert.deepEqual(computeHiddenRows(cells, box, {}), []);
});

test("blank cells filter as empty string", () => {
  const withBlank = [...cells, cv(5, 2, "")]; // box extended conceptually
  const b2 = { top: 1, left: 1, bottom: 5, right: 2 };
  const hidden = computeHiddenRows(withBlank, b2, { 0: ["Open", "Done"] }); // row5 has no A value ("") → hidden
  assert.ok(hidden.includes(5));
});
