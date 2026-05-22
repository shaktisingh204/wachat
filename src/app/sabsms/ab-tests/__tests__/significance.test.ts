import assert from "node:assert/strict";
import test from "node:test";

import {
  computeSegmentLifts,
  computeSignificance,
  type AbTestRow,
} from "../significance";

/**
 * Pure stats unit tests — `node:test` to match the repo's existing test
 * runner. The test imports from `../significance` (the pure-stats module)
 * so it never pulls Mongo / Next runtime into the boot graph; the page
 * still imports the same helpers via `./actions` re-exports.
 *
 * We assert on:
 *  1. Edge cases (zero samples, identical proportions)
 *  2. Direction (small p when variant clearly wins)
 *  3. Wilson CI sanity (lower < phat < upper, contained in [0,1])
 *  4. Significance gate (small samples ⇒ never significant even if p<0.05)
 *  5. Segment lift helper aggregates against the control arm
 */

test("computeSignificance returns p=1 when an arm is empty", () => {
  const r = computeSignificance(0, 0, 10, 100);
  assert.equal(r.pValue, 1);
  assert.equal(r.significant, false);
  assert.equal(r.ciLow, 0);
  assert.equal(r.ciHigh, 0);
});

test("computeSignificance returns p≈1 when proportions are identical", () => {
  const r = computeSignificance(50, 500, 50, 500);
  assert.ok(r.pValue > 0.9, `expected high p, got ${r.pValue}`);
  assert.equal(r.significant, false);
});

test("computeSignificance flags a large, clearly-different test as significant", () => {
  // 5% vs 10% on 2000 per arm — well past the 0.05 threshold.
  const r = computeSignificance(100, 2000, 200, 2000);
  assert.ok(r.pValue < 0.001, `expected tiny p, got ${r.pValue}`);
  assert.equal(r.significant, true);
  assert.ok(
    r.ciLow > 0.08 && r.ciHigh < 0.12,
    `CI off: ${r.ciLow}–${r.ciHigh}`,
  );
});

test("computeSignificance does not flag tiny samples even with a low p", () => {
  // 0/10 vs 5/10 — proportions look wildly different but n is too small
  // for our 30-per-arm gate, so we deliberately refuse to call it.
  const r = computeSignificance(0, 10, 5, 10);
  assert.equal(r.significant, false);
});

test("computeSignificance Wilson CI stays inside [0, 1] and brackets phat", () => {
  const r = computeSignificance(50, 1000, 75, 1000);
  const phat = 75 / 1000;
  assert.ok(r.ciLow >= 0 && r.ciHigh <= 1, "CI must be in [0,1]");
  assert.ok(r.ciLow < phat && phat < r.ciHigh, "phat must lie inside CI");
});

test("computeSegmentLifts splits per-variant against the control", () => {
  const fixture: AbTestRow = {
    id: "t",
    name: "x",
    kind: "body",
    status: "running",
    metric: "ctr",
    statsMode: "frequentist",
    autoPromote: false,
    minSample: 100,
    variants: [
      {
        id: "ctrl",
        label: "control",
        total: 1000,
        conversions: 100,
        clicks: 100,
        replies: 0,
        costMicros: 0,
        segment: "all",
      },
      {
        id: "v1",
        label: "variant",
        total: 1000,
        conversions: 150,
        clicks: 150,
        replies: 0,
        costMicros: 0,
        segment: "us",
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const lifts = computeSegmentLifts(fixture);
  assert.equal(lifts.length, 1);
  assert.equal(lifts[0].segment, "us");
  assert.ok(Math.abs(lifts[0].lift - 0.5) < 0.01, `lift off: ${lifts[0].lift}`);
  assert.ok(lifts[0].significant);
});
