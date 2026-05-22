/**
 * Provision wizard — unit tests for the pure helpers.
 *
 * Run with the project's standard runner:
 *   npx tsx --test src/app/sabsms/numbers/new/__tests__/wizard.test.ts
 *
 * Only the pure helpers (validators, cost-cap, compliance lookup,
 * provider catalog) are tested here. The Mongo + server-action paths
 * live in the (Phase 1.6) integration suite.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  exceedsCostCap,
  isComplianceRequired,
  listProviders,
  validateProvisionInput,
} from "../helpers";

describe("validateProvisionInput", () => {
  it("rejects an empty draft with a list of issues", () => {
    const issues = validateProvisionInput({});
    const fields = issues.map((i) => i.field);
    assert.ok(fields.includes("provider"));
    assert.ok(fields.includes("country"));
    assert.ok(fields.includes("type"));
    assert.ok(fields.includes("numbers"));
    assert.ok(fields.includes("useCase"));
  });

  it("flags non-phase-1 providers", () => {
    const issues = validateProvisionInput({
      provider: "vonage",
      country: "US",
      type: "longcode",
      numbers: ["+15555550100"],
      capabilities: { sms: true, mms: false, rcs: false, voice: false },
      useCase: "transactional_otp",
      monthlyCostEstimate: 100,
    });
    assert.ok(issues.some((i) => i.field === "provider"));
  });

  it("requires sender id for alphanumeric type", () => {
    const issues = validateProvisionInput({
      provider: "twilio",
      country: "DE",
      type: "alphanumeric",
      numbers: ["SABSMS"],
      capabilities: { sms: true, mms: false, rcs: false, voice: false },
      useCase: "transactional_otp",
      monthlyCostEstimate: 0,
    });
    assert.ok(issues.some((i) => i.field === "defaultSenderId"));
  });

  it("rejects an invalid webhook override URL", () => {
    const issues = validateProvisionInput({
      provider: "twilio",
      country: "US",
      type: "longcode",
      numbers: ["+15555550100"],
      capabilities: { sms: true, mms: false, rcs: false, voice: false },
      useCase: "transactional_otp",
      monthlyCostEstimate: 100,
      webhookUrlOverride: "ftp://example.com/hook",
    });
    assert.ok(issues.some((i) => i.field === "webhookUrlOverride"));
  });

  it("accepts a fully populated Twilio US longcode draft", () => {
    const issues = validateProvisionInput({
      provider: "twilio",
      country: "US",
      type: "longcode",
      numbers: ["+15555550100"],
      capabilities: { sms: true, mms: false, rcs: false, voice: false },
      useCase: "transactional_otp",
      monthlyCostEstimate: 100,
      webhookUrlOverride: "https://example.com/hook",
    });
    assert.equal(issues.length, 0);
  });

  it("rejects an invalid country code length", () => {
    const issues = validateProvisionInput({
      provider: "twilio",
      country: "USA",
      type: "longcode",
      numbers: ["+15555550100"],
      capabilities: { sms: true, mms: false, rcs: false, voice: false },
      useCase: "transactional_otp",
      monthlyCostEstimate: 100,
    });
    assert.ok(issues.some((i) => i.field === "country"));
  });
});

describe("exceedsCostCap", () => {
  it("returns false below the $100/mo threshold", () => {
    assert.equal(exceedsCostCap(99_99), false);
    assert.equal(exceedsCostCap(0), false);
  });

  it("returns true above the $100/mo threshold", () => {
    assert.equal(exceedsCostCap(100_01), true);
    assert.equal(exceedsCostCap(1_000_00), true);
  });

  it("treats exactly $100 as still within cap", () => {
    assert.equal(exceedsCostCap(100_00), false);
  });
});

describe("isComplianceRequired", () => {
  it("requires 10DLC for US longcodes", () => {
    const r = isComplianceRequired({ country: "US", type: "longcode" });
    assert.equal(r.required, true);
    assert.equal(r.key, "10dlc");
  });

  it("requires DLT for IN longcodes", () => {
    const r = isComplianceRequired({ country: "IN", type: "longcode" });
    assert.equal(r.required, true);
    assert.equal(r.key, "dlt");
  });

  it("does not require compliance for US toll-free", () => {
    const r = isComplianceRequired({ country: "US", type: "tollfree" });
    assert.equal(r.required, false);
    assert.equal(r.key, null);
  });

  it("does not require compliance for other countries", () => {
    const r = isComplianceRequired({ country: "GB", type: "longcode" });
    assert.equal(r.required, false);
  });
});

describe("listProviders", () => {
  it("marks Twilio as the only available provider in Phase 1", () => {
    const providers = listProviders();
    const twilio = providers.find((p) => p.id === "twilio");
    assert.ok(twilio);
    assert.equal(twilio?.available, true);
    assert.equal(twilio?.phase, "phase-1");
  });

  it("marks every other provider as Phase 7", () => {
    const providers = listProviders();
    const others = providers.filter((p) => p.id !== "twilio");
    assert.ok(others.length >= 10);
    assert.ok(others.every((p) => p.available === false));
    assert.ok(others.every((p) => p.phase === "phase-7"));
  });
});
