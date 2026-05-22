/**
 * SabSMS contact-detail — unit tests for the pure helpers in
 * `../actions.ts`. Uses `node:test`:
 *
 *   npx tsx --test src/app/sabsms/contacts/[id]/__tests__/detail.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeRiskScore } from "../../helpers";

describe("computeRiskScore", () => {
  it("returns 0 when there's no activity", () => {
    assert.equal(
      computeRiskScore({ failed: 0, sent: 0, complaints: 0 }),
      0,
    );
  });

  it("scales with failure rate", () => {
    const low = computeRiskScore({ failed: 1, sent: 100, complaints: 0 });
    const high = computeRiskScore({ failed: 50, sent: 100, complaints: 0 });
    assert.ok(high > low);
  });

  it("complaints bump risk dramatically", () => {
    const a = computeRiskScore({ failed: 0, sent: 100, complaints: 0 });
    const b = computeRiskScore({ failed: 0, sent: 100, complaints: 2 });
    assert.ok(b > a);
  });

  it("clamps to the 0–100 range", () => {
    const ceiling = computeRiskScore({
      failed: 9999,
      sent: 10,
      complaints: 100,
    });
    assert.ok(ceiling <= 100);
    assert.ok(ceiling >= 0);
  });

  it("rises monotonically as complaints grow", () => {
    const s0 = computeRiskScore({ failed: 5, sent: 50, complaints: 0 });
    const s1 = computeRiskScore({ failed: 5, sent: 50, complaints: 1 });
    const s2 = computeRiskScore({ failed: 5, sent: 50, complaints: 2 });
    assert.ok(s1 >= s0);
    assert.ok(s2 >= s1);
  });
});
