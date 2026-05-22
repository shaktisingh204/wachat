/**
 * Predicate evaluator tests.
 *
 * Run with:
 *   npx tsx --test src/app/sabsms/segments/new/__tests__/evaluate.test.ts
 *
 * We cover the operators surface area described in the catalog
 * (`/sabsms/segments/new` features 1-2): nested AND/OR groups, every
 * operator, missing-field semantics, the SQL preview, and the consent
 * gate detector that the launch validator depends on.
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
  type SegmentContact,
  type SegmentGroup,
  type SegmentNode,
} from "../evaluate";

const aliceUS: SegmentContact = {
  _id: "c1",
  e164: "+14155551212",
  phone: "+14155551212",
  country: "US",
  locale: "en",
  total_replies: 4,
  unsubscribed: false,
  engagement_score: 78,
  tags: ["vip", "early-adopter"],
  source: "web",
  last_sms_clicked_at: "2026-04-12T10:00:00Z",
};

const bobIN: SegmentContact = {
  _id: "c2",
  e164: "+919876543210",
  country: "IN",
  locale: "hi",
  total_replies: 0,
  unsubscribed: true,
  engagement_score: 12,
  tags: ["lapsed"],
  source: "import",
};

describe("evaluatePredicate — leaves", () => {
  it("handles every operator on simple leaves", () => {
    // eq on string (case insensitive)
    assert.equal(
      evaluatePredicate(
        { kind: "leaf", field: "country", op: "eq", value: "us" },
        aliceUS,
      ),
      true,
    );
    // neq is true when value differs
    assert.equal(
      evaluatePredicate(
        { kind: "leaf", field: "country", op: "neq", value: "IN" },
        aliceUS,
      ),
      true,
    );
    // gt on a numeric field
    assert.equal(
      evaluatePredicate(
        { kind: "leaf", field: "engagement_score", op: "gt", value: 50 },
        aliceUS,
      ),
      true,
    );
    assert.equal(
      evaluatePredicate(
        { kind: "leaf", field: "engagement_score", op: "gt", value: 50 },
        bobIN,
      ),
      false,
    );
    // lt on a date
    assert.equal(
      evaluatePredicate(
        {
          kind: "leaf",
          field: "last_sms_clicked_at",
          op: "lt",
          value: "2026-05-01T00:00:00Z",
        },
        aliceUS,
      ),
      true,
    );
    // contains on phone via e164_prefix
    assert.equal(
      evaluatePredicate(
        { kind: "leaf", field: "e164_prefix", op: "contains", value: "+1415" },
        aliceUS,
      ),
      true,
    );
    // in (list of values)
    assert.equal(
      evaluatePredicate(
        { kind: "leaf", field: "locale", op: "in", value: ["en", "fr"] },
        aliceUS,
      ),
      true,
    );
    // in with string-split fallback
    assert.equal(
      evaluatePredicate(
        { kind: "leaf", field: "locale", op: "in", value: "hi, mr" },
        bobIN,
      ),
      true,
    );
  });

  it("handles missing fields safely", () => {
    // gt on a missing date returns false (no info to compare)
    assert.equal(
      evaluatePredicate(
        {
          kind: "leaf",
          field: "last_sms_clicked_at",
          op: "gt",
          value: "2020-01-01T00:00:00Z",
        },
        bobIN,
      ),
      false,
    );
    // neq on a missing field is true — "country != X" includes
    // contacts with no country recorded.
    assert.equal(
      evaluatePredicate(
        { kind: "leaf", field: "source", op: "neq", value: "facebook" },
        { _id: "ghost" } as SegmentContact,
      ),
      true,
    );
    // eq on a missing field is false
    assert.equal(
      evaluatePredicate(
        { kind: "leaf", field: "country", op: "eq", value: "US" },
        { _id: "ghost" } as SegmentContact,
      ),
      false,
    );
  });

  it("treats tag arrays as set membership", () => {
    // eq on a tag array means "tags contains X"
    assert.equal(
      evaluatePredicate(
        { kind: "leaf", field: "tag", op: "eq", value: "vip" },
        aliceUS,
      ),
      true,
    );
    assert.equal(
      evaluatePredicate(
        { kind: "leaf", field: "tag", op: "eq", value: "vip" },
        bobIN,
      ),
      false,
    );
    // contains substring match against any tag
    assert.equal(
      evaluatePredicate(
        { kind: "leaf", field: "tag", op: "contains", value: "early" },
        aliceUS,
      ),
      true,
    );
    // `in` matches if the contact's tag list overlaps with the
    // predicate list.
    assert.equal(
      evaluatePredicate(
        {
          kind: "leaf",
          field: "tag",
          op: "in",
          value: ["lapsed", "spam"],
        },
        bobIN,
      ),
      true,
    );
  });
});

describe("evaluatePredicate — nested groups", () => {
  it("AND requires every child", () => {
    const p: SegmentGroup = {
      kind: "group",
      op: "and",
      children: [
        { kind: "leaf", field: "country", op: "eq", value: "US" },
        { kind: "leaf", field: "unsubscribed", op: "eq", value: false },
      ],
    };
    assert.equal(evaluatePredicate(p, aliceUS), true);
    assert.equal(evaluatePredicate(p, bobIN), false);
  });

  it("OR requires any child", () => {
    const p: SegmentGroup = {
      kind: "group",
      op: "or",
      children: [
        { kind: "leaf", field: "country", op: "eq", value: "FR" },
        { kind: "leaf", field: "country", op: "eq", value: "IN" },
      ],
    };
    assert.equal(evaluatePredicate(p, aliceUS), false);
    assert.equal(evaluatePredicate(p, bobIN), true);
  });

  it("nests groups arbitrarily deep", () => {
    const p: SegmentGroup = {
      kind: "group",
      op: "and",
      children: [
        { kind: "leaf", field: "unsubscribed", op: "eq", value: false },
        {
          kind: "group",
          op: "or",
          children: [
            { kind: "leaf", field: "engagement_score", op: "gt", value: 60 },
            { kind: "leaf", field: "tag", op: "eq", value: "early-adopter" },
          ],
        },
      ],
    };
    assert.equal(evaluatePredicate(p, aliceUS), true);
    // Bob is unsubscribed, so the outer AND fails before the inner OR
    // gets a chance.
    assert.equal(evaluatePredicate(p, bobIN), false);
  });

  it("empty groups follow SQL semantics", () => {
    assert.equal(evaluatePredicate(emptyGroup("and"), aliceUS), true);
    assert.equal(evaluatePredicate(emptyGroup("or"), aliceUS), false);
    assert.equal(evaluatePredicate(null, aliceUS), true);
  });
});

describe("hasConsentGate", () => {
  it("recognises canonical consent gates", () => {
    assert.equal(
      hasConsentGate({
        kind: "leaf",
        field: "unsubscribed",
        op: "eq",
        value: false,
      }),
      true,
    );
    assert.equal(
      hasConsentGate({
        kind: "leaf",
        field: "unsubscribed",
        op: "neq",
        value: true,
      }),
      true,
    );
    assert.equal(
      hasConsentGate({
        kind: "leaf",
        field: "country",
        op: "eq",
        value: "US",
      }),
      false,
    );
  });

  it("propagates through AND groups but requires every branch of OR", () => {
    const and: SegmentNode = {
      kind: "group",
      op: "and",
      children: [
        { kind: "leaf", field: "country", op: "eq", value: "US" },
        { kind: "leaf", field: "unsubscribed", op: "eq", value: false },
      ],
    };
    assert.equal(hasConsentGate(and), true);

    const orMissing: SegmentNode = {
      kind: "group",
      op: "or",
      children: [
        { kind: "leaf", field: "unsubscribed", op: "eq", value: false },
        { kind: "leaf", field: "country", op: "eq", value: "US" },
      ],
    };
    assert.equal(hasConsentGate(orMissing), false);
  });
});

describe("predicateToSql", () => {
  it("renders a readable SQL-style preview", () => {
    const p: SegmentGroup = {
      kind: "group",
      op: "and",
      children: [
        { kind: "leaf", field: "country", op: "eq", value: "US" },
        {
          kind: "leaf",
          field: "engagement_score",
          op: "gt",
          value: 50,
        },
        {
          kind: "leaf",
          field: "tag",
          op: "in",
          value: ["vip", "loyal"],
        },
      ],
    };
    const sql = predicateToSql(p);
    assert.ok(sql.includes("Country = 'US'"));
    assert.ok(sql.includes("Engagement score > 50"));
    assert.ok(sql.includes("Tag IN ('vip', 'loyal')"));
    assert.ok(sql.startsWith("(") && sql.endsWith(")"));
  });
});

describe("helpers", () => {
  it("countLeaves counts every leaf node", () => {
    const p: SegmentGroup = {
      kind: "group",
      op: "and",
      children: [
        emptyLeaf("country"),
        {
          kind: "group",
          op: "or",
          children: [emptyLeaf("locale"), emptyLeaf("tag")],
        },
      ],
    };
    assert.equal(countLeaves(p), 3);
    assert.equal(countLeaves(null), 0);
  });
});
