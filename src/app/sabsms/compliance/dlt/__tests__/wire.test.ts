/**
 * Cross-language corpus anti-drift test (the TS half).
 *
 *   NODE_PATH=src/workers/_stubs npx tsx --test \
 *     src/app/sabsms/compliance/dlt/__tests__/wire.test.ts
 *
 * `services/sabsms-engine/tests/dlt_corpus.rs` reads the SAME fixture
 * (`services/sabsms-engine/tests/fixtures/dlt-corpus.json`) to exercise
 * the Rust DLT content matcher. Its doc comment promised a Next.js test
 * reading that fixture so the TS registry schemas and the Rust matcher
 * "can never silently diverge" — but no such test existed, leaving the
 * advertised contract one-sided.
 *
 * This file makes the contract two-sided WITHOUT over-claiming: the TS
 * side does not re-implement the matcher, so we assert the corpus's
 * case-SHAPE invariants (every case has the camelCase fields the Rust
 * harness deserializes, `expect` is the closed pass/fail enum, and
 * `failCheck` only appears on failing cases). If the fixture shape drifts
 * — a renamed field, a new `expect` value, a `failCheck` on a passing
 * case — both this test and the Rust harness break together.
 */

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

interface CorpusCase {
  name: string;
  registeredBody: string;
  messageBody: string;
  expect: "pass" | "fail";
  failCheck?: string;
}

function loadCorpus(): CorpusCase[] {
  const fixturePath = join(
    process.cwd(),
    "services/sabsms-engine/tests/fixtures/dlt-corpus.json",
  );
  const raw = JSON.parse(readFileSync(fixturePath, "utf8"));
  assert.ok(Array.isArray(raw), "corpus must be a JSON array");
  return raw as CorpusCase[];
}

test("corpus is a non-empty array of cases", () => {
  const corpus = loadCorpus();
  assert.ok(corpus.length > 0, "corpus must have at least one case");
});

test("every case carries the camelCase fields the Rust harness reads", () => {
  for (const c of loadCorpus()) {
    assert.equal(typeof c.name, "string", `case missing name: ${JSON.stringify(c)}`);
    assert.ok(c.name.length > 0, `empty name: ${JSON.stringify(c)}`);
    assert.equal(
      typeof c.registeredBody,
      "string",
      `case ${c.name}: registeredBody must be a string`,
    );
    assert.equal(
      typeof c.messageBody,
      "string",
      `case ${c.name}: messageBody must be a string`,
    );
  }
});

test("expect is the closed pass/fail enum", () => {
  for (const c of loadCorpus()) {
    assert.ok(
      c.expect === "pass" || c.expect === "fail",
      `case ${c.name}: unexpected expect value ${JSON.stringify(c.expect)}`,
    );
  }
});

test("failCheck appears only on failing cases", () => {
  for (const c of loadCorpus()) {
    if (c.expect === "pass") {
      assert.equal(
        c.failCheck,
        undefined,
        `passing case ${c.name} must not carry a failCheck`,
      );
    } else {
      // failing cases may name the check they trip; if present it's a string.
      if (c.failCheck !== undefined) {
        assert.equal(
          typeof c.failCheck,
          "string",
          `case ${c.name}: failCheck must be a string when present`,
        );
      }
    }
  }
});

test("case names are unique (no accidental duplicates on merge)", () => {
  const names = loadCorpus().map((c) => c.name);
  assert.equal(new Set(names).size, names.length, "duplicate case name in corpus");
});
