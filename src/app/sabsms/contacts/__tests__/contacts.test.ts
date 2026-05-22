/**
 * SabSMS contacts — unit tests for the pure helpers exported by
 * `../actions.ts`. The repo uses `node:test`:
 *
 *   npx tsx --test src/app/sabsms/contacts/__tests__/contacts.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bestSendHourFromHours,
  consentFromConsentEvents,
  countryFromPhone,
  engagementScore,
  hashPhone,
} from "../helpers";

describe("hashPhone", () => {
  it("produces a stable sha-256 hex digest", () => {
    const a = hashPhone("+14155551212");
    const b = hashPhone("+14155551212");
    assert.equal(a, b);
    assert.equal(a.length, 64);
    assert.match(a, /^[0-9a-f]+$/);
  });

  it("normalises whitespace and case before hashing", () => {
    const a = hashPhone("+14155551212");
    const b = hashPhone("  +14155551212  ");
    assert.equal(a, b);
  });
});

describe("countryFromPhone", () => {
  it("maps the highest-volume prefixes", () => {
    assert.equal(countryFromPhone("+14155551212"), "US");
    assert.equal(countryFromPhone("+447911123456"), "GB");
    assert.equal(countryFromPhone("+919876543210"), "IN");
    assert.equal(countryFromPhone("+5511999999999"), "BR");
    assert.equal(countryFromPhone("+4915123456789"), "DE");
    assert.equal(countryFromPhone("+919876"), "IN");
  });

  it("falls back to XX when no prefix matches", () => {
    assert.equal(countryFromPhone("0000000"), "XX");
    assert.equal(countryFromPhone("+99999"), "XX");
  });
});

describe("engagementScore", () => {
  it("returns 0 when there's no activity", () => {
    assert.equal(
      engagementScore({ sent: 0, delivered: 0, replied: 0, failed: 0 }),
      0,
    );
  });

  it("ramps with replies and clamps to 100", () => {
    const high = engagementScore({
      sent: 10,
      delivered: 10,
      replied: 10,
      failed: 0,
    });
    assert.ok(high > 50);
    assert.ok(high <= 100);
  });

  it("docks points for failures", () => {
    const a = engagementScore({ sent: 10, delivered: 10, replied: 0, failed: 0 });
    const b = engagementScore({ sent: 10, delivered: 10, replied: 0, failed: 8 });
    assert.ok(b <= a);
  });
});

describe("bestSendHourFromHours", () => {
  it("returns undefined for an empty list", () => {
    assert.equal(bestSendHourFromHours([]), undefined);
  });

  it("returns the most-common hour", () => {
    assert.equal(bestSendHourFromHours([9, 10, 10, 11, 10]), 10);
  });

  it("ignores out-of-range values", () => {
    const h = bestSendHourFromHours([-1, 25, 14, 14]);
    assert.equal(h, 14);
  });
});

describe("consentFromConsentEvents", () => {
  it("collapses to opt_out when any opt-out is present", () => {
    assert.equal(
      consentFromConsentEvents(["opt_in_double", "opt_out_stop"]),
      "opt_out",
    );
    assert.equal(
      consentFromConsentEvents(["opt_out_complaint"]),
      "opt_out",
    );
  });

  it("prefers double over single", () => {
    assert.equal(
      consentFromConsentEvents(["opt_in_double"]),
      "double",
    );
    assert.equal(
      consentFromConsentEvents(["opt_in_double", "opt_in_single"]),
      "double",
    );
  });

  it("returns single when only single opt-in is present", () => {
    assert.equal(
      consentFromConsentEvents(["opt_in_single"]),
      "single",
    );
    assert.equal(
      consentFromConsentEvents(["opt_in_restart"]),
      "single",
    );
  });

  it("returns none on empty input", () => {
    assert.equal(consentFromConsentEvents([]), "none");
    assert.equal(
      consentFromConsentEvents([undefined, null]),
      "none",
    );
  });
});
