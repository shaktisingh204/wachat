/**
 * Unit tests for the SabSMS lists pure helpers.
 *
 * The server-action surface (createList / addContactsToList / …) is
 * exercised by integration tests; here we cover the deterministic
 * helpers in `./helpers` that don't need a Mongo / session round-trip.
 *
 * Run with: npx tsx --test src/app/sabsms/lists/__tests__/lists.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeOverlap,
  normalisePhone,
  parsePhoneList,
} from "../helpers";

describe("normalisePhone", () => {
  it("preserves a valid E.164 number", () => {
    assert.equal(normalisePhone("+15550001111"), "+15550001111");
  });

  it("strips punctuation and adds a missing +", () => {
    assert.equal(normalisePhone("(1 555) 000-1111"), "+15550001111");
    assert.equal(normalisePhone("15550001111"), "+15550001111");
  });

  it("rejects too-short / too-long numbers", () => {
    assert.equal(normalisePhone("123"), null);
    assert.equal(normalisePhone("+12345678901234567890"), null);
  });

  it("treats empty input as null", () => {
    assert.equal(normalisePhone(""), null);
  });
});

describe("parsePhoneList", () => {
  it("splits on newlines, commas, semicolons and whitespace", () => {
    const r = parsePhoneList("+15550001111\n+15550002222,+15550003333; +15550004444");
    assert.equal(r.valid.length, 4);
    assert.deepEqual(r.valid, [
      "+15550001111",
      "+15550002222",
      "+15550003333",
      "+15550004444",
    ]);
    assert.deepEqual(r.invalid, []);
  });

  it("dedupes after normalisation", () => {
    const r = parsePhoneList("+15550001111\n15550001111\n+15550001111");
    assert.deepEqual(r.valid, ["+15550001111"]);
  });

  it("collects invalid tokens", () => {
    const r = parsePhoneList("+15550001111\nnot-a-phone\nabc");
    assert.deepEqual(r.valid, ["+15550001111"]);
    assert.deepEqual(r.invalid, ["not-a-phone", "abc"]);
  });

  it("returns empty arrays for empty input", () => {
    const r = parsePhoneList("");
    assert.deepEqual(r.valid, []);
    assert.deepEqual(r.invalid, []);
  });
});

describe("computeOverlap", () => {
  it("reports only-A, only-B, both for two simple sets", () => {
    const r = computeOverlap(
      ["+15550001111", "+15550002222"],
      ["+15550002222", "+15550003333"],
    );
    assert.deepEqual(r.both, ["+15550002222"]);
    assert.deepEqual(r.onlyA, ["+15550001111"]);
    assert.deepEqual(r.onlyB, ["+15550003333"]);
  });

  it("treats identical lists as 100% overlap", () => {
    const r = computeOverlap(["+1", "+2"], ["+1", "+2"]);
    assert.equal(r.both.length, 2);
    assert.equal(r.onlyA.length, 0);
    assert.equal(r.onlyB.length, 0);
  });

  it("returns empty buckets for empty inputs", () => {
    const r = computeOverlap([], []);
    assert.deepEqual(r, { onlyA: [], onlyB: [], both: [] });
  });

  it("does not double-count when input contains duplicates", () => {
    const r = computeOverlap(["+1", "+1", "+2"], ["+1"]);
    assert.equal(r.both.length, 1);
    assert.equal(r.onlyA.length, 1);
    assert.equal(r.onlyB.length, 0);
  });
});
