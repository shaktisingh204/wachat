"use client";

/**
 * Journey builder — one step card (V2.9).
 *
 * Renders the per-kind config UI for a step in the vertical builder:
 * send (template picker + optional A/B arms), wait (duration), waitUntil
 * (event + timeout + jump targets), branch (vars condition + true/false
 * targets), exit. Pure controlled component — all state lives in the
 * builder.
 */

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  FlaskConical,
  GitBranch,
  Hourglass,
  LogOut,
  Plus,
  Send,
  Trash2,
  Trophy,
  X,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  Label,
  SelectField,
  type SelectOption,
} from "@/components/sabcrm/20ui";
import type { JourneyAbWinner, JourneyStep } from "@/lib/sabsms/journeys/types";

import type { TemplateOption } from "./actions";

export const STEP_KIND_META: Record<
  JourneyStep["kind"],
  { label: string; icon: React.ReactNode; blurb: string }
> = {
  send: { label: "Send SMS", icon: <Send className="h-4 w-4" />, blurb: "Send a template" },
  wait: { label: "Wait", icon: <Clock className="h-4 w-4" />, blurb: "Pause for a duration" },
  waitUntil: {
    label: "Wait for event",
    icon: <Hourglass className="h-4 w-4" />,
    blurb: "Branch on reply/click vs timeout",
  },
  branch: {
    label: "Branch",
    icon: <GitBranch className="h-4 w-4" />,
    blurb: "If/else on a contact variable",
  },
  exit: { label: "Exit", icon: <LogOut className="h-4 w-4" />, blurb: "Leave the journey" },
};

const DURATION_UNITS: SelectOption[] = [
  { value: "minutes", label: "minutes" },
  { value: "hours", label: "hours" },
  { value: "days", label: "days" },
];

const UNIT_MS: Record<string, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

function msToParts(ms: number): { value: number; unit: string } {
  if (ms > 0 && ms % UNIT_MS.days === 0) return { value: ms / UNIT_MS.days, unit: "days" };
  if (ms > 0 && ms % UNIT_MS.hours === 0) return { value: ms / UNIT_MS.hours, unit: "hours" };
  return { value: Math.max(Math.round(ms / UNIT_MS.minutes), 0), unit: "minutes" };
}

function DurationInput({
  ms,
  onChange,
  idPrefix,
}: {
  ms: number;
  onChange: (ms: number) => void;
  idPrefix: string;
}) {
  const parts = msToParts(ms);
  return (
    <div className="flex items-center gap-2">
      <Input
        id={`${idPrefix}-value`}
        type="number"
        min={1}
        className="w-24"
        value={String(parts.value)}
        onChange={(e) => {
          const v = Math.max(Number(e.target.value) || 0, 0);
          onChange(v * UNIT_MS[parts.unit]);
        }}
        aria-label="Duration value"
      />
      <SelectField
        value={parts.unit}
        options={DURATION_UNITS}
        onChange={(unit) => {
          if (!unit) return;
          onChange(parts.value * UNIT_MS[unit]);
        }}
        aria-label="Duration unit"
      />
    </div>
  );
}

export interface StepNodeProps {
  step: JourneyStep;
  index: number;
  total: number;
  steps: JourneyStep[];
  templates: TemplateOption[];
  winner?: JourneyAbWinner;
  onChange: (step: JourneyStep) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}

