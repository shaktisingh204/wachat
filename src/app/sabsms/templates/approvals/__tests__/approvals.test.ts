/**
 * SabSMS approvals — unit tests for the pure helpers.
 *
 * Run with:
 *   npx tsx --test src/app/sabsms/templates/approvals/__tests__/approvals.test.ts
 *
 * We exercise the pure heuristics — compliance scoring and the undeclared
 * variable detector — plus the exported SLA constant. The DB-backed
 * action handlers are integration territory and excluded here.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  APPROVAL_SLA_MS,
  computeComplianceScore,
  detectUndeclaredVariables,
} from "../heuristics";

describe("computeComplianceScore", () => {
  it("returns 100 for a clean body", () => {
    assert.equal(
      computeComplianceScore("Your OTP is {{code}}. Valid for 5 minutes."),
      100,
    );
  });

  it("docks points for marketing trigger words", () => {
    const score = computeComplianceScore("Get a FREE phone now!");
    assert.ok(score < 100);
    assert.ok(score >= 0);
  });

  it("stacks penalties when multiple triggers fire", () => {
    const cleaner = computeComplianceScore("Hello {{name}}, your order is ready.");
    const dirtier = computeComplianceScore(
      "FREEPHONE!!! Click here NOWNOW for a guaranteed prize $$$",
    );
    assert.ok(dirtier < cleaner);
    // Multiple stacked penalties — FREE-like, !!!, click here, uppercase,
    // guaranteed, $$$ — should produce a meaningfully degraded score.
    assert.ok(dirtier <= 70);
  });

  it("never returns below 0 or above 100", () => {
    const extreme = computeComplianceScore(
      "FREE FREE FREE!!! $$$ CLICK HERE TAP NOW GUARANTEED",
    );
    assert.ok(extreme >= 0);
    assert.ok(extreme <= 100);
  });
});

describe("detectUndeclaredVariables", () => {
  it("flags variables present in the body but missing from `declared`", () => {
    const undeclared = detectUndeclaredVariables(
      "Hello {{ first_name }}, your code is {{otp}}.",
      ["first_name"],
    );
    assert.deepEqual(undeclared, ["otp"]);
  });

  it("returns an empty list when every used variable is declared", () => {
    const undeclared = detectUndeclaredVariables(
      "Hi {{name}}, balance: {{amount}}",
      ["name", "amount"],
    );
    assert.deepEqual(undeclared, []);
  });

  it("ignores the engine-supplied `now` helper", () => {
    const undeclared = detectUndeclaredVariables(
      "Sent at {{ now }} to {{ name }}.",
      ["name"],
    );
    assert.deepEqual(undeclared, []);
  });

  it("dedupes repeated uses of the same variable", () => {
    const undeclared = detectUndeclaredVariables(
      "{{x}} {{x}} {{x}}",
      undefined,
    );
    assert.deepEqual(undeclared, ["x"]);
  });

  it("handles bodies with no variables", () => {
    const undeclared = detectUndeclaredVariables("plain text body", undefined);
    assert.deepEqual(undeclared, []);
  });
});

describe("APPROVAL_SLA_MS", () => {
  it("is 4 hours", () => {
    assert.equal(APPROVAL_SLA_MS, 4 * 60 * 60 * 1000);
  });
});
