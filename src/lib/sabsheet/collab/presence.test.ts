/** Run: npx tsx --test src/lib/sabsheet/collab/presence.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { colorForUser } from "./presence.ts";

test("colorForUser is deterministic", () => {
  assert.equal(colorForUser("user-abc"), colorForUser("user-abc"));
});

test("colorForUser returns a palette hex", () => {
  assert.match(colorForUser("xyz"), /^#[0-9a-f]{6}$/);
});

test("different users tend to differ", () => {
  const colors = new Set(["a", "b", "c", "d", "e", "f"].map(colorForUser));
  assert.ok(colors.size >= 4); // not all collide
});
