/**
 * SabSMS consent log — unit tests for the consent helpers.
 *
 * Run with:
 *   npx tsx --test src/app/sabsms/consent/__tests__/consent.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { signExportPayload, verifyDoubleOptIn } from "../lib";

interface E {
  kind:
    | "opt_in_single"
    | "opt_in_double"
    | "opt_out_stop"
    | "opt_out_manual"
    | "opt_out_complaint"
    | "opt_out_carrier_block"
    | "opt_in_restart";
  createdAt: string;
}

function ev(kind: E["kind"], iso: string): E {
  return { kind, createdAt: iso };
}

describe("verifyDoubleOptIn", () => {
  it("verifies when opt_in_single is followed by opt_in_double", () => {
    const events = [
      ev("opt_in_single", "2026-04-01T00:00:00.000Z"),
      ev("opt_in_double", "2026-04-01T00:05:00.000Z"),
    ];
    const res = verifyDoubleOptIn(events);
    assert.equal(res.verified, true);
    assert.ok(res.verifiedAt instanceof Date);
    assert.equal(
      res.verifiedAt?.toISOString(),
      "2026-04-01T00:05:00.000Z",
    );
  });

  it("rejects when only opt_in_single is present", () => {
    const events = [ev("opt_in_single", "2026-04-01T00:00:00.000Z")];
    const res = verifyDoubleOptIn(events);
    assert.equal(res.verified, false);
    assert.equal(res.verifiedAt, undefined);
  });

  it("rejects when opt_in_double came BEFORE opt_in_single (wrong order)", () => {
    const events = [
      ev("opt_in_double", "2026-04-01T00:00:00.000Z"),
      ev("opt_in_single", "2026-04-01T00:05:00.000Z"),
    ];
    const res = verifyDoubleOptIn(events);
    assert.equal(res.verified, false);
  });

  it("rejects when a STOP came after the double opt-in (consent withdrawn)", () => {
    const events = [
      ev("opt_in_single", "2026-04-01T00:00:00.000Z"),
      ev("opt_in_double", "2026-04-01T00:05:00.000Z"),
      ev("opt_out_stop", "2026-04-02T00:00:00.000Z"),
    ];
    const res = verifyDoubleOptIn(events);
    assert.equal(res.verified, false);
  });

  it("re-verifies after an opt_in_restart following a STOP", () => {
    const events = [
      ev("opt_in_single", "2026-04-01T00:00:00.000Z"),
      ev("opt_in_double", "2026-04-01T00:05:00.000Z"),
      ev("opt_out_stop", "2026-04-02T00:00:00.000Z"),
      ev("opt_in_restart", "2026-04-03T00:00:00.000Z"),
    ];
    const res = verifyDoubleOptIn(events);
    assert.equal(res.verified, true);
    assert.equal(
      res.verifiedAt?.toISOString(),
      "2026-04-03T00:00:00.000Z",
    );
  });

  it("returns a non-verified result on an empty event list", () => {
    const res = verifyDoubleOptIn([]);
    assert.equal(res.verified, false);
  });
});

describe("signExportPayload", () => {
  it("returns a 64-char lowercase hex SHA-256 footer hash", () => {
    const sig = signExportPayload("phone_hash,kind\nabc,opt_in_single\n");
    assert.match(sig, /^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    const a = signExportPayload("payload");
    const b = signExportPayload("payload");
    assert.equal(a, b);
  });

  it("differs for different payloads", () => {
    const a = signExportPayload("payload-1");
    const b = signExportPayload("payload-2");
    assert.notEqual(a, b);
  });
});
