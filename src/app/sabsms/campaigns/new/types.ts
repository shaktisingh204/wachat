/**
 * Campaign wizard — client/server-shared draft shape.
 *
 * `CampaignDraft` mirrors `SabsmsCampaign` from
 * `src/lib/sabsms/types.ts` but with every field optional + a handful
 * of UX-only knobs (A/B variants, frequency cap, smart suppression,
 * STO toggle, currency, compliance attestation, quiet hours, …) that
 * the engine will start honouring in Phase 4 of
 * `plans/sabsms-world-class-plan.md`.
 *
 * Persisted in two places:
 *   - localStorage:  `sabsms:campaign-draft:<workspaceId>` (autosave)
 *   - Mongo:         `sabsms_campaigns` doc (status="draft")
 */

import type {
  SabsmsCampaignStatus,
  SabsmsMessageCategory,
} from "@/lib/sabsms/types";

export type WizardStepId =
  | "template"
  | "audience"
  | "sender"
  | "schedule"
  | "throttle"
  | "compliance"
  | "review";

export const WIZARD_STEPS: { id: WizardStepId; label: string; index: number }[] = [
  { id: "template", label: "Template", index: 1 },
  { id: "audience", label: "Audience", index: 2 },
  { id: "sender", label: "Sender", index: 3 },
  { id: "schedule", label: "Schedule", index: 4 },
  { id: "throttle", label: "Throttle", index: 5 },
  { id: "compliance", label: "Compliance", index: 6 },
  { id: "review", label: "Review", index: 7 },
];

export type SenderStrategy = "single" | "pool" | "sticky_per_recipient";

export type AudienceDraft =
  | { kind: "segment"; segmentId: string }
  | { kind: "contacts"; contactIds: string[] }
  | {
      kind: "csv";
      sabFileId: string;
      sabFileName?: string;
      /** Public R2 URL captured from the SabFile picker — the launch path
       *  fetches + parses it into concrete phone recipients. */
      sabFileUrl?: string;
    };

export type ScheduleDraft =
  | { kind: "immediate" }
  | { kind: "scheduled"; sendAt: string /* ISO */ }
  | { kind: "recurring"; cron: string }
  | { kind: "drip"; dripId: string };

export interface QuietHoursWindow {
  /** ISO 3166-1 alpha-2 — e.g. `IN`, `US`. */
  country: string;
  /** Inclusive 24h start, "22:00". */
  start: string;
  /** Inclusive 24h end, "08:00". */
  end: string;
}

export type ABWinnerMetric = "ctr" | "reply" | "conversion";

export interface ABVariant {
  id: string;
  label: string;
  body: string;
  weight: number;
}

export interface ABSplit {
  enabled: boolean;
  variants: ABVariant[];
  winnerMetric: ABWinnerMetric;
  /** Sample window in hours before declaring a winner. */
  sampleWindowHours: number;
}

export type FrequencyCapPeriod = "day" | "week" | "month";

export interface FrequencyCap {
  enabled: boolean;
  maxPerPeriod: number;
  period: FrequencyCapPeriod;
}

export interface CostEstimate {
  currency: string;
  low: number;
  median: number;
  high: number;
}

/**
 * Wizard-side mirror of `SabsmsCampaign`. Every field is optional
 * because the user fills it in step-by-step; the launch validator
 * (`validateDraftForLaunch`) is the source of truth for "what must be
 * present".
 */
export interface CampaignDraft {
  /** Mongo `_id` once the draft is first saved. */
  id?: string;
  workspaceId: string;
  name: string;
  templateId?: string;
  templateLocale?: string;
  audience?: AudienceDraft;
  schedule?: ScheduleDraft;
  senderStrategy: SenderStrategy;
  senderNumberIds?: string[];
  throttlePerSecond?: number;
  perProviderCap?: number;
  category: SabsmsMessageCategory;
  status: SabsmsCampaignStatus;

