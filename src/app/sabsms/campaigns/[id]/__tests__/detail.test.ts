/**
 * SabSMS — `/sabsms/campaigns/[id]` detail helpers.
 *
 * Run with:
 *
 *   npx tsx --test src/app/sabsms/campaigns/\[id\]/__tests__/detail.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CampaignDetail } from "../actions";
import {
  bucketCountry,
  buildFunnelFromStats,
  funnelIsMonotonic,
  marginPct,
} from "../helpers";

function emptyStats(): CampaignDetail["stats"] {
  return {
    total: 0,
    queued: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    replied: 0,
    clicked: 0,
    unsubscribed: 0,
  };
}

describe("buildFunnelFromStats", () => {
  it("emits the five canonical steps in order", () => {
    const steps = buildFunnelFromStats({
      ...emptyStats(),
      queued: 10,
      sent: 80,
      delivered: 70,
      failed: 5,
      clicked: 20,
    });
    assert.equal(steps.length, 5);
    assert.deepEqual(
      steps.map((s) => s.label),
      ["queued", "sent", "delivered", "clicked", "converted"],
    );
  });

  it("computes queued as sum of all downstream states", () => {
    const steps = buildFunnelFromStats({
      ...emptyStats(),
      queued: 5,
      sent: 10,
      delivered: 30,
      failed: 2,
    });
    // queued (top) = 5 + 10 + 30 + 2 = 47
    assert.equal(steps[0].count, 47);
    // sent step = sent + delivered = 10 + 30 = 40
    assert.equal(steps[1].count, 40);
    assert.equal(steps[2].count, 30);
  });

  it("clamps missing fields to zero without throwing", () => {
    const steps = buildFunnelFromStats({
      total: 0,
    } as unknown as CampaignDetail["stats"]);
    assert.equal(steps[0].count, 0);
    assert.equal(steps[3].count, 0);
  });
});

describe("funnelIsMonotonic", () => {
  it("returns true for a strictly decreasing funnel", () => {
    assert.equal(
      funnelIsMonotonic([
        { label: "queued", count: 100 },
        { label: "sent", count: 90 },
        { label: "delivered", count: 80 },
        { label: "clicked", count: 10 },
        { label: "converted", count: 0 },
      ]),
      true,
    );
  });

  it("returns true when adjacent steps are equal", () => {
    assert.equal(
      funnelIsMonotonic([
        { label: "a", count: 50 },
        { label: "b", count: 50 },
        { label: "c", count: 40 },
      ]),
      true,
    );
  });

  it("flags an increase as non-monotonic", () => {
    assert.equal(
      funnelIsMonotonic([
        { label: "a", count: 10 },
        { label: "b", count: 20 },
      ]),
      false,
    );
  });
});

describe("marginPct", () => {
  it("returns 0 when price is zero", () => {
    assert.equal(marginPct(100, 0), 0);
  });

  it("returns 0 when price is negative", () => {
    assert.equal(marginPct(100, -5), 0);
  });

  it("returns 50% margin when cost is half of price", () => {
    assert.equal(marginPct(50, 100), 50);
  });

  it("rounds to one decimal place", () => {
    // cost 33, price 100 → 67% margin
    assert.equal(marginPct(33, 100), 67);
  });
});

describe("bucketCountry", () => {
  it("returns the first three bytes of an E.164 number", () => {
    assert.equal(bucketCountry("+15551234567"), "+15");
    assert.equal(bucketCountry("+919876543210"), "+91");
  });

  it("returns the raw string when shorter than three bytes", () => {
    assert.equal(bucketCountry("+1"), "+1");
    assert.equal(bucketCountry(""), "");
  });
});
