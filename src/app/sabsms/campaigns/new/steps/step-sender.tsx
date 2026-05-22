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
      <ZoruRadioGroup
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
      </ZoruRadioGroup>

      <ZoruCard>
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
            <p className="text-sm text-slate-500">
              No active numbers. Provision one at <code>/sabsms/numbers</code>.
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {numbers.map((n) => {
                const checked = ids.includes(n.id);
                return (
                  <label
                    key={n.id}
                    className="flex cursor-pointer items-center gap-3 rounded border border-slate-200 p-3 hover:border-slate-400"
                  >
                    <ZoruCheckbox
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
                      <code className="text-sm text-slate-700">{n.e164}</code>
                      <div className="flex items-center gap-2">
                        <ZoruBadge variant="outline">{n.country}</ZoruBadge>
                        <ZoruBadge variant="secondary">{n.type}</ZoruBadge>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </ZoruCardContent>
      </ZoruCard>
    </div>
  );
}
