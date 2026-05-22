/**
 * Segments list — pure-logic tests.
 *
 * The list page action `listSegments` does the bulk of its work in
 * Mongo; we cover the serialisation and filtering bits that DON'T need
 * a database here. The Mongo-dependent paths are covered by the
 * integration suite (out of scope for this file).
 *
 * Run:
 *   npx tsx --test src/app/sabsms/segments/__tests__/list.test.ts
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  countLeaves,
  emptyGroup,
  emptyLeaf,
  evaluatePredicate,
  hasConsentGate,
  predicateToSql,
  type SegmentNode,
} from "../new/evaluate";
import { validateDraftForSave } from "../new/types";

describe("segments list — predicate helpers used by the list page", () => {
  it("counts leaves in deeply nested predicates (preview chip)", () => {
    const p: SegmentNode = {
      kind: "group",
      op: "and",
      children: [
        emptyLeaf("country"),
        {
          kind: "group",
          op: "or",
          children: [emptyLeaf("locale"), emptyLeaf("tag"), emptyLeaf("source")],
        },
      ],
    };
    assert.equal(countLeaves(p), 4);
  });

  it("renders a SQL preview the list page can search against", () => {
    const sql = predicateToSql({
      kind: "leaf",
      field: "country",
      op: "eq",
      value: "US",
    });
    assert.ok(sql.includes("Country"));
    assert.ok(sql.includes("US"));
  });

  it("evaluates a sample contact through a nested predicate", () => {
    const p: SegmentNode = {
      kind: "group",
      op: "and",
      children: [
        { kind: "leaf", field: "country", op: "eq", value: "US" },
        { kind: "leaf", field: "unsubscribed", op: "eq", value: false },
      ],
    };
    const ok = evaluatePredicate(p, {
      country: "US",
      unsubscribed: false,
    });
    const bad = evaluatePredicate(p, {
      country: "US",
      unsubscribed: true,
    });
    assert.equal(ok, true);
    assert.equal(bad, false);
  });
});

describe("validateDraftForSave (used by the list -> builder flow)", () => {
  it("blocks marketing segments without a consent gate", () => {
    const issues = validateDraftForSave({
      name: "May promo",
      predicate: {
        kind: "leaf",
        field: "country",
        op: "eq",
        value: "US",
      },
      category: "marketing",
      kind: "dynamic",
      attestation: true,
    });
    assert.ok(
      issues.some((i) => i.field === "predicate"),
      "marketing without consent gate must flag",
    );
  });

  it("blocks marketing segments without the attestation checkbox", () => {
    const issues = validateDraftForSave({
      name: "May promo",
      predicate: {
        kind: "leaf",
        field: "unsubscribed",
        op: "eq",
        value: false,
      },
      category: "marketing",
      kind: "dynamic",
      attestation: false,
    });
    assert.ok(
      issues.some((i) => i.field === "attestation"),
      "marketing without attestation must flag",
    );
  });

  it("accepts a transactional segment without consent gates", () => {
    const issues = validateDraftForSave({
      name: "Receipt recipients",
      predicate: { kind: "leaf", field: "country", op: "eq", value: "US" },
      category: "transactional",
      kind: "dynamic",
      attestation: false,
    });
    assert.equal(issues.length, 0, JSON.stringify(issues));
  });

  it("rejects an empty predicate regardless of category", () => {
    const issues = validateDraftForSave({
      name: "Nothing",
      predicate: null,
      category: "transactional",
      kind: "dynamic",
      attestation: false,
    });
    assert.ok(
      issues.some((i) => i.field === "predicate"),
      "empty predicate must flag",
    );
  });

  it("requires a name", () => {
    const issues = validateDraftForSave({
      name: "   ",
      predicate: emptyGroup("and"),
      category: "transactional",
      kind: "dynamic",
      attestation: false,
    });
    assert.ok(issues.some((i) => i.field === "name"));
  });

  it("reads consent gate via hasConsentGate convenience helper", () => {
    assert.equal(
      hasConsentGate({
        kind: "leaf",
        field: "unsubscribed",
        op: "eq",
        value: false,
      }),
      true,
    );
  });
});
