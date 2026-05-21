/**
 * SabSMS inbox — unit tests for the SLA + scope predicates.
 *
 * The repo standardises on `node:test` (see `package.json` scripts like
 * `test:rbac` / `test:sla`). Running:
 *
 *   npx tsx --test src/app/sabsms/inbox/__tests__/segment.test.ts
 *
 * If the project later adopts Vitest, the `describe` / `it` shape is
 * already compatible — only the import line changes.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FIRST_RESPONSE_SLA_MS,
  RESOLUTION_SLA_MS,
  computeSlaState,
  scopeMatches,
} from "../sla";
import type { InboxConversationView } from "../types";

function baseConversation(
  overrides: Partial<InboxConversationView> = {},
): InboxConversationView {
  return {
    id: "c1",
    contactId: "+15550000001",
    status: "open",
    unreadCount: 0,
    assignedAgentId: null,
    labels: [],
    lastMessagePreview: "hello",
    lastMessageAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("computeSlaState", () => {
  it("flags a first-response breach when the SLA window has elapsed", () => {
    const created = new Date("2026-01-01T00:00:00.000Z");
    const now = new Date(created.getTime() + FIRST_RESPONSE_SLA_MS + 60_000);
    const sla = computeSlaState(
      baseConversation({
        createdAt: created.toISOString(),
        firstResponseAt: undefined,
      }),
      now,
    );
    assert.equal(sla.firstResponseBreached, true);
    assert.ok((sla.firstResponseRemainingMs ?? 0) < 0);
  });

  it("clears first-response tracking once an agent has replied", () => {
    const created = new Date("2026-01-01T00:00:00.000Z");
    const now = new Date(created.getTime() + 2 * FIRST_RESPONSE_SLA_MS);
    const sla = computeSlaState(
      baseConversation({
        createdAt: created.toISOString(),
        firstResponseAt: new Date(
          created.getTime() + 5 * 60_000,
        ).toISOString(),
      }),
      now,
    );
    assert.equal(sla.firstResponseBreached, false);
    assert.equal(sla.firstResponseRemainingMs, null);
  });

  it("stops resolution timing once the conversation is closed", () => {
    const created = new Date("2026-01-01T00:00:00.000Z");
    const now = new Date(created.getTime() + 2 * RESOLUTION_SLA_MS);
    const sla = computeSlaState(
      baseConversation({
        createdAt: created.toISOString(),
        status: "closed",
      }),
      now,
    );
    assert.equal(sla.resolutionRemainingMs, null);
    assert.equal(sla.resolutionBreached, false);
  });
});

describe("scopeMatches", () => {
  it("only surfaces unassigned open conversations under the unassigned scope", () => {
    const unassigned = baseConversation({ assignedAgentId: null });
    const assigned = baseConversation({
      id: "c2",
      assignedAgentId: "agent.support",
    });
    const closed = baseConversation({ id: "c3", status: "closed" });

    assert.equal(scopeMatches(unassigned, "unassigned"), true);
    assert.equal(scopeMatches(assigned, "unassigned"), false);
    assert.equal(scopeMatches(closed, "unassigned"), false);
  });

  it("groups open + snoozed under the all scope", () => {
    assert.equal(
      scopeMatches(baseConversation({ status: "open" }), "all"),
      true,
    );
    assert.equal(
      scopeMatches(baseConversation({ status: "snoozed" }), "all"),
      true,
    );
    assert.equal(
      scopeMatches(baseConversation({ status: "closed" }), "all"),
      false,
    );
  });
});
