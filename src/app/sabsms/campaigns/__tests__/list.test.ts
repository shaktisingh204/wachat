/**
 * SabSMS — `/sabsms/campaigns` list helpers.
 *
 * Repo convention is `node:test` (see `src/lib/__tests__/qr-utils.test.ts`).
 * Run with:
 *
 *   npx tsx --test src/app/sabsms/campaigns/__tests__/list.test.ts
 *
 * These tests cover the pure helpers in `../helpers.ts` so they don't
 * need a live Mongo / engine.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeProgress,
  formatCents,
  formatEta,
  rollupCampaigns,
} from "../helpers";
import type { CampaignRow } from "../actions";

function baseRow(overrides: Partial<CampaignRow> = {}): CampaignRow {
  return {
    id: "c1",
    name: "Promo",
    status: "running",
    category: "marketing",
    templateId: "t1",
    audienceSize: 100,
    velocity: 0,
    progressPct: 0,
    costSoFar: 0,
    costForecast: 0,
    ctr: 0,
    replyRate: 0,
    optOutRate: 0,
    tags: [],
    stats: {
      total: 100,
      queued: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      replied: 0,
      clicked: 0,
      unsubscribed: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("formatCents", () => {
  it("formats cents as USD with two decimals", () => {
    assert.equal(formatCents(0), "$0.00");
    assert.equal(formatCents(150), "$1.50");
    assert.equal(formatCents(12345), "$123.45");
  });
});

describe("formatEta", () => {
  it("returns '—' when iso is missing", () => {
    assert.equal(formatEta(undefined), "—");
  });

  it("returns 'any moment' when the eta has already passed", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    assert.equal(formatEta(past), "any moment");
  });

  it("formats sub-hour windows in minutes", () => {
    const now = new Date("2026-05-21T12:00:00.000Z").getTime();
    const target = new Date(now + 5 * 60_000).toISOString();
    assert.equal(formatEta(target, now), "~5 min");
  });

  it("formats multi-hour windows in hours", () => {
    const now = new Date("2026-05-21T12:00:00.000Z").getTime();
    const target = new Date(now + 3 * 60 * 60_000).toISOString();
    assert.equal(formatEta(target, now), "~3 h");
  });
});

describe("computeProgress", () => {
  it("clamps to 100 when sent exceeds audience", () => {
    assert.equal(computeProgress(100, 250, "running"), 100);
  });

  it("returns 0 for empty audience that is not completed", () => {
    assert.equal(computeProgress(0, 0, "running"), 0);
  });

  it("returns 100 for empty audience that is completed", () => {
    assert.equal(computeProgress(0, 0, "completed"), 100);
  });

  it("rounds to nearest integer percent", () => {
    assert.equal(computeProgress(3, 1, "running"), 33);
  });
});

describe("rollupCampaigns", () => {
  it("aggregates counts, audience, and delivered across rows", () => {
    const rows: CampaignRow[] = [
      baseRow({
        id: "a",
        status: "running",
        audienceSize: 100,
        stats: {
          ...baseRow().stats,
          total: 100,
          delivered: 50,
        },
      }),
      baseRow({
        id: "b",
        status: "scheduled",
        audienceSize: 200,
        stats: {
          ...baseRow().stats,
          total: 200,
          delivered: 0,
        },
      }),
      baseRow({
        id: "c",
        status: "completed",
        audienceSize: 50,
        stats: {
          ...baseRow().stats,
          total: 50,
          delivered: 50,
        },
      }),
      baseRow({
        id: "d",
        status: "failed",
        audienceSize: 10,
        stats: {
          ...baseRow().stats,
          total: 10,
          delivered: 0,
        },
      }),
    ];
    const r = rollupCampaigns(rows);
    assert.equal(r.total, 4);
    assert.equal(r.running, 1);
    assert.equal(r.scheduled, 1);
    assert.equal(r.completed, 1);
    assert.equal(r.failed, 1);
    assert.equal(r.audience, 360);
    assert.equal(r.delivered, 100);
  });

  it("returns zeros for an empty list", () => {
    const r = rollupCampaigns([]);
    assert.equal(r.total, 0);
    assert.equal(r.running, 0);
    assert.equal(r.audience, 0);
    assert.equal(r.delivered, 0);
  });
});
