/**
 * Pins the TS command JSON shapes against the Rust serde representation in
 * `rust/crates/sabsheet-engine/src/ops.rs` (see its `#[test]` cases). If the Rust enum changes its
 * tag/field naming, these assertions must change in lockstep — that is the point.
 *
 * Run: npx tsx --test src/lib/sabsheet/commands/ops.contract.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cmd, cellRange, StylePath, type Command } from "./ops.ts";

test("setCellInput matches Rust serde shape", () => {
  const c = cmd.setCell(0, 1, 1, "=SUM(A1:A3)");
  assert.deepEqual(c, { type: "setCellInput", sheet: 0, row: 1, col: 1, input: "=SUM(A1:A3)" });
  // Exactly the keys the Rust test asserts: type, sheet, row, col, input.
  assert.deepEqual(Object.keys(c).sort(), ["col", "input", "row", "sheet", "type"]);
});

test("range op nests RangeRef under `range`", () => {
  const c = cmd.clearContents(cellRange(0, 2, 3));
  assert.equal(c.type, "clearContents");
  assert.deepEqual((c as Extract<Command, { type: "clearContents" }>).range, {
    sheet: 0,
    row: 2,
    col: 3,
    width: 1,
    height: 1,
  });
});

test("unit variant serializes to just a tag", () => {
  assert.deepEqual(cmd.newSheet(), { type: "newSheet" });
});

test("setStyle carries path + value (not a nested object)", () => {
  const c = cmd.setStyle(cellRange(0, 1, 1), StylePath.bold, "true");
  assert.deepEqual(c, {
    type: "setStyle",
    range: { sheet: 0, row: 1, col: 1, width: 1, height: 1 },
    path: "font.b",
    value: "true",
  });
});

test("defined-name scope uses null (Rust Option<u32> => null)", () => {
  const c: Command = {
    type: "newDefinedName",
    name: "Revenue",
    scope: null,
    formula: "Sheet1!$A$1:$A$10",
  };
  // JSON round-trip preserves null scope (serde decodes null -> None).
  assert.equal(JSON.parse(JSON.stringify(c)).scope, null);
});

test("autoFillRows uses camelCase toRow", () => {
  const c = cmd.autoFillRows(cellRange(0, 1, 1), 8);
  assert.deepEqual(Object.keys(c).sort(), ["source", "toRow", "type"]);
});

test("sortRange matches Rust serde shape", () => {
  const c = cmd.sortRange({ sheet: 0, row: 1, col: 1, width: 2, height: 4 }, 1, true, true);
  assert.equal(c.type, "sortRange");
  assert.deepEqual(Object.keys(c).sort(), ["ascending", "hasHeader", "keyColOffset", "range", "type"]);
});

test("replaceAll matches Rust serde shape", () => {
  const c = cmd.replaceAll(cellRange(0, 1, 1), "a", "b", false);
  assert.deepEqual(Object.keys(c).sort(), ["find", "matchCase", "range", "replace", "type"]);
});
