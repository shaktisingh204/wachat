/**
 * Unit tests for the SabSMS imports parser + mapping inference.
 *
 * Run with: npx tsx --test src/app/sabsms/imports/__tests__/parse.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findDuplicatePhones,
  inferColumnMapping,
  normalisePhone,
  parseCsv,
} from "../parse";

describe("parseCsv", () => {
  it("parses a simple header + row pair", () => {
    const r = parseCsv("phone,name\n+15550001111,Alice");
    assert.deepEqual(r.headers, ["phone", "name"]);
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0].phone, "+15550001111");
    assert.equal(r.rows[0].name, "Alice");
    assert.deepEqual(r.errors, []);
  });

  it("handles quoted fields with embedded commas", () => {
    const r = parseCsv('phone,name\n+15550001111,"Doe, Jane"');
    assert.equal(r.rows[0].name, "Doe, Jane");
    assert.deepEqual(r.errors, []);
  });

  it("handles escaped quotes inside a quoted field", () => {
    const r = parseCsv('phone,note\n+15550001111,"He said ""hi"""');
    assert.equal(r.rows[0].note, 'He said "hi"');
    assert.deepEqual(r.errors, []);
  });

  it("handles embedded newlines inside a quoted field", () => {
    const r = parseCsv('phone,note\n+15550001111,"line1\nline2"');
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0].note, "line1\nline2");
  });

  it("strips a UTF-8 BOM and normalises CRLF line endings", () => {
    const text = "﻿phone,name\r\n+15550001111,Bob\r\n";
    const r = parseCsv(text);
    assert.deepEqual(r.headers, ["phone", "name"]);
    assert.equal(r.rows[0].name, "Bob");
  });

  it("flags mismatched column counts but still emits the row", () => {
    const r = parseCsv("phone,name\n+15550001111");
    assert.equal(r.rows.length, 1);
    assert.equal(r.errors.length, 1);
    assert.match(r.errors[0].message, /Expected 2 columns/);
  });

  it("skips blank lines", () => {
    const r = parseCsv("phone,name\n\n+15550001111,Alice\n\n");
    assert.equal(r.rows.length, 1);
  });
});

describe("inferColumnMapping", () => {
  it("picks the obvious phone / name / email / tags columns", () => {
    const m = inferColumnMapping(["Phone", "First Name", "Email", "Tags"]);
    assert.equal(m.phone, "Phone");
    assert.equal(m.name, "First Name");
    assert.equal(m.email, "Email");
    assert.equal(m.tags, "Tags");
  });

  it("falls back to substring matching for less-conventional headers", () => {
    const m = inferColumnMapping(["msisdn_e164", "customer_full_name", "Labels"]);
    assert.equal(m.phone, "msisdn_e164");
    assert.equal(m.name, "customer_full_name");
    assert.equal(m.tags, "Labels");
    assert.equal(m.email, undefined);
  });

  it("returns undefined fields when no candidate header is present", () => {
    const m = inferColumnMapping(["id", "country", "city"]);
    assert.equal(m.phone, undefined);
    assert.equal(m.name, undefined);
    assert.equal(m.email, undefined);
    assert.equal(m.tags, undefined);
  });
});

describe("normalisePhone", () => {
  it("preserves a valid E.164 number", () => {
    assert.equal(normalisePhone("+15550001111"), "+15550001111");
  });

  it("inserts a missing + when the number is already 10-15 digits", () => {
    assert.equal(normalisePhone("15550001111"), "+15550001111");
  });

  it("strips spaces and punctuation", () => {
    assert.equal(normalisePhone("+1 (555) 000-1111"), "+15550001111");
  });

  it("returns null for short / invalid numbers", () => {
    assert.equal(normalisePhone("123"), null);
    assert.equal(normalisePhone(""), null);
    assert.equal(normalisePhone("abc"), null);
  });
});

describe("findDuplicatePhones", () => {
  it("reports phones that appear more than once after normalisation", () => {
    const rows = [
      { phone: "+15550001111" },
      { phone: "15550001111" },
      { phone: "+15550002222" },
    ];
    const dupes = findDuplicatePhones(rows, "phone");
    assert.deepEqual(dupes, ["+15550001111"]);
  });

  it("ignores rows whose phone fails normalisation", () => {
    const rows = [{ phone: "abc" }, { phone: "+15550003333" }];
    const dupes = findDuplicatePhones(rows, "phone");
    assert.deepEqual(dupes, []);
  });
});
