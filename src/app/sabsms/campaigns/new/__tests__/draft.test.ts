/**
 * Draft validator — asserts the launch-time validator catches the
 * common "user hit Launch with a half-finished draft" cases.
 *
 * Run with the project's standard runner:
 *   npx tsx --test src/app/sabsms/campaigns/new/__tests__/draft.test.ts
 *
 * The test surface uses `node:test` describe/it (also Vitest-compatible
 * shape) — the project standardised on `tsx --test` and does not have
 * vitest installed.
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  makeEmptyDraft,
  validateDraftForLaunch,
  type CampaignDraft,
} from "../types";

describe("validateDraftForLaunch", () => {
  it("rejects an empty draft with a list of issues", () => {
    const empty = makeEmptyDraft("ws_test");
    const issues = validateDraftForLaunch(empty);
    assert.ok(issues.length > 0, "expected at least one issue");
    const fields = issues.map((i) => i.field);
    assert.ok(fields.includes("name"), "missing name should flag");
    assert.ok(fields.includes("templateId"), "missing templateId should flag");
    assert.ok(fields.includes("audience"), "missing audience should flag");
    assert.ok(fields.includes("schedule"), "missing schedule should flag");
  });

  it("flags marketing campaigns without compliance attestation", () => {
    const draft: CampaignDraft = {
      ...makeEmptyDraft("ws_test"),
      name: "May newsletter",
      templateId: "65fffffffffffffffffffffe",
      audience: { kind: "contacts", contactIds: ["c1", "c2"] },
      schedule: { kind: "immediate" },
      category: "marketing",
      complianceAttested: false,
    };
    const issues = validateDraftForLaunch(draft);
    assert.ok(
      issues.some((i) => i.field === "complianceAttested"),
      "marketing without attestation must flag",
    );
  });

  it("accepts a fully-populated transactional draft", () => {
    const draft: CampaignDraft = {
      ...makeEmptyDraft("ws_test"),
      name: "Order receipts",
      templateId: "65fffffffffffffffffffffe",
      audience: { kind: "contacts", contactIds: ["c1"] },
      schedule: { kind: "immediate" },
      category: "transactional",
    };
    const issues = validateDraftForLaunch(draft);
    assert.equal(issues.length, 0, JSON.stringify(issues));
  });

  it("requires sender numbers for pool / sticky strategies", () => {
    const draft: CampaignDraft = {
      ...makeEmptyDraft("ws_test"),
      name: "Pool test",
      templateId: "65fffffffffffffffffffffe",
      audience: { kind: "contacts", contactIds: ["c1"] },
      schedule: { kind: "immediate" },
      category: "transactional",
      senderStrategy: "pool",
      senderNumberIds: [],
    };
    const issues = validateDraftForLaunch(draft);
    assert.ok(
      issues.some((i) => i.field === "senderNumberIds"),
      "pool strategy without numbers must flag",
    );
  });
});
