/**
 * Segment counter test for the SabSMS template editor.
 *
 * Mirrors `src/app/sabsms/send/composer.tsx`'s GSM-7 / UCS-2 math —
 * the editor's `preview.tsx` shares the same logic re-exported from
 * `../preview`.
 *
 * Note: The task spec mentions Vitest, but `package.json` does not
 * include vitest. The rest of the repo (e.g.
 * `src/lib/__tests__/qr-utils.test.ts`) standardises on Node's built-in
 * `node:test` runner, so this test uses the same to stay green under
 * the project's existing test command.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { segmentCount } from "../preview";

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
