/** Run: npx tsx --test src/components/sabsheet/grid/axis-index.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AxisIndex } from "./axis-index.ts";

test("uniform axis: offsets and total", () => {
  const a = new AxisIndex(1_000_000, 24);
  assert.equal(a.offsetOf(0), 0);
  assert.equal(a.offsetOf(10), 240);
  assert.equal(a.sizeOf(5), 24);
  assert.equal(a.totalExtent(), 24_000_000);
});

test("overrides shift subsequent offsets", () => {
  const a = new AxisIndex(100, 20);
  a.setSize(2, 50); // +30 delta
  assert.equal(a.sizeOf(2), 50);
  assert.equal(a.offsetOf(2), 40); // rows 0,1 at 20 each
  assert.equal(a.offsetOf(3), 90); // 40 + 50
  assert.equal(a.offsetOf(4), 110); // + 20
  // A line before the override is unaffected.
  assert.equal(a.offsetOf(1), 20);
});

test("multiple overrides accumulate in order", () => {
  const a = new AxisIndex(100, 10);
  a.setSize(5, 30); // +20
  a.setSize(2, 40); // +30
  // offsetOf(6) = 6*10 + deltas of overrides <6 (idx2:+30, idx5:+20) = 60 + 50 = 110
  assert.equal(a.offsetOf(6), 110);
});

test("hidden line has zero size and does not advance offset", () => {
  const a = new AxisIndex(100, 20);
  a.setSize(3, 0);
  assert.ok(a.isHidden(3));
  assert.equal(a.offsetOf(3), 60);
  assert.equal(a.offsetOf(4), 60); // hidden row 3 occupies no pixels
});

test("resetSize reverts to default", () => {
  const a = new AxisIndex(100, 20);
  a.setSize(2, 80);
  a.resetSize(2);
  assert.equal(a.sizeOf(2), 20);
  assert.equal(a.offsetOf(3), 60);
});

test("indexAt is the inverse of offsetOf", () => {
  const a = new AxisIndex(1000, 24);
  a.setSize(10, 100);
  for (const idx of [0, 1, 9, 10, 11, 50, 999]) {
    const start = a.offsetOf(idx);
    const r = a.indexAt(start);
    assert.equal(r.index, idx, `indexAt(${start}) should be ${idx}`);
    assert.equal(r.start, start);
    // A point in the middle of the line resolves to the same index.
    const mid = start + Math.floor(a.sizeOf(idx) / 2);
    assert.equal(a.indexAt(mid).index, idx);
  }
});

test("indexAt clamps out-of-range offsets", () => {
  const a = new AxisIndex(50, 20);
  assert.deepEqual(a.indexAt(-100), { index: 0, start: 0 });
  assert.equal(a.indexAt(999_999).index, 49);
});

test("rangeForViewport returns visible inclusive range", () => {
  const a = new AxisIndex(1000, 20);
  // scroll 100 (row 5) through 300px window -> rows 5..19 (offset 100..400)
  const { start, end } = a.rangeForViewport(100, 300);
  assert.equal(start, 5);
  assert.equal(end, 20); // offsetOf(20)=400 is the line containing the bottom edge
});

test("scales to 1M rows cheaply (no per-row allocation)", () => {
  const a = new AxisIndex(1_000_000, 24);
  a.setSize(500_000, 60);
  const t = Date.now();
  // Many queries near the far end stay fast.
  for (let i = 0; i < 10_000; i++) a.offsetOf(900_000 + (i % 1000));
  assert.ok(Date.now() - t < 500);
  // Override still shifts the tail by its delta (+36).
  assert.equal(a.offsetOf(1_000_000), 24_000_000 + 36);
});
