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
  Input,
  Label,
  Separator,
  Switch,
} from "@/components/sabcrm/20ui/zoru";

import type { CampaignDraft, QuietHoursWindow } from "../types";

interface StepThrottleProps {
  draft: CampaignDraft;
  onChange: (patch: Partial<CampaignDraft>) => void;
}

export function StepThrottle({ draft, onChange }: StepThrottleProps) {
  function setQuietHours(next: QuietHoursWindow[]) {
    onChange({ quietHours: next });
  }

  function addWindow() {
    setQuietHours([
      ...draft.quietHours,
      { country: "US", start: "22:00", end: "08:00" },
    ]);
  }

  function updateWindow(i: number, patch: Partial<QuietHoursWindow>) {
    setQuietHours(
      draft.quietHours.map((w, idx) => (idx === i ? { ...w, ...patch } : w)),
    );
  }

  function removeWindow(i: number) {
    setQuietHours(draft.quietHours.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-5">
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="text-base">Throughput</ZoruCardTitle>
          <ZoruCardDescription>
            Tune outbound rate. Higher = faster delivery but more carrier risk.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="throttle-rps">
                Messages per second
              </Label>
              <Badge variant="secondary">
                {draft.throttlePerSecond ?? 10} msg/s
              </Badge>
            </div>
            <input
              id="throttle-rps"
              type="range"
              min={1}
              max={100}
              step={1}
              value={draft.throttlePerSecond ?? 10}
              onChange={(e) =>
                onChange({ throttlePerSecond: Number(e.target.value) })
              }
              className="w-full accent-[var(--st-text)]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="throttle-per-provider">
              Per-provider cap (msg/s)
            </Label>
            <Input
              id="throttle-per-provider"
              type="number"
              min={0}
              value={draft.perProviderCap ?? ""}
              placeholder="optional"
              onChange={(e) =>
                onChange({
                  perProviderCap: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
            />
            <p className="text-xs text-[var(--st-text)]">
              Hard ceiling enforced before round-robin. Leave empty for no cap.
            </p>
          </div>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="text-base">Quiet hours</ZoruCardTitle>
          <ZoruCardDescription>
            Per-country windows when the engine pauses delivery. Times use 24h.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-3">
          {draft.quietHours.length === 0 ? (
            <p className="text-sm text-[var(--st-text)]">No quiet-hours windows.</p>
          ) : (
            draft.quietHours.map((w, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-2 rounded border border-[var(--st-border)] p-2 md:grid-cols-[100px_1fr_1fr_auto] md:items-center"
              >
                <Input
                  value={w.country}
                  maxLength={2}
                  onChange={(e) =>
                    updateWindow(i, { country: e.target.value.toUpperCase() })
                  }
                  placeholder="US"
                />
                <Input
                  type="time"
                  value={w.start}
                  onChange={(e) => updateWindow(i, { start: e.target.value })}
                />
                <Input
                  type="time"
                  value={w.end}
                  onChange={(e) => updateWindow(i, { end: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeWindow(i)}
                >
                  Remove
                </Button>
              </div>
            ))
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addWindow}
          >
            Add window
          </Button>

          <Separator />

          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-[var(--st-text)]">
              Per-recipient TZ-aware quiet hours
              <span className="block text-xs text-[var(--st-text)]">
                Compute the window in the recipient&apos;s local timezone,
                not the campaign country.
              </span>
            </span>
            <Switch
              checked={draft.perRecipientTzQuietHours}
              onCheckedChange={(v) =>
                onChange({ perRecipientTzQuietHours: Boolean(v) })
              }
            />
          </label>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
