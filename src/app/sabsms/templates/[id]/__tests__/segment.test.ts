/**
 * Segment counter test for the SabSMS template editor.
 *
 * The editor's `preview.tsx` derives its char counter / segment split
 * from the shared parity module `@/lib/sabsms/segments` (`segmentInfo`),
 * pinned to the Rust engine by the segment-vectors fixture. We import
 * that PURE function here directly — importing the `../preview` client
 * component pulls 20ui CSS, which `tsx --test` cannot parse.
 *
 * The tiny `segmentCount` wrapper below reproduces `preview.tsx`'s exact
 * UI conventions on top of the pure counter: an empty body shows 0
 * segments (you can't send one from the editor, even though the engine
 * bills an empty body as 1), and the human-facing "GSM-7"/"UCS-2"
 * encoding labels.
 *
 * Run: NODE_PATH=src/workers/_stubs npx tsx --test \
 *   src/app/sabsms/templates/[id]/__tests__/segment.test.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { segmentInfo } from "../../../../../lib/sabsms/segments";

/** Mirror of `preview.tsx`'s `segmentCount` (pure logic only). */
function segmentCount(body: string): {
  segments: number;
  encoding: "GSM-7" | "UCS-2";
} {
  if (!body) return { segments: 0, encoding: "GSM-7" };
  const info = segmentInfo(body);
  return {
    segments: info.segments,
    encoding: info.encoding === "gsm7" ? "GSM-7" : "UCS-2",
  };
}

test("segmentCount empty body returns zero segments / GSM-7", () => {
  const r = segmentCount("");
  assert.equal(r.segments, 0);
  assert.equal(r.encoding, "GSM-7");
});

test("segmentCount single GSM-7 segment under 160 chars", () => {
  const r = segmentCount("Hello world");
  assert.equal(r.segments, 1);
  assert.equal(r.encoding, "GSM-7");
});

test("segmentCount GSM-7 splits at 161 chars into 2 segments of 153", () => {
  const body = "a".repeat(161);
  const r = segmentCount(body);
  assert.equal(r.segments, 2);
  assert.equal(r.encoding, "GSM-7");
});

test("segmentCount GSM-7 boundary at 160 chars stays 1 segment", () => {
  const body = "a".repeat(160);
  const r = segmentCount(body);
  assert.equal(r.segments, 1);
});

test("segmentCount switches to UCS-2 on emoji / non-GSM chars", () => {
  const r = segmentCount("Hello 🎉");
  assert.equal(r.encoding, "UCS-2");
  assert.equal(r.segments, 1);
});

test("segmentCount UCS-2 splits at 71 chars into 2 segments of 67", () => {
  // 🎉 forces UCS-2; surround with 70 ASCII chars to push past the
  // 70-char single-segment ceiling for UCS-2.
  const body = "🎉" + "a".repeat(70);
  const r = segmentCount(body);
  assert.equal(r.encoding, "UCS-2");
  assert.equal(r.segments, 2);
});

test("segmentCount UCS-2 boundary at 70 chars stays 1 segment", () => {
  const body = "🎉" + "a".repeat(69);
  const r = segmentCount(body);
  assert.equal(r.encoding, "UCS-2");
  assert.equal(r.segments, 1);
});
