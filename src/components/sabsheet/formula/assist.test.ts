/** Run: npx tsx --test src/components/sabsheet/formula/assist.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchFunctionPrefix, filterFunctions, activeCall, acceptCompletion } from "./assist.ts";

test("prefix: typing =SU at the end", () => {
  assert.deepEqual(matchFunctionPrefix("=SU", 3), { prefix: "SU", start: 1 });
});

test("prefix: nested after open paren and comma", () => {
  assert.deepEqual(matchFunctionPrefix("=IF(SU", 6), { prefix: "SU", start: 4 });
  assert.deepEqual(matchFunctionPrefix("=IF(A1>2,AVER", 13), { prefix: "AVER", start: 9 });
});

test("prefix: none for plain values or cell refs", () => {
  assert.equal(matchFunctionPrefix("hello", 5), null);
  assert.equal(matchFunctionPrefix("=A1", 3), null); // looks like a cell ref
  assert.equal(matchFunctionPrefix("=", 1), null);
});

test("prefix: dotted names match", () => {
  assert.deepEqual(matchFunctionPrefix("=PERCENTILE.I", 13), { prefix: "PERCENTILE.I", start: 1 });
});

test("filterFunctions prefers prefix matches and caps", () => {
  const names = ["SUM", "SUMIF", "SUMIFS", "SUBSTITUTE", "COUNT", "SEQUENCE", "ISUMMARY"];
  const r = filterFunctions(names, "SU", 4);
  assert.deepEqual(r.slice(0, 3), ["SUM", "SUMIF", "SUMIFS"]);
  assert.ok(r.length <= 4);
});

test("activeCall: simple and nested with arg index", () => {
  assert.deepEqual(activeCall("=SUM(1,2", 8), { name: "SUM", argIndex: 1 });
  assert.deepEqual(activeCall("=IF(SUM(A1:A3),", 13), { name: "SUM", argIndex: 0 }); // caret inside SUM
  assert.deepEqual(activeCall("=IF(SUM(A1:A3),", 15), { name: "IF", argIndex: 1 }); // after the comma
});

test("activeCall: ignores commas inside strings and closed calls", () => {
  assert.deepEqual(activeCall('=TEXTJOIN(",",TRUE,A1', 21), { name: "TEXTJOIN", argIndex: 2 });
  assert.equal(activeCall("=SUM(1,2)", 9), null); // call closed
});

test("acceptCompletion replaces the prefix with NAME(", () => {
  const r = acceptCompletion("=IF(SU", 6, 4, "SUMIF");
  assert.equal(r.draft, "=IF(SUMIF(");
  assert.equal(r.caret, 10);
});
