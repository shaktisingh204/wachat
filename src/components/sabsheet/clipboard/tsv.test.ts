/** Run: npx tsx --test src/components/sabsheet/clipboard/tsv.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cellsToTsv } from "./tsv.ts";
import type { CellView } from "../../../lib/sabsheet/commands/ops.ts";

const cv = (row: number, col: number, text: string): CellView => ({ row, col, text, formula: null });

test("dense rectangle with blanks", () => {
  const cells = [cv(1, 1, "a"), cv(1, 2, "b"), cv(2, 2, "d")];
  const tsv = cellsToTsv(cells, { top: 1, left: 1, bottom: 2, right: 2 });
  assert.equal(tsv, "a\tb\n\td");
});

test("single cell", () => {
  assert.equal(cellsToTsv([cv(3, 3, "x")], { top: 3, left: 3, bottom: 3, right: 3 }), "x");
});

test("quotes fields containing tabs/newlines/quotes", () => {
  const cells = [cv(1, 1, "a\tb"), cv(1, 2, 'he said "hi"')];
  const tsv = cellsToTsv(cells, { top: 1, left: 1, bottom: 1, right: 2 });
  assert.equal(tsv, '"a\tb"\t"he said ""hi"""');
});

test("empty selection region is all blanks", () => {
  const tsv = cellsToTsv([], { top: 1, left: 1, bottom: 2, right: 3 });
  assert.equal(tsv, "\t\t\n\t\t");
});
