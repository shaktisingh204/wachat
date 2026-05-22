/**
 * Drip builder — validator unit tests.
 *
 * Run with:
 *   npx tsx --test src/app/sabsms/drips/[id]/__tests__/validate.test.ts
 *
 * Covers the five rule families enforced by `validateDrip`:
 *   - orphan nodes
 *   - cycles
 *   - missing template ids
 *   - branches with no consequent
 *   - contradictory exit conditions
 *
 * Also includes a happy-path case that must produce `{ ok: true }`.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateDrip, type DraftDrip } from "../validate";

function baseDrip(overrides: Partial<DraftDrip> = {}): DraftDrip {
  return {
    name: "Welcome series",
    enabled: true,
    entryTrigger: { kind: "manual" },
    nodes: [
      { id: "start", kind: "start" },
      { id: "msg1", kind: "message", templateId: "tpl_welcome" },
      { id: "exit", kind: "exit" },
    ],
    edges: [
      { id: "start->msg1", from: "start", to: "msg1" },
      { id: "msg1->exit", from: "msg1", to: "exit" },
    ],
    ...overrides,
  };
}

describe("validateDrip — happy path", () => {
  it("accepts a minimal start → message → exit drip", () => {
    const result = validateDrip(baseDrip());
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.deepEqual(result.errors, []);
  });
});

describe("validateDrip — orphans", () => {
  it("flags an orphan message node disconnected from the graph", () => {
    const drip = baseDrip({
      nodes: [
        { id: "start", kind: "start" },
        { id: "msg1", kind: "message", templateId: "tpl_welcome" },
        { id: "msg_orphan", kind: "message", templateId: "tpl_extra" },
        { id: "exit", kind: "exit" },
      ],
      edges: [
        { id: "start->msg1", from: "start", to: "msg1" },
        { id: "msg1->exit", from: "msg1", to: "exit" },
      ],
    });
    const result = validateDrip(drip);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((e) => e.includes("msg_orphan") && e.includes("orphan")),
      `expected orphan error, got ${JSON.stringify(result.errors)}`,
    );
  });
});

describe("validateDrip — cycles", () => {
  it("flags a back-edge cycle in the graph", () => {
    const drip = baseDrip({
      nodes: [
        { id: "start", kind: "start" },
        { id: "msg1", kind: "message", templateId: "tpl_a" },
        { id: "msg2", kind: "message", templateId: "tpl_b" },
      ],
      edges: [
        { id: "start->msg1", from: "start", to: "msg1" },
        { id: "msg1->msg2", from: "msg1", to: "msg2" },
        { id: "msg2->msg1", from: "msg2", to: "msg1" },
      ],
    });
    const result = validateDrip(drip);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((e) => e.toLowerCase().includes("cycle")),
      `expected cycle error, got ${JSON.stringify(result.errors)}`,
    );
  });
});

describe("validateDrip — missing template ids", () => {
  it("flags a message step with no templateId", () => {
    const drip = baseDrip({
      nodes: [
        { id: "start", kind: "start" },
        { id: "msg1", kind: "message" }, // templateId missing
        { id: "exit", kind: "exit" },
      ],
    });
    const result = validateDrip(drip);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((e) => e.includes("msg1") && e.includes("templateId")),
      `expected templateId error, got ${JSON.stringify(result.errors)}`,
    );
  });
});

describe("validateDrip — branch consequents", () => {
  it("flags a branch with no false-edge consequent", () => {
    const drip = baseDrip({
      nodes: [
        { id: "start", kind: "start" },
        { id: "br1", kind: "branch", branchOn: "replied", branchWithinSeconds: 3600 },
        { id: "msg_yes", kind: "message", templateId: "tpl_yes" },
        { id: "exit", kind: "exit" },
      ],
      edges: [
        { id: "start->br1", from: "start", to: "br1" },
        { id: "br1->msg_yes", from: "br1", to: "msg_yes", branchValue: "true" },
        { id: "msg_yes->exit", from: "msg_yes", to: "exit" },
      ],
    });
    const result = validateDrip(drip);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((e) => e.includes("br1") && e.toLowerCase().includes("true and false")),
      `expected branch consequent error, got ${JSON.stringify(result.errors)}`,
    );
  });
});

describe("validateDrip — exit-condition contradictions", () => {
  it("flags `replied` AND `notReplied` both being set", () => {
    const drip = baseDrip({
      exitConditions: { replied: true, notReplied: true },
    });
    const result = validateDrip(drip);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((e) =>
        e.toLowerCase().includes("contradictory") && e.includes("replied"),
      ),
      `expected contradictory exit error, got ${JSON.stringify(result.errors)}`,
    );
  });
});

describe("validateDrip — structural rules", () => {
  it("flags drips with no nodes", () => {
    const result = validateDrip({
      name: "empty",
      enabled: false,
      entryTrigger: { kind: "manual" },
      nodes: [],
      edges: [],
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.toLowerCase().includes("no steps")));
  });

  it("requires exactly one start node", () => {
    const drip = baseDrip({
      nodes: [
        { id: "start1", kind: "start" },
        { id: "start2", kind: "start" },
        { id: "msg1", kind: "message", templateId: "tpl_a" },
        { id: "exit", kind: "exit" },
      ],
      edges: [
        { id: "start1->msg1", from: "start1", to: "msg1" },
        { id: "start2->msg1", from: "start2", to: "msg1" },
        { id: "msg1->exit", from: "msg1", to: "exit" },
      ],
    });
    const result = validateDrip(drip);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.toLowerCase().includes("more than one start")));
  });
});
