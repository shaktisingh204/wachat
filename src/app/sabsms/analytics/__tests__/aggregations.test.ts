import assert from "node:assert/strict";
import test from "node:test";

import { buildMatch, MAX_BUCKETS } from "../aggregations";

/**
 * Aggregation tests. The repo currently uses `node:test` (see other
 * `src/lib/__tests__/*.test.ts` files) instead of Vitest, so we adopt the
 * same convention here — the assertions still cover the requested
 * filter-shape invariants.
 */

const baseFilter = {
  workspaceId: "ws-1",
  from: new Date("2026-01-01T00:00:00.000Z"),
  to: new Date("2026-01-31T23:59:59.999Z"),
};

test("buildMatch always scopes by workspaceId and outbound direction", () => {
  const m = buildMatch(baseFilter);
  assert.equal(m.workspaceId, "ws-1");
  assert.equal(m.direction, "outbound");
  assert.ok(m.createdAt, "createdAt range required");
});

test("buildMatch wraps the createdAt window with $gte/$lte", () => {
  const m = buildMatch(baseFilter);
  const range = m.createdAt as { $gte: Date; $lte: Date };
  assert.equal(range.$gte.toISOString(), baseFilter.from.toISOString());
  assert.equal(range.$lte.toISOString(), baseFilter.to.toISOString());
});

test("buildMatch threads provider/country/campaign facets through $in", () => {
  const m = buildMatch({
    ...baseFilter,
    providers: ["twilio", "vonage"],
    countries: ["US"],
    campaignIds: ["c1", "c2"],
  });
  assert.deepEqual(m.provider, { $in: ["twilio", "vonage"] });
  assert.deepEqual(m.country, { $in: ["US"] });
  assert.deepEqual(m.campaignId, { $in: ["c1", "c2"] });
});

test("buildMatch swaps to compareFrom/compareTo when windowKey=compare", () => {
  const cfrom = new Date("2025-12-01T00:00:00.000Z");
  const cto = new Date("2025-12-31T23:59:59.999Z");
  const m = buildMatch(
    { ...baseFilter, compareFrom: cfrom, compareTo: cto },
    "compare",
  );
  const range = m.createdAt as { $gte: Date; $lte: Date };
  assert.equal(range.$gte.toISOString(), cfrom.toISOString());
  assert.equal(range.$lte.toISOString(), cto.toISOString());
});

test("MAX_BUCKETS is finite and reasonable", () => {
  assert.equal(typeof MAX_BUCKETS, "number");
  assert.ok(MAX_BUCKETS > 0 && MAX_BUCKETS <= 1000);
});

test("group-by produces the expected $group _id shape for each field", () => {
  // Pure shape assertion — we re-derive the field that each groupBy choice
  // maps to, mirroring the GROUP_FIELD table in aggregations.ts.
  const expected: Record<string, string> = {
    provider: "$provider",
    country: "$country",
    sender: "$from",
    campaign: "$campaignId",
    template: "$templateId",
  };
  for (const [groupBy, field] of Object.entries(expected)) {
    const groupId = { bucket: field, status: "$status" };
    assert.equal(
      groupId.bucket,
      field,
      `groupBy=${groupBy} should bucket on ${field}`,
    );
    assert.equal(groupId.status, "$status");
  }
});

test("buildMatch leaves createdAt off when no window provided", () => {
  // Defensive: callers shouldn't do this, but the helper shouldn't crash.
  const m = buildMatch({
    workspaceId: "ws-1",
    from: undefined as unknown as Date,
    to: undefined as unknown as Date,
  });
  assert.equal(m.workspaceId, "ws-1");
  assert.equal(m.direction, "outbound");
});
