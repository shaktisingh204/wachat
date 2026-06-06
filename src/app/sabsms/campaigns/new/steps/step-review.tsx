"use client";

import * as React from "react";

import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';

import type { CampaignDraft, ValidationIssue, WizardStepId } from "../types";

interface StepReviewProps {
  draft: CampaignDraft;
  templateName?: string;
  issues: ValidationIssue[];
  onJump: (step: WizardStepId) => void;
}

interface FeatureItem {
  step: WizardStepId;
  index: number;
  label: string;
  value: React.ReactNode;
}

function audienceLabel(draft: CampaignDraft): string {
  const a = draft.audience;
  if (!a) return "—";
  if (a.kind === "segment") return `Segment · ${a.segmentId || "(none)"}`;
  if (a.kind === "contacts") return `Contacts · ${a.contactIds.length}`;
  return `CSV · ${a.sabFileName ?? (a.sabFileId || "(none)")}`;
}

function scheduleLabel(draft: CampaignDraft): string {
  const s = draft.schedule;
  if (!s) return "—";
  if (s.kind === "immediate") return "Immediate";
  if (s.kind === "scheduled") return `Scheduled · ${s.sendAt || "(unset)"}`;
  if (s.kind === "recurring") return `Recurring · ${s.cron}`;
  return `Drip · ${s.dripId || "(none)"}`;
}

export function StepReview({
  draft,
  templateName,
  issues,
  onJump,
}: StepReviewProps) {
  // Re-list the 20 Page-7 features on the review screen, per the
  // explicit constraint in the task.
  const items: FeatureItem[] = [
    {
      step: "template",
      index: 1,
      label: "Template",
      value: templateName ?? draft.templateId ?? "—",
    },
    {
      step: "audience",
      index: 2,
      label: "Audience",
      value: audienceLabel(draft),
    },
    {
      step: "sender",
      index: 3,
      label: "Sender strategy",
      value: `${draft.senderStrategy} · ${(draft.senderNumberIds ?? []).length} number(s)`,
    },
    {
      step: "schedule",
      index: 4,
      label: "Schedule",
      value: scheduleLabel(draft),
    },
    {
      step: "throttle",
      index: 5,
      label: "Throttle",
      value: `${draft.throttlePerSecond ?? 10} msg/s${
        draft.perProviderCap ? ` · cap ${draft.perProviderCap}` : ""
      }`,
    },
    {
      step: "throttle",
      index: 6,
      label: "Quiet hours (per country)",
      value: draft.quietHours.length
        ? draft.quietHours
            .map((q) => `${q.country} ${q.start}-${q.end}`)
            .join(", ")
        : "Off",
    },
    {
      step: "throttle",
      index: 7,
      label: "Per-recipient TZ quiet hours",
      value: draft.perRecipientTzQuietHours ? "On" : "Off",
    },
    {
      step: "compliance",
      index: 8,
      label: "A/B split",
      value: draft.abSplit.enabled
        ? `${draft.abSplit.variants.length} variant(s) · ${draft.abSplit.winnerMetric} · ${draft.abSplit.sampleWindowHours}h window`
        : "Off",
    },
    {
      step: "compliance",
      index: 9,
      label: "Frequency cap",
      value: draft.frequencyCap.enabled
        ? `${draft.frequencyCap.maxPerPeriod} per ${draft.frequencyCap.period}`
        : "Off",
    },
    {
      step: "compliance",
      index: 10,
      label: "Smart suppression",
      value: draft.smartSuppression ? "On" : "Off",
    },
    {
      step: "compliance",
      index: 11,
      label: "Send-time optimization",
      value: draft.sendTimeOptimization ? "On" : "Off",
    },
    {
      step: "compliance",
      index: 12,
      label: "Variable map preview",
      value: "Preview rendered in step 6",
    },
    {
      step: "compliance",
      index: 13,
      label: "Cost estimate",
      value: `Currency: ${draft.costCurrency} (low/median/high in step 6)`,
    },
    {
      step: "compliance",
      index: 14,
      label: "Compliance attestation",
      value: draft.complianceAttested ? "Attested" : "Not attested",
    },
    {
      step: "review",
      index: 15,
      label: "Review screen with editable jumps",
      value: "You are here.",
    },
    {
      step: "review",
      index: 16,
      label: "Save / Launch / Schedule",
      value: "Footer buttons.",
    },
    {
      step: "review",
      index: 17,
      label: "Test send",
      value: draft.testRecipient ?? "Set in footer test-send form.",
    },
    {
      step: "review",
      index: 18,
      label: "Audit log on launch",
      value: "Writes to audit_logs collection.",
    },
    {
      step: "review",
      index: 19,
      label: "Auto-resume from ?draftId=",
      value: draft.id ? `Loaded draft ${draft.id}` : "New draft",
    },
    {
      step: "review",
      index: 20,
      label: "Keyboard step nav",
      value: "Cmd-← / Cmd-→",
    },
  ];

  return (
    <div className="space-y-5">
      {issues.length > 0 && (
        <Card className="border-[var(--st-border)] bg-[var(--st-bg-muted)]">
          <CardHeader>
            <CardTitle className="text-base text-[var(--st-text)]">
              {issues.length} issue{issues.length === 1 ? "" : "s"} blocking launch
            </CardTitle>
            <CardDescription className="text-[var(--st-text)]">
              Fix these before you can launch or schedule.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <ul className="space-y-1 text-sm text-[var(--st-text)]">
              {issues.map((i, idx) => (
                <li key={idx} className="flex items-center justify-between">
                  <span>
                    <code className="mr-2 text-xs">{i.step}</code>
                    {i.message}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onJump(i.step)}
                  >
                    Jump
                  </Button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Page-7 feature checklist
          </CardTitle>
          <CardDescription>
            All 20 features from <code>plans/sabsms-pages-catalog.md</code>{" "}
            §B.2 Page 7 — click any row to jump back to that step.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <ul className="divide-y divide-[var(--st-border)]">
            {items.map((it) => (
              <li
                key={it.index}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{it.index}</Badge>
                  <span className="font-medium text-[var(--st-text)]">
                    {it.label}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="max-w-xs truncate text-right text-xs text-[var(--st-text)]">
                    {it.value}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onJump(it.step)}
                  >
                    Edit
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
