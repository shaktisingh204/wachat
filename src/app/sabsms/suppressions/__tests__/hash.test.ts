/**
 * SabSMS suppressions — unit tests for the phone-hash helpers.
 *
 * The repo standardises on `node:test`. Run with:
 *
 *   npx tsx --test src/app/sabsms/suppressions/__tests__/hash.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashPhone, isPhoneHash, normalizeSearchTerm } from "../lib";

describe("hashPhone", () => {
  it("returns a 64-char lowercase hex SHA-256 digest", () => {
    const h = hashPhone("+15550000001");
    assert.equal(typeof h, "string");
    assert.equal(h.length, 64);
    assert.match(h, /^[0-9a-f]{64}$/);
  });

  it("is deterministic — same input yields the same hash", () => {
    const a = hashPhone("+15550000001");
    const b = hashPhone("+15550000001");
    assert.equal(a, b);
  });

  it("normalises whitespace and case before hashing so equivalent E.164 inputs collide", () => {
    const canonical = hashPhone("+15550000001");
    const padded = hashPhone("  +15550000001  ");
    assert.equal(canonical, padded);
  });

  it("produces different digests for different phones", () => {
    const a = hashPhone("+15550000001");
    const b = hashPhone("+15550000002");
    assert.notEqual(a, b);
  });
});

describe("isPhoneHash", () => {
  it("accepts a 64-char lowercase hex string", () => {
    assert.equal(isPhoneHash(hashPhone("+15550000001")), true);
  });

  it("rejects E.164 phone numbers", () => {
    assert.equal(isPhoneHash("+15550000001"), false);
  });

  it("rejects short or non-hex strings", () => {
    assert.equal(isPhoneHash("deadbeef"), false);
    assert.equal(isPhoneHash("z".repeat(64)), false);
    assert.equal(isPhoneHash(""), false);
  });
});

describe("normalizeSearchTerm", () => {
  it("routes an E.164 input through the hasher", () => {
    const term = normalizeSearchTerm("+15550000001");
    assert.equal(term.kind, "hash");
    assert.equal(term.hash, hashPhone("+15550000001"));
  });

  it("passes a pre-hashed value through unchanged", () => {
    const h = hashPhone("+15550000001");
    const term = normalizeSearchTerm(h);
    assert.equal(term.kind, "hash");
    assert.equal(term.hash, h);
  });

  it("treats a non-phone, non-hash string as a free-text reason search", () => {
    const term = normalizeSearchTerm("complained-twice");
    assert.equal(term.kind, "text");
    assert.equal(term.text, "complained-twice");
  });
});
