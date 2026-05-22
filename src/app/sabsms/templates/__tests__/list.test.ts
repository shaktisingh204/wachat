/**
 * SabSMS templates list — unit tests for the pure projection helper.
 *
 * Run with:
 *   npx tsx --test src/app/sabsms/templates/__tests__/list.test.ts
 *
 * We deliberately do not exercise the DB-backed `loadTemplates` here
 * because the project standardises on `node:test` and avoids spinning up
 * Mongo from tests. The projection is the pure boundary between the
 * Mongo document and the table view-model, so testing it locks down the
 * shape the client renders.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SabsmsTemplateBody } from "@/lib/sabsms/types";

import { projectTemplate, type TemplateDocExt } from "../projection";

function baseDoc(overrides: Partial<TemplateDocExt> = {}): TemplateDocExt {
  const bodies: SabsmsTemplateBody[] = [
    { locale: "en", body: "Hello {{ name }}! Welcome to SabSMS." },
  ];
  return {
    workspaceId: "ws-1",
    name: "Welcome",
    category: "transactional",
    bodies,
    variables: ["name"],
    status: "draft",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  } as TemplateDocExt;
}

describe("projectTemplate", () => {
  it("collapses the first body to a 240-char preview", () => {
    const body =
      "This is a very long body. ".repeat(20) + "STOP to opt out.";
    const row = projectTemplate(
      baseDoc({ bodies: [{ locale: "en", body }] }),
    );
    assert.equal(row.bodyPreview.length, 240);
    assert.ok(row.bodyPreview.startsWith("This is a very long body."));
  });

  it("flags DLT registration only when both PEID and templateId are set", () => {
    const partial = projectTemplate(
      baseDoc({ dlt: { principalEntityId: "PE-123" } }),
    );
    assert.equal(partial.dltRegistered, false);

    const full = projectTemplate(
      baseDoc({
        dlt: { principalEntityId: "PE-123", templateId: "T-9" },
      }),
    );
    assert.equal(full.dltRegistered, true);
  });

  it("flags 10DLC registration only when both brandId and campaignId are set", () => {
    const partial = projectTemplate(
      baseDoc({ tendlc: { brandId: "B-1" } }),
    );
    assert.equal(partial.tendlcRegistered, false);

    const full = projectTemplate(
      baseDoc({ tendlc: { brandId: "B-1", campaignId: "C-1" } }),
    );
    assert.equal(full.tendlcRegistered, true);
  });

  it("surfaces tags + deprecated + usage from the extended doc", () => {
    const row = projectTemplate(
      baseDoc({
        tags: ["onboarding", "india"],
        deprecated: true,
        usageCount: 12_345,
      }),
    );
    assert.deepEqual(row.tags, ["onboarding", "india"]);
    assert.equal(row.deprecated, true);
    assert.equal(row.usageCount, 12_345);
  });

  it("falls back to defaults when the extension fields are missing", () => {
    const row = projectTemplate(baseDoc());
    assert.deepEqual(row.tags, []);
    assert.equal(row.deprecated, false);
    assert.equal(row.usageCount, 0);
    assert.equal(row.submittedAt, null);
  });

  it("emits ISO date strings the table can render", () => {
    const row = projectTemplate(
      baseDoc({
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-15T12:34:56.000Z"),
      }),
    );
    assert.equal(row.createdAt, "2026-01-01T00:00:00.000Z");
    assert.equal(row.updatedAt, "2026-01-15T12:34:56.000Z");
  });

  it("captures every locale across bodies", () => {
    const row = projectTemplate(
      baseDoc({
        bodies: [
          { locale: "en", body: "Hi" },
          { locale: "hi", body: "नमस्ते" },
          { locale: "es", body: "Hola" },
        ],
      }),
    );
    assert.deepEqual(row.locales, ["en", "hi", "es"]);
  });
});
