/** Run: npx tsx --test src/components/sabsheet/grid/aggregate.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNumeric, computeAggregates, aggregateLabel } from "./aggregate.ts";
import type { CellView } from "../../../lib/sabsheet/commands/ops.ts";

const cv = (text: string): CellView => ({ row: 1, col: 1, text, formula: null });

test("parseNumeric handles plain, currency, thousands, percent, parens", () => {
  assert.equal(parseNumeric("42"), 42);
  assert.equal(parseNumeric("1,234.5"), 1234.5);
  assert.equal(parseNumeric("$2,000"), 2000);
  assert.equal(parseNumeric("50%"), 0.5);
  assert.equal(parseNumeric("(30)"), -30);
  assert.equal(parseNumeric("-7"), -7);
});

test("parseNumeric rejects text", () => {
  assert.equal(parseNumeric("hello"), null);
  assert.equal(parseNumeric(""), null);
  assert.equal(parseNumeric("N/A"), null);
});

test("computeAggregates over mixed cells", () => {
  const a = computeAggregates([cv("10"), cv("20"), cv("30"), cv("text"), cv("")]);
  assert.equal(a.count, 4); // 3 numbers + "text"; blank skipped
  assert.equal(a.numericCount, 3);
  assert.equal(a.sum, 60);
  assert.equal(a.average, 20);
  assert.equal(a.min, 10);
  assert.equal(a.max, 30);
});

test("aggregateLabel hidden for a single cell", () => {
  assert.equal(aggregateLabel(computeAggregates([cv("5")])), null);
});

test("aggregateLabel shows count-only for non-numeric multi-selection", () => {
  const label = aggregateLabel(computeAggregates([cv("a"), cv("b")]));
  assert.equal(label, "Count: 2");
});

test("aggregateLabel shows sum + avg + count for numbers", () => {
  const label = aggregateLabel(computeAggregates([cv("10"), cv("20")]));
  assert.equal(label, "Sum: 30   Avg: 15   Count: 2");
});