  // UX-only knobs — Phase 4 (per-recipient enqueue) will pick these up.
  quietHours: QuietHoursWindow[];
  perRecipientTzQuietHours: boolean;
  abSplit: ABSplit;
  frequencyCap: FrequencyCap;
  smartSuppression: boolean;
  sendTimeOptimization: boolean;
  /** Shorten URLs + attribute clicks per recipient (V2.4 link tracking). */
  linkTracking?: boolean;
  costCurrency: string;
  complianceAttested: boolean;
  /** Optional sandbox / single test recipient. */
  testRecipient?: string;

  createdAt?: string;
  updatedAt?: string;
}

export function makeEmptyDraft(workspaceId: string): CampaignDraft {
  return {
    workspaceId,
    name: "",
    senderStrategy: "single",
    category: "marketing",
    status: "draft",
    quietHours: [],
    perRecipientTzQuietHours: false,
    abSplit: {
      enabled: false,
      variants: [],
      winnerMetric: "ctr",
      sampleWindowHours: 4,
    },
    frequencyCap: {
      enabled: false,
      maxPerPeriod: 1,
      period: "day",
    },
    smartSuppression: false,
    sendTimeOptimization: false,
    linkTracking: true,
    costCurrency: "USD",
    complianceAttested: false,
  };
}

export interface ValidationIssue {
  step: WizardStepId;
  field: string;
  message: string;
}

/**
 * Returns a list of human-readable issues. An empty array means the
 * draft is launch-ready. Marketing campaigns must additionally pass
 * the compliance attestation.
 */
export function validateDraftForLaunch(draft: CampaignDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!draft.name || draft.name.trim().length < 2) {
    issues.push({
      step: "template",
      field: "name",
      message: "Campaign name is required (min 2 chars).",
    });
  }
  if (!draft.templateId) {
    issues.push({
      step: "template",
      field: "templateId",
      message: "Pick a template.",
    });
  }
  if (!draft.audience) {
    issues.push({
      step: "audience",
      field: "audience",
      message: "Pick an audience (segment, contacts, or CSV).",
    });
  } else if (draft.audience.kind === "contacts" && draft.audience.contactIds.length === 0) {
    issues.push({
      step: "audience",
      field: "audience.contactIds",
      message: "Pick at least one contact.",
    });
  } else if (draft.audience.kind === "segment" && !draft.audience.segmentId) {
    issues.push({
      step: "audience",
      field: "audience.segmentId",
      message: "Pick a segment.",
    });
  } else if (draft.audience.kind === "csv" && !draft.audience.sabFileId) {
    issues.push({
      step: "audience",
      field: "audience.sabFileId",
      message: "Upload a CSV via SabFiles.",
    });
  }
  if (!draft.schedule) {
    issues.push({
      step: "schedule",
      field: "schedule",
      message: "Pick a schedule.",
    });
  } else if (draft.schedule.kind === "scheduled" && !draft.schedule.sendAt) {
    issues.push({
      step: "schedule",
      field: "schedule.sendAt",
      message: "Pick a send-at datetime.",
    });
  } else if (draft.schedule.kind === "recurring" && !draft.schedule.cron) {
    issues.push({
      step: "schedule",
      field: "schedule.cron",
      message: "Provide a cron expression.",
    });
  } else if (draft.schedule.kind === "drip" && !draft.schedule.dripId) {
    issues.push({
      step: "schedule",
      field: "schedule.dripId",
      message: "Pick a drip.",
    });
  }
  if (draft.senderStrategy !== "single" && (!draft.senderNumberIds || draft.senderNumberIds.length === 0)) {
    issues.push({
      step: "sender",
      field: "senderNumberIds",
      message: "Pick at least one sender number for pool/sticky strategies.",
    });
  }
  if (draft.category === "marketing" && !draft.complianceAttested) {
    issues.push({
      step: "compliance",
      field: "complianceAttested",
      message:
        "Marketing campaigns require explicit compliance attestation (opt-in proof).",
    });
  }
  if (draft.abSplit.enabled) {
    if (draft.abSplit.variants.length < 1 || draft.abSplit.variants.length > 5) {
      issues.push({
        step: "compliance",
        field: "abSplit.variants",
        message: "A/B split requires 1-5 variants.",
      });
    }
  }

  return issues;
}
