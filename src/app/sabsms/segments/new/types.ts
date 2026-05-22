/**
 * Segment-builder shared types + validators.
 *
 * Lives outside of `actions.ts` so the unit tests can `import` it
 * without pulling `server-only` (and therefore Mongo) into the test
 * runtime. Mirrors the split used by `campaigns/new/types.ts`.
 */

import type { SabsmsMessageCategory } from "@/lib/sabsms/types";

import { hasConsentGate, type SegmentNode } from "./evaluate";

export interface SegmentBuilderDraft {
  id?: string;
  name: string;
  description?: string;
  predicate: SegmentNode | null;
  category: SabsmsMessageCategory;
  kind: "static" | "dynamic";
  autoRefreshSeconds?: number;
  tags?: string[];
  attestation: boolean;
}

export interface DraftIssue {
  field: string;
  message: string;
}

/**
 * Asserts a draft is safe to persist. Marketing segments must include
 * a consent gate (a leaf like `unsubscribed eq false`) and the explicit
 * attestation checkbox before save.
 */
export function validateDraftForSave(draft: SegmentBuilderDraft): DraftIssue[] {
  const issues: DraftIssue[] = [];
  if (!draft.name.trim()) {
    issues.push({ field: "name", message: "Name is required." });
  }
  if (!draft.predicate) {
    issues.push({
      field: "predicate",
      message: "Predicate cannot be empty.",
    });
  }
  if (draft.category === "marketing" && !hasConsentGate(draft.predicate)) {
    issues.push({
      field: "predicate",
      message:
        "Marketing segments must include a consent gate (e.g. unsubscribed = false).",
    });
  }
  if (draft.category === "marketing" && !draft.attestation) {
    issues.push({
      field: "attestation",
      message:
        "Confirm the consent attestation before saving a marketing segment.",
    });
  }
  return issues;
}