export function StepNode({
  step,
  index,
  total,
  steps,
  templates,
  winner,
  onChange,
  onRemove,
  onMove,
}: StepNodeProps) {
  const meta = STEP_KIND_META[step.kind];
  const templateOptions: SelectOption[] = templates.map((t) => ({
    value: t.value,
    label: t.label,
  }));
  const targetOptions: SelectOption[] = steps
    .filter((s) => s.id !== step.id)
    .map((s) => ({
      value: s.id,
      label: `${steps.indexOf(s) + 1}. ${STEP_KIND_META[s.kind].label}`,
    }));

  return (
    <Card className="border-[var(--st-border)] shadow-sm">
      <CardBody className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--st-border)] bg-[var(--st-bg-muted)] text-xs font-semibold text-[var(--st-text)]">
              {index + 1}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--st-text)]">
              {meta.icon}
              {meta.label}
            </span>
            {winner && (
              <Badge className="text-[10px]">
                <Trophy className="mr-1 h-3 w-3" />
                Winner promoted
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMove(-1)}
              disabled={index === 0}
              aria-label="Move step up"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMove(1)}
              disabled={index === total - 1}
              aria-label="Move step down"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onRemove} aria-label="Remove step">
              <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger,#b91c1c)]" />
            </Button>
          </div>
        </div>

        {step.kind === "send" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Template</Label>
              <SelectField
                value={step.templateId || null}
                options={templateOptions}
                searchable
                placeholder={templates.length === 0 ? "No templates yet" : "Pick a template"}
                onChange={(v) => onChange({ ...step, templateId: v ?? "" })}
              />
              {step.templateId && (
                <p className="line-clamp-2 text-xs text-[var(--st-text-secondary)]">
                  {templates.find((t) => t.value === step.templateId)?.body}
                </p>
              )}
            </div>

            {winner ? (
              <p className="text-xs text-[var(--st-text-secondary)]">
                {winner.note} — the step now always sends the winning template.
              </p>
            ) : step.abVariants ? (
              <div className="space-y-2 rounded-md border border-dashed border-[var(--st-border)] p-2.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--st-text)]">
                    <FlaskConical className="h-3.5 w-3.5" /> A/B variants (deterministic split)
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const { abVariants: _drop, ...rest } = step;
                      onChange(rest);
                    }}
                  >
                    <X className="mr-1 h-3 w-3" /> Remove test
                  </Button>
                </div>
                {step.abVariants.map((v, vi) => (
                  <div key={vi} className="flex items-center gap-2">
                    <SelectField
                      value={v.templateId || null}
                      options={templateOptions}
                      searchable
                      placeholder={`Variant ${vi + 1} template`}
                      onChange={(val) => {
                        const abVariants = step.abVariants!.map((x, xi) =>
                          xi === vi ? { ...x, templateId: val ?? "" } : x,
                        );
                        onChange({ ...step, abVariants });
                      }}
                    />
                    <Input
                      type="number"
                      min={1}
                      className="w-20"
                      value={String(v.weight)}
                      aria-label={`Variant ${vi + 1} weight`}
                      onChange={(e) => {
                        const abVariants = step.abVariants!.map((x, xi) =>
                          xi === vi
                            ? { ...x, weight: Math.max(Number(e.target.value) || 0, 0) }
                            : x,
                        );
                        onChange({ ...step, abVariants });
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove variant ${vi + 1}`}
                      onClick={() => {
                        const abVariants = step.abVariants!.filter((_, xi) => xi !== vi);
                        if (abVariants.length > 0) {
                          onChange({ ...step, abVariants });
                        } else {
                          const { abVariants: _d, ...rest } = step;
                          onChange(rest);
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onChange({
                      ...step,
                      abVariants: [...(step.abVariants ?? []), { templateId: "", weight: 1 }],
                    })
                  }
                >
                  <Plus className="mr-1 h-3 w-3" /> Add variant
                </Button>
                <p className="text-[11px] text-[var(--st-text-secondary)]">
                  Once every arm reaches the sample threshold, the best reply rate (click rate as
                  fallback) is promoted automatically.
                </p>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onChange({
                    ...step,
                    abVariants: [
                      { templateId: step.templateId || "", weight: 1 },
                      { templateId: "", weight: 1 },
                    ],
                  })
                }
              >
                <FlaskConical className="mr-1 h-3 w-3" /> A/B test this step
              </Button>
            )}
          </div>
        )}

        {step.kind === "wait" && (
          <div className="space-y-1.5">
            <Label>Wait for</Label>
            <DurationInput
              ms={step.durationMs}
              idPrefix={`wait-${step.id}`}
              onChange={(durationMs) => onChange({ ...step, durationMs })}
            />
          </div>
        )}

        {step.kind === "waitUntil" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Wait until the contact…</Label>
                <SelectField
                  value={step.event}
                  options={[
                    { value: "replied", label: "replies" },
                    { value: "clicked", label: "clicks a tracked link" },
                  ]}
                  onChange={(v) => v && onChange({ ...step, event: v as "replied" | "clicked" })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Give up after</Label>
                <DurationInput
                  ms={step.timeoutMs}
                  idPrefix={`wu-${step.id}`}
                  onChange={(timeoutMs) => onChange({ ...step, timeoutMs })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>On event, go to</Label>
                <SelectField
                  value={step.onEventStepId ?? null}
                  options={targetOptions}
                  clearable
                  placeholder="Next step (default)"
                  onChange={(v) => onChange({ ...step, onEventStepId: v ?? undefined })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>On timeout, go to</Label>
                <SelectField
                  value={step.onTimeoutStepId ?? null}
                  options={targetOptions}
                  clearable
                  placeholder="Next step (default)"
                  onChange={(v) => onChange({ ...step, onTimeoutStepId: v ?? undefined })}
                />
              </div>
            </div>
          </div>
        )}

        {step.kind === "branch" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor={`branch-field-${step.id}`}>Variable</Label>
                <Input
                  id={`branch-field-${step.id}`}
                  placeholder="plan"
                  value={step.condition.field === "__pinpoint_unmapped" ? "" : step.condition.field}
                  onChange={(e) =>
                    onChange({ ...step, condition: { ...step.condition, field: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Operator</Label>
                <SelectField
                  value={step.condition.op}
                  options={[
                    { value: "eq", label: "equals" },
                    { value: "ne", label: "does not equal" },
                    { value: "contains", label: "contains" },
                    { value: "gt", label: "greater than" },
                    { value: "lt", label: "less than" },
                  ]}
                  onChange={(v) =>
                    v &&
                    onChange({
                      ...step,
                      condition: { ...step.condition, op: v as typeof step.condition.op },
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`branch-value-${step.id}`}>Value</Label>
                <Input
                  id={`branch-value-${step.id}`}
                  placeholder="pro"
                  value={step.condition.value}
                  onChange={(e) =>
                    onChange({ ...step, condition: { ...step.condition, value: e.target.value } })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>If true, go to</Label>
                <SelectField
                  value={step.trueStepId || null}
                  options={targetOptions}
                  placeholder="Pick a step"
                  onChange={(v) => onChange({ ...step, trueStepId: v ?? "" })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>If false, go to</Label>
                <SelectField
                  value={step.falseStepId || null}
                  options={targetOptions}
                  placeholder="Pick a step"
                  onChange={(v) => onChange({ ...step, falseStepId: v ?? "" })}
                />
              </div>
            </div>
          </div>
        )}

        {step.kind === "exit" && (
          <p className="text-xs text-[var(--st-text-secondary)]">
            The contact leaves the journey here. Useful as a branch / wait target.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
