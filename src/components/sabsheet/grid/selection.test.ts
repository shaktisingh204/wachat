/** Run: npx tsx --test src/components/sabsheet/grid/selection.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  singleCell,
  selectionBox,
  move,
  extend,
  extendTo,
  colToLetters,
  lettersToCol,
  cellToA1,
  a1ToCell,
  selectionLabel,
  selectionCount,
  isSingleCell,
} from "./selection.ts";

const B = { maxRow: 1_000_000, maxCol: 16_384 };

test("colToLetters covers the Excel range", () => {
  assert.equal(colToLetters(1), "A");
  assert.equal(colToLetters(26), "Z");
  assert.equal(colToLetters(27), "AA");
  assert.equal(colToLetters(52), "AZ");
  assert.equal(colToLetters(703), "AAA");
  assert.equal(colToLetters(16384), "XFD"); // last Excel column
});

test("lettersToCol is the inverse", () => {
  for (const c of [1, 26, 27, 52, 703, 16384]) {
    assert.equal(lettersToCol(colToLetters(c)), c);
  }
  assert.equal(lettersToCol("xfd"), 16384); // case-insensitive
  assert.equal(lettersToCol(""), 0);
});

test("A1 round-trips", () => {
  assert.equal(cellToA1({ row: 7, col: 2 }), "B7");
  assert.deepEqual(a1ToCell("B7"), { row: 7, col: 2 });
  assert.deepEqual(a1ToCell("  AA100 "), { row: 100, col: 27 });
  assert.equal(a1ToCell("7B"), null);
  assert.equal(a1ToCell("Sheet1!A1"), null);
});

test("move collapses range and clamps at edges", () => {
  let s = singleCell(1, 1);
  s = move(s, -1, -1, B); // can't go above A1
  assert.deepEqual(s.active, { row: 1, col: 1 });
  s = move(s, 4, 2, B);
  assert.deepEqual(s.active, { row: 5, col: 3 });
  assert.ok(isSingleCell(s));
});

test("extend keeps the anchor and grows the box", () => {
  let s = singleCell(2, 2);
  s = extend(s, 3, 1, B); // active -> (5,3), anchor stays (2,2)
  const box = selectionBox(s);
  assert.deepEqual(box, { top: 2, left: 2, bottom: 5, right: 3 });
  assert.equal(selectionCount(s), 4 * 2);
});

test("extend normalizes when active passes the anchor", () => {
  let s = singleCell(5, 5);
  s = extendTo(s, 2, 3, B); // active above-left of anchor
  const box = selectionBox(s);
  assert.deepEqual(box, { top: 2, left: 3, bottom: 5, right: 5 });
});

test("selectionLabel reads like Excel", () => {
  assert.equal(selectionLabel(singleCell(7, 2)), "B7");
  let s = singleCell(1, 1);
  s = extend(s, 8, 2, B);
  assert.equal(selectionLabel(s), "A1:C9");
});

test("clamps to axis bounds", () => {
  const small = { maxRow: 10, maxCol: 5 };
  let s = singleCell(10, 5);
  s = move(s, 5, 5, small);
  assert.deepEqual(s.active, { row: 10, col: 5 });
});
