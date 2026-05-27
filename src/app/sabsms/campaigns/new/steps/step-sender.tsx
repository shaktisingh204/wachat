"use client";

import * as React from "react";

import {
  Badge,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Checkbox,
  ZoruRadioCard,
  RadioGroup,
} from "@/components/zoruui";

import type { CampaignDraft, SenderStrategy } from "../types";

export interface SenderNumberOption {
  id: string;
  e164: string;
  country: string;
  type: string;
}

interface StepSenderProps {
  draft: CampaignDraft;
  numbers: SenderNumberOption[];
  onChange: (patch: Partial<CampaignDraft>) => void;
}

export function StepSender({ draft, numbers, onChange }: StepSenderProps) {
  const ids = draft.senderNumberIds ?? [];

  function toggle(id: string, on: boolean) {
    const next = on
      ? Array.from(new Set([...ids, id]))
      : ids.filter((x) => x !== id);
    onChange({ senderNumberIds: next });
  }

  return (
    <div className="space-y-5">
      <RadioGroup
        value={draft.senderStrategy}
        onValueChange={(v) =>
          onChange({ senderStrategy: v as SenderStrategy })
        }
        className="grid gap-3 md:grid-cols-3"
      >
        <ZoruRadioCard
          value="single"
          label="Single number"
          description="One from-number for the whole campaign."
        />
        <ZoruRadioCard
          value="pool"
          label="Pool"
          description="Round-robin across many numbers — boosts throughput, lowers carrier flagging."
        />
        <ZoruRadioCard
          value="sticky_per_recipient"
          label="Sticky per recipient"
          description="Each contact always sees the same from-number — best for conversational tone."
        />
      </RadioGroup>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="text-base">Sender numbers</ZoruCardTitle>
          <ZoruCardDescription>
            {draft.senderStrategy === "single"
              ? "Pick exactly one."
              : "Pick at least one — the engine rotates within this pool."}
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          {numbers.length === 0 ? (
            <p className="text-sm text-zoru-ink">
              No active numbers. Provision one at <code>/sabsms/numbers</code>.
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {numbers.map((n) => {
                const checked = ids.includes(n.id);
                return (
                  <label
                    key={n.id}
                    className="flex cursor-pointer items-center gap-3 rounded border border-zoru-line p-3 hover:border-zoru-line"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        if (draft.senderStrategy === "single") {
                          onChange({ senderNumberIds: v ? [n.id] : [] });
                        } else {
                          toggle(n.id, Boolean(v));
                        }
                      }}
                    />
                    <div className="flex flex-1 items-center justify-between">
                      <code className="text-sm text-zoru-ink">{n.e164}</code>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{n.country}</Badge>
                        <Badge variant="secondary">{n.type}</Badge>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </ZoruCardContent>
      </Card>
    </div>
  );
}
