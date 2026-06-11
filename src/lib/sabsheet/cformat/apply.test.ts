/** Run: npx tsx --test src/lib/sabsheet/cformat/apply.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyConditionalFormats, lerpColor } from "./apply.ts";
import type { CFRule } from "./types.ts";
import type { CellView } from "../commands/ops.ts";

const cv = (row: number, col: number, text: string): CellView => ({ row, col, text, formula: null });
const box = { top: 1, left: 1, bottom: 10, right: 10 };

test("greaterThan applies fill to matching cells only", () => {
  const rules: CFRule[] = [
    { id: "r1", sheet: 0, range: box, operator: "greaterThan", value1: "50", format: { fill: "#ff0000" } },
  ];
  const out = applyConditionalFormats([cv(1, 1, "80"), cv(1, 2, "20")], rules);
  assert.equal(out[0].fill, "#ff0000");
  assert.equal(out[1].fill, undefined);
});

test("between is inclusive", () => {
  const rules: CFRule[] = [
    { id: "r", sheet: 0, range: box, operator: "between", value1: "10", value2: "20", format: { color: "#00f" } },
  ];
  const out = applyConditionalFormats([cv(1, 1, "10"), cv(1, 2, "15"), cv(1, 3, "21")], rules);
  assert.equal(out[0].color, "#00f");
  assert.equal(out[1].color, "#00f");
  assert.equal(out[2].color, undefined);
});

test("textContains is case-insensitive", () => {
  const rules: CFRule[] = [
    { id: "r", sheet: 0, range: box, operator: "textContains", value1: "err", format: { fill: "#fee" } },
  ];
  const out = applyConditionalFormats([cv(1, 1, "ERROR"), cv(1, 2, "ok")], rules);
  assert.equal(out[0].fill, "#fee");
  assert.equal(out[1].fill, undefined);
});

test("out-of-range cells are untouched", () => {
  const rules: CFRule[] = [
    { id: "r", sheet: 0, range: { top: 1, left: 1, bottom: 1, right: 1 }, operator: "greaterThan", value1: "0", format: { fill: "#0f0" } },
  ];
  const out = applyConditionalFormats([cv(5, 5, "100")], rules);
  assert.equal(out[0].fill, undefined);
});

test("colorScale2 interpolates min..max", () => {
  const rules: CFRule[] = [
    { id: "r", sheet: 0, range: box, operator: "colorScale2", minColor: "#000000", maxColor: "#ffffff" },
  ];
  const out = applyConditionalFormats([cv(1, 1, "0"), cv(1, 2, "100"), cv(1, 3, "50")], rules);
  assert.equal(out[0].fill, "#000000");
  assert.equal(out[1].fill, "#ffffff");
  assert.equal(out[2].fill, "#808080");
});

test("empty rules returns the same array", () => {
  const cells = [cv(1, 1, "x")];
  assert.equal(applyConditionalFormats(cells, []), cells);
});

test("lerpColor midpoint", () => {
  assert.equal(lerpColor("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(lerpColor("#ff0000", "#0000ff", 0), "#ff0000");
});
