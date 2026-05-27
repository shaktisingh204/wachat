"use client";

import * as React from "react";

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Checkbox,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Switch,
  Textarea,
} from "@/components/zoruui";

import type {
  ABVariant,
  ABWinnerMetric,
  CampaignDraft,
  FrequencyCapPeriod,
} from "../types";

interface StepComplianceProps {
  draft: CampaignDraft;
  /** Resolved template body for variable preview. */
  templateBody?: string;
  /** Template variable names, for the map preview. */
  templateVariables?: string[];
  onChange: (patch: Partial<CampaignDraft>) => void;
}

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "SGD"];

function interpolate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

function newVariant(idx: number): ABVariant {
  return {
    id: `v_${idx}_${Math.random().toString(36).slice(2, 8)}`,
    label: `Variant ${String.fromCharCode(65 + idx)}`,
    body: "",
    weight: 1,
  };
}

export function StepCompliance({
  draft,
  templateBody = "",
  templateVariables = [],
  onChange,
}: StepComplianceProps) {
  const [sampleVars, setSampleVars] = React.useState<Record<string, string>>(
    () => {
      const out: Record<string, string> = {};
      for (const v of templateVariables) out[v] = `«${v}»`;
      return out;
    },
  );

  const previewed = React.useMemo(
    () => interpolate(templateBody, sampleVars),
    [templateBody, sampleVars],
  );

  // Crude cost estimate — segments × per-segment baseline. The Rust
  // engine produces the real number at enqueue time.
  const estimate = React.useMemo(() => {
    const seg = Math.max(1, Math.ceil(templateBody.length / 160));
    const audSize =
      draft.audience?.kind === "contacts"
        ? draft.audience.contactIds.length
        : draft.audience?.kind === "csv"
          ? 1000 // placeholder until CSV row count lands
          : 1000;
    const perSeg = 0.0075;
    const median = seg * audSize * perSeg;
    return {
      low: median * 0.7,
      median,
      high: median * 1.4,
    };
  }, [templateBody, draft.audience]);

  function setAb(patch: Partial<typeof draft.abSplit>) {
    onChange({ abSplit: { ...draft.abSplit, ...patch } });
  }
  function setFc(patch: Partial<typeof draft.frequencyCap>) {
    onChange({ frequencyCap: { ...draft.frequencyCap, ...patch } });
  }
  function setVariants(variants: ABVariant[]) {
    setAb({ variants });
  }

  return (
    <div className="space-y-5">
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="text-base">Variable preview</ZoruCardTitle>
          <ZoruCardDescription>
            Renders the template body with sample values — exactly what one
            recipient will see.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-3">
          {templateVariables.length === 0 ? (
            <p className="text-xs text-zoru-ink">
              No <code>{`{{var}}`}</code> tokens detected on this template.
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {templateVariables.map((v) => (
                <div key={v} className="space-y-1">
                  <Label className="text-xs">{`{{${v}}}`}</Label>
                  <Input
                    value={sampleVars[v] ?? ""}
                    onChange={(e) =>
                      setSampleVars({ ...sampleVars, [v]: e.target.value })
                    }
                  />
                </div>
              ))}
            </div>
          )}
          <pre className="whitespace-pre-wrap rounded bg-zoru-surface-2 p-3 text-xs text-zoru-ink">
            {previewed || "Pick a template back in Step 1 to preview here."}
          </pre>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="text-base">A/B split</ZoruCardTitle>
          <ZoruCardDescription>
            Test up to 5 variants. The engine declares a winner on your metric
            after the sample window.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm text-zoru-ink">Enable A/B split</span>
            <Switch
              checked={draft.abSplit.enabled}
              onCheckedChange={(v) => setAb({ enabled: Boolean(v) })}
            />
          </label>

          {draft.abSplit.enabled && (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Winner metric</Label>
                  <Select
                    value={draft.abSplit.winnerMetric}
                    onValueChange={(v) =>
                      setAb({ winnerMetric: v as ABWinnerMetric })
                    }
                  >
                    <ZoruSelectTrigger>
                      <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      <ZoruSelectItem value="ctr">CTR</ZoruSelectItem>
                      <ZoruSelectItem value="reply">Reply</ZoruSelectItem>
                      <ZoruSelectItem value="conversion">
                        Conversion
                      </ZoruSelectItem>
                    </ZoruSelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Sample window (hours)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    value={draft.abSplit.sampleWindowHours}
                    onChange={(e) =>
                      setAb({
                        sampleWindowHours: Number(e.target.value) || 1,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                {draft.abSplit.variants.map((v, i) => (
                  <div
                    key={v.id}
                    className="space-y-2 rounded border border-zoru-line p-3"
                  >
                    <div className="flex items-center justify-between">
                      <Input
                        className="max-w-[200px]"
                        value={v.label}
                        onChange={(e) => {
                          const next = [...draft.abSplit.variants];
                          next[i] = { ...v, label: e.target.value };
                          setVariants(next);
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setVariants(
                            draft.abSplit.variants.filter((_, idx) => idx !== i),
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                    <Textarea
                      rows={2}
                      value={v.body}
                      placeholder="Variant body…"
                      onChange={(e) => {
                        const next = [...draft.abSplit.variants];
                        next[i] = { ...v, body: e.target.value };
                        setVariants(next);
                      }}
                    />
                  </div>
                ))}
                {draft.abSplit.variants.length < 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setVariants([
                        ...draft.abSplit.variants,
                        newVariant(draft.abSplit.variants.length),
                      ])
                    }
                  >
                    Add variant
                  </Button>
                )}
              </div>
            </>
          )}
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="text-base">Frequency cap</ZoruCardTitle>
          <ZoruCardDescription>
            Stop hammering the same contact across overlapping campaigns.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm text-zoru-ink">Enable frequency cap</span>
            <Switch
              checked={draft.frequencyCap.enabled}
              onCheckedChange={(v) => setFc({ enabled: Boolean(v) })}
            />
          </label>
          {draft.frequencyCap.enabled && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Max messages</Label>
                <Input
                  type="number"
                  min={1}
                  value={draft.frequencyCap.maxPerPeriod}
                  onChange={(e) =>
                    setFc({
                      maxPerPeriod: Math.max(1, Number(e.target.value)),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Per</Label>
                <Select
                  value={draft.frequencyCap.period}
                  onValueChange={(v) =>
                    setFc({ period: v as FrequencyCapPeriod })
                  }
                >
                  <ZoruSelectTrigger>
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="day">Day</ZoruSelectItem>
                    <ZoruSelectItem value="week">Week</ZoruSelectItem>
                    <ZoruSelectItem value="month">Month</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
              </div>
            </div>
          )}
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="text-base">Smart toggles</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm text-zoru-ink">
              Smart suppression
              <span className="block text-xs text-zoru-ink">
                Filter out contacts that haven&apos;t engaged in 90 days.
              </span>
            </span>
            <Switch
              checked={draft.smartSuppression}
              onCheckedChange={(v) =>
                onChange({ smartSuppression: Boolean(v) })
              }
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm text-zoru-ink">
              Send-time optimization
              <span className="block text-xs text-zoru-ink">
                Pick the best send hour per recipient based on history.
              </span>
            </span>
            <Switch
              checked={draft.sendTimeOptimization}
              onCheckedChange={(v) =>
                onChange({ sendTimeOptimization: Boolean(v) })
              }
            />
          </label>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="text-base">Cost estimate</ZoruCardTitle>
          <ZoruCardDescription>
            Rough estimate — the engine computes the authoritative cost at
            send time.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Currency</Label>
            <Select
              value={draft.costCurrency}
              onValueChange={(v) => onChange({ costCurrency: v })}
            >
              <ZoruSelectTrigger className="w-32">
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {CURRENCIES.map((c) => (
                  <ZoruSelectItem key={c} value={c}>
                    {c}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded border border-zoru-line p-3">
              <div className="text-xs text-zoru-ink">Low</div>
              <div className="font-mono">
                {estimate.low.toFixed(2)} {draft.costCurrency}
              </div>
            </div>
            <div className="rounded border border-zoru-line bg-zoru-surface-2 p-3">
              <div className="text-xs text-zoru-ink">Median</div>
              <div className="font-mono font-semibold">
                {estimate.median.toFixed(2)} {draft.costCurrency}
              </div>
            </div>
            <div className="rounded border border-zoru-line p-3">
              <div className="text-xs text-zoru-ink">High</div>
              <div className="font-mono">
                {estimate.high.toFixed(2)} {draft.costCurrency}
              </div>
            </div>
          </div>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="text-base">Compliance</ZoruCardTitle>
          <ZoruCardDescription>
            Required for marketing campaigns under TCPA / GDPR / DLT / 10DLC.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <label className="flex items-start gap-3">
            <Checkbox
              checked={draft.complianceAttested}
              onCheckedChange={(v) =>
                onChange({ complianceAttested: Boolean(v) })
              }
            />
            <span className="text-sm text-zoru-ink">
              I attest every recipient has given explicit opt-in for this
              category, and the message includes valid sender ID + opt-out
              instructions where required.
              {draft.category === "marketing" && (
                <Badge variant="destructive" className="ml-2">
                  Required
                </Badge>
              )}
            </span>
          </label>
          <Separator className="my-3" />
          <p className="text-xs text-zoru-ink">
            Your attestation, along with workspace + user + timestamp, is
            written to the audit log when you launch.
          </p>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
