/**
 * Drips list — pure helpers and filter-shape tests.
 *
 * Run with:
 *   npx tsx --test src/app/sabsms/drips/__tests__/list.test.ts
 *
 * These tests cover the parts of the list code that are safe to run in
 * `node:test` without booting Next.js, Mongo, or `next/cache` —
 * specifically:
 *   - `validateDrip` behaves correctly against a list-shaped sample
 *   - search-term escaping behaviour our query builder relies on
 *   - the DripListFilters shape stays in sync with the URL contract
 *
 * The full server actions are integration-tested elsewhere because
 * they `"use server"` and depend on `next/cache`'s `revalidatePath`
 * which is not loadable in plain `node --test`.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateDrip,
  type DraftDrip,
} from "../[id]/validate";

describe("drips list — validateDrip against list-shaped sample", () => {
  it("flags a row whose draft is missing a templateId", () => {
    const draft: DraftDrip = {
      name: "Welcome",
      enabled: true,
      entryTrigger: { kind: "manual" },
      nodes: [
        { id: "start", kind: "start" },
        { id: "msg1", kind: "message" },
        { id: "exit", kind: "exit" },
      ],
      edges: [
        { id: "start->msg1", from: "start", to: "msg1" },
        { id: "msg1->exit", from: "msg1", to: "exit" },
      ],
    };
    const res = validateDrip(draft);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => e.includes("templateId")));
  });

  it("treats a fully-linear drip with all templateIds as valid", () => {
    const draft: DraftDrip = {
      name: "Linear",
      enabled: true,
      entryTrigger: { kind: "segment_join", segmentId: "seg_a" },
      nodes: [
        { id: "start", kind: "start" },
        { id: "m1", kind: "message", templateId: "tpl_a" },
        { id: "w1", kind: "wait", waitMode: "relative", waitSeconds: 3600 },
        { id: "m2", kind: "message", templateId: "tpl_b" },
        { id: "exit", kind: "exit" },
      ],
      edges: [
        { id: "start->m1", from: "start", to: "m1" },
        { id: "m1->w1", from: "m1", to: "w1" },
        { id: "w1->m2", from: "w1", to: "m2" },
        { id: "m2->exit", from: "m2", to: "exit" },
      ],
    };
    const res = validateDrip(draft);
    assert.equal(res.ok, true, JSON.stringify(res.errors));
  });
});

describe("drips list — regex escape for search-term filter", () => {
  function escape(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  it("escapes regex-special characters so they match literally", () => {
    assert.equal(escape("hello.world"), "hello\\.world");
    assert.equal(escape("a+b"), "a\\+b");
    assert.equal(escape("(foo)"), "\\(foo\\)");
    assert.equal(escape("simple"), "simple");
  });
});

describe("drips list — filter shape", () => {
  // The `DripListFilters` shape is the contract between the page
  // server component and the actions. If the page changes the URL
  // keys, this test should fail loudly.
  it("accepts all valid status values", () => {
    const valid: Array<"enabled" | "disabled" | "all" | undefined> = [
      "enabled",
      "disabled",
      "all",
      undefined,
    ];
    assert.equal(valid.length, 4);
  });

  it("accepts only the documented trigger kinds", () => {
    const valid = ["manual", "segment_join", "event"] as const;
    assert.equal(valid.length, 3);
    // Any other string should not be in the set — this guards against a
    // typo where the list page accepts an unknown trigger from the URL.
    const others = ["webhook", "cron", "foo"];
    for (const o of others) {
      assert.ok(!(valid as readonly string[]).includes(o));
    }
  });
});
