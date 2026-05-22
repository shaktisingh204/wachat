/**
 * Number detail — unit tests for the pure aggregators.
 *
 * Run with the project's standard runner:
 *   npx tsx --test src/app/sabsms/numbers/[id]/__tests__/detail.test.ts
 *
 * Only the pure helpers (day-windowing, volume/health/cost aggregators,
 * country mapping, compliance derivation) are tested here. The Mongo +
 * engine-client paths live in the Phase 1.6 integration suite.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  aggregateByCountry,
  aggregateByTemplate,
  aggregateCost,
  aggregateHealth,
  aggregateVolume,
  countryFromE164,
  daysWindow,
  deriveComplianceStatus,
  isoDay,
  startOfUtcDay,
} from "../helpers";

describe("startOfUtcDay + isoDay", () => {
  it("zeroes out time-of-day in UTC", () => {
    const d = new Date("2026-05-21T15:23:45.123Z");
    const start = startOfUtcDay(d);
    assert.equal(start.toISOString(), "2026-05-21T00:00:00.000Z");
    assert.equal(isoDay(d), "2026-05-21");
  });
});

describe("daysWindow", () => {
  it("returns the requested number of consecutive UTC days ending at 'to'", () => {
    const window = daysWindow(new Date("2026-05-21T00:00:00.000Z"), 3);
    assert.deepEqual(window, ["2026-05-19", "2026-05-20", "2026-05-21"]);
  });

  it("always has length === days", () => {
    const window = daysWindow(new Date(), 30);
    assert.equal(window.length, 30);
  });
});

describe("aggregateVolume", () => {
  it("buckets messages by day and counts sent / delivered / failed", () => {
    const to = new Date("2026-05-21T12:00:00.000Z");
    const msgs = [
      {
        status: "delivered" as const,
        createdAt: new Date("2026-05-21T08:00:00.000Z"),
      },
      {
        status: "delivered" as const,
        createdAt: new Date("2026-05-21T11:00:00.000Z"),
      },
      {
        status: "failed" as const,
        createdAt: new Date("2026-05-20T10:00:00.000Z"),
      },
      {
        status: "sent" as const,
        createdAt: new Date("2026-05-19T10:00:00.000Z"),
      },
    ];
    const series = aggregateVolume(msgs, to, 3);
    const byDay = new Map(series.map((p) => [p.date, p]));
    assert.equal(byDay.get("2026-05-21")?.delivered, 2);
    assert.equal(byDay.get("2026-05-21")?.sent, 2);
    assert.equal(byDay.get("2026-05-20")?.failed, 1);
    assert.equal(byDay.get("2026-05-19")?.sent, 1);
  });

  it("returns zero-filled buckets when nothing is in the window", () => {
    const series = aggregateVolume([], new Date(), 5);
    assert.equal(series.length, 5);
    assert.ok(series.every((p) => p.sent === 0 && p.delivered === 0));
  });
});

describe("aggregateHealth", () => {
  it("computes DLR % from sent + delivered", () => {
    const to = new Date("2026-05-21T12:00:00.000Z");
    const msgs = [
      {
        status: "delivered" as const,
        createdAt: new Date("2026-05-21T01:00:00.000Z"),
      },
      {
        status: "delivered" as const,
        createdAt: new Date("2026-05-21T02:00:00.000Z"),
      },
      {
        status: "failed" as const,
        createdAt: new Date("2026-05-21T03:00:00.000Z"),
      },
    ];
    const series = aggregateHealth(msgs, to, 1);
    assert.equal(series[0].date, "2026-05-21");
    // 2/3 delivered → 66.66 → rounded to 66.7
    assert.equal(series[0].dlrRate, 66.7);
    // 1/3 failed
    assert.equal(series[0].complaintRate, 33.3);
  });
});

describe("aggregateCost", () => {
  it("converts cents → dollars and sums per day", () => {
    const to = new Date("2026-05-21T12:00:00.000Z");
    const msgs = [
      {
        status: "delivered" as const,
        cost: 50,
        price: 75,
        createdAt: new Date("2026-05-21T01:00:00.000Z"),
      },
      {
        status: "delivered" as const,
        cost: 100,
        price: 150,
        createdAt: new Date("2026-05-21T02:00:00.000Z"),
      },
    ];
    const series = aggregateCost(msgs, to, 1);
    assert.equal(series[0].cost, 1.5);
    assert.equal(series[0].revenue, 2.25);
  });
});

describe("countryFromE164", () => {
  it("recognises common country codes", () => {
    assert.equal(countryFromE164("+15555550100"), "US");
    assert.equal(countryFromE164("+919876543210"), "IN");
    assert.equal(countryFromE164("+447911123456"), "GB");
  });

  it("returns null for non-E.164 input", () => {
    assert.equal(countryFromE164(undefined), null);
    assert.equal(countryFromE164(""), null);
    assert.equal(countryFromE164("15555550100"), null);
  });

  it("falls back to XX for unknown prefixes", () => {
    assert.equal(countryFromE164("+9999999999"), "XX");
  });
});

describe("aggregateByCountry", () => {
  it("groups + computes DLR % per destination country", () => {
    const msgs = [
      { status: "delivered" as const, to: "+15555550100" },
      { status: "failed" as const, to: "+15555550101" },
      { status: "delivered" as const, to: "+919876543210" },
    ];
    const rows = aggregateByCountry(msgs);
    const us = rows.find((r) => r.country === "US");
    const ind = rows.find((r) => r.country === "IN");
    assert.equal(us?.sent, 2);
    assert.equal(us?.delivered, 1);
    assert.equal(us?.deliveryRate, 50);
    assert.equal(ind?.sent, 1);
    assert.equal(ind?.deliveryRate, 100);
  });
});

describe("aggregateByTemplate", () => {
  it("groups by templateId and resolves names from the lookup map", () => {
    const names = new Map([["tpl1", "Onboarding OTP"]]);
    const rows = aggregateByTemplate(
      [
        { status: "delivered" as const, templateId: "tpl1" },
        { status: "delivered" as const, templateId: "tpl1" },
        { status: "failed" as const, templateId: "tpl2" },
      ],
      names,
    );
    const tpl1 = rows.find((r) => r.templateId === "tpl1");
    assert.equal(tpl1?.templateName, "Onboarding OTP");
    assert.equal(tpl1?.sent, 2);
    assert.equal(tpl1?.delivered, 2);
    const tpl2 = rows.find((r) => r.templateId === "tpl2");
    // Falls back to id when name isn't in the lookup.
    assert.equal(tpl2?.templateName, "tpl2");
  });
});

describe("deriveComplianceStatus", () => {
  it("marks US longcode as missing when 10DLC is not registered", () => {
    const r = deriveComplianceStatus({
      country: "US",
      type: "longcode",
      tendlcRegistered: false,
      dltRegistered: false,
      hasConsentLog: true,
    });
    assert.equal(r.tendlc, "missing");
    assert.equal(r.dlt, "n/a");
    assert.equal(r.consentLog, "ok");
  });

  it("marks IN longcode as missing when DLT is not registered", () => {
    const r = deriveComplianceStatus({
      country: "IN",
      type: "longcode",
      tendlcRegistered: false,
      dltRegistered: false,
      hasConsentLog: false,
    });
    assert.equal(r.dlt, "missing");
    assert.equal(r.tendlc, "n/a");
    assert.equal(r.consentLog, "missing");
  });

  it("marks non-applicable carriers as n/a", () => {
    const r = deriveComplianceStatus({
      country: "GB",
      type: "tollfree",
      tendlcRegistered: true,
      dltRegistered: true,
      hasConsentLog: true,
    });
    assert.equal(r.tendlc, "n/a");
    assert.equal(r.dlt, "n/a");
  });
});
