/** Run: npx tsx --test src/lib/sabsheet/validation/types.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { listForCell, type DataValidationRule } from "./types.ts";

const rule: DataValidationRule = {
  id: "v1",
  sheet: 0,
  range: { top: 1, left: 2, bottom: 5, right: 2 },
  type: "list",
  list: ["Open", "Closed", "Pending"],
};

test("listForCell returns the list inside the range", () => {
  assert.deepEqual(listForCell([rule], 0, 3, 2), ["Open", "Closed", "Pending"]);
});

test("listForCell is null outside the range", () => {
  assert.equal(listForCell([rule], 0, 3, 1), null);
  assert.equal(listForCell([rule], 0, 6, 2), null);
});

test("listForCell respects the sheet index", () => {
  assert.equal(listForCell([rule], 1, 3, 2), null);
});

test("no rules → null", () => {
  assert.equal(listForCell([], 0, 1, 1), null);
});
