import assert from "node:assert/strict";
import test from "node:test";

import {
  HOLIDAYS,
  buildMonthGrid,
  computeSlotCapacity,
  describeCron,
  detectCrossCampaignConflicts,
  detectQuietHourConflicts,
  type ScheduledSend,
} from "../scheduling";

/**
 * Pure-helpers unit tests — `node:test` to match the repo's existing
 * runner. The test imports from `../scheduling` so it never pulls
 * Mongo into the boot graph.
 */

function send(partial: Partial<ScheduledSend>): ScheduledSend {
  return {
    id: partial.id ?? "id",
    workspaceId: partial.workspaceId ?? "ws",
    kind: partial.kind ?? "campaign",
    name: partial.name ?? "x",
    sendAt: partial.sendAt ?? new Date().toISOString(),
    templateId: partial.templateId,
    campaignId: partial.campaignId,
    senderId: partial.senderId ?? "sender",
    recipientCount: partial.recipientCount ?? 1,
    status: partial.status ?? "scheduled",
    recipientTz: partial.recipientTz,
    country: partial.country,
    cron: partial.cron,
    quietHours: partial.quietHours,
    notes: partial.notes,
    createdAt: partial.createdAt ?? new Date().toISOString(),
    updatedAt: partial.updatedAt ?? new Date().toISOString(),
  };
}

test("describeCron renders the four common patterns in English", () => {
  assert.equal(describeCron("0 9 * * *"), "Every day at 9am");
  assert.equal(describeCron("30 17 * * 1-5"), "Every weekday at 5:30pm");
  assert.equal(describeCron("0 9 * * 1"), "Every Monday at 9am");
  assert.equal(describeCron("0 0 15 * *"), "On the 15th of every month at 12am");
});

test("describeCron passes the raw expression through when the shape is exotic", () => {
  // Step values, ranges in min/hour — keep the user honest.
  assert.equal(describeCron("*/15 * * * *"), "*/15 * * * *");
  assert.equal(describeCron("not a cron"), "not a cron");
});

test("detectQuietHourConflicts flags wrap-around windows correctly", () => {
  const s1 = send({
    id: "a",
    sendAt: "2026-05-21T03:30:00Z", // UTC-only fallback ⇒ hour 3 (in window)
    quietHours: { start: 21, end: 8 },
  });
  const s2 = send({
    id: "b",
    sendAt: "2026-05-21T14:00:00Z",
    quietHours: { start: 21, end: 8 },
  });
  const conflicts = detectQuietHourConflicts([s1, s2]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].sendId, "a");
});

test("detectCrossCampaignConflicts pairs same-hour same-sender sends", () => {
  const s1 = send({
    id: "1",
    senderId: "shared",
    sendAt: "2026-05-21T09:30:00Z",
  });
  const s2 = send({
    id: "2",
    senderId: "shared",
    sendAt: "2026-05-21T09:45:00Z",
  });
  const s3 = send({
    id: "3",
    senderId: "other",
    sendAt: "2026-05-21T09:30:00Z",
  });
  const conflicts = detectCrossCampaignConflicts([s1, s2, s3]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].a, "1");
  assert.equal(conflicts[0].b, "2");
  assert.equal(conflicts[0].sender, "shared");
});

test("computeSlotCapacity sums recipientCount per sender per hour", () => {
  const cap = computeSlotCapacity([
    send({
      id: "1",
      senderId: "s1",
      sendAt: "2026-05-21T09:00:00Z",
      recipientCount: 100,
    }),
    send({
      id: "2",
      senderId: "s1",
      sendAt: "2026-05-21T09:30:00Z",
      recipientCount: 50,
    }),
    send({
      id: "3",
      senderId: "s1",
      sendAt: "2026-05-21T10:00:00Z",
      recipientCount: 25,
    }),
  ]);
  assert.equal(cap.get("s1::2026-05-21T09"), 150);
  assert.equal(cap.get("s1::2026-05-21T10"), 25);
});

test("buildMonthGrid produces 42 cells with the right boundary cells flagged", () => {
  // May 2026 — May 1 is a Friday, so the grid starts on Sun Apr 26.
  const grid = buildMonthGrid(2026, 4, []);
  assert.equal(grid.length, 42);
  assert.equal(grid[0].iso, "2026-04-26");
  assert.equal(grid[0].inMonth, false);
  // Day 6 in the grid (index 5) is the Friday — first day in-month.
  assert.equal(grid[5].iso, "2026-05-01");
  assert.equal(grid[5].inMonth, true);
});

test("buildMonthGrid surfaces holidays on the matching cells", () => {
  // May 25, 2026 — Memorial Day in the HOLIDAYS seed.
  const grid = buildMonthGrid(2026, 4, [], HOLIDAYS);
  const memorial = grid.find((c) => c.iso === "2026-05-25");
  assert.ok(memorial, "missing day cell");
  assert.equal(memorial!.holiday?.label, "Memorial Day");
});

test("buildMonthGrid attaches sends that fall on the same UTC day", () => {
  const s = send({
    id: "x",
    sendAt: "2026-05-04T15:00:00Z",
  });
  const grid = buildMonthGrid(2026, 4, [s]);
  const cell = grid.find((c) => c.iso === "2026-05-04");
  assert.equal(cell?.sends.length, 1);
  assert.equal(cell?.sends[0].id, "x");
});
