"use client";

import * as React from "react";

import {
  Input,
  Label,
  ZoruRadioCard,
  RadioGroup,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from "@/components/zoruui";

import type { CampaignDraft, ScheduleDraft } from "../types";

interface StepScheduleProps {
  draft: CampaignDraft;
  drips: { id: string; name: string }[];
  onChange: (patch: Partial<CampaignDraft>) => void;
}

type Kind = ScheduleDraft["kind"];

export function StepSchedule({ draft, drips, onChange }: StepScheduleProps) {
  const kind: Kind = draft.schedule?.kind ?? "immediate";

  function setKind(next: Kind) {
    if (next === "immediate") onChange({ schedule: { kind: "immediate" } });
    else if (next === "scheduled")
      onChange({ schedule: { kind: "scheduled", sendAt: "" } });
    else if (next === "recurring")
      onChange({ schedule: { kind: "recurring", cron: "0 9 * * 1" } });
    else onChange({ schedule: { kind: "drip", dripId: "" } });
  }

  return (
    <div className="space-y-5">
      <ZoruRadioGroup
        value={kind}
        onValueChange={(v) => setKind(v as Kind)}
        className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"
      >
        <ZoruRadioCard
          value="immediate"
          label="Immediate"
          description="Start as soon as you launch."
        />
        <ZoruRadioCard
          value="scheduled"
          label="Scheduled"
          description="Pick a specific datetime."
        />
        <ZoruRadioCard
          value="recurring"
          label="Recurring"
          description="Cron-driven repeat."
        />
        <ZoruRadioCard
          value="drip"
          label="Drip"
          description="Multi-step automation."
        />
      </ZoruRadioGroup>

      {kind === "scheduled" && (
        <div className="space-y-2">
          <ZoruLabel htmlFor="schedule-sendAt">Send at</ZoruLabel>
          <ZoruInput
            id="schedule-sendAt"
            type="datetime-local"
            value={
              draft.schedule?.kind === "scheduled" ? draft.schedule.sendAt : ""
            }
            onChange={(e) =>
              onChange({
                schedule: { kind: "scheduled", sendAt: e.target.value },
              })
            }
          />
          <p className="text-xs text-slate-500">
            Stored as ISO; engine converts to recipient TZ when STO is on.
          </p>
        </div>
      )}

      {kind === "recurring" && (
        <div className="space-y-2">
          <ZoruLabel htmlFor="schedule-cron">Cron expression</ZoruLabel>
          <ZoruInput
            id="schedule-cron"
            placeholder="0 9 * * 1"
            value={
              draft.schedule?.kind === "recurring" ? draft.schedule.cron : ""
            }
            onChange={(e) =>
              onChange({
                schedule: { kind: "recurring", cron: e.target.value },
              })
            }
          />
          <p className="text-xs text-slate-500">
            Standard 5-field cron (UTC). Example: <code>0 9 * * 1</code>{" "}
            (Mondays at 09:00 UTC).
          </p>
        </div>
      )}

      {kind === "drip" && (
        <div className="space-y-2">
          <ZoruLabel htmlFor="schedule-drip">Drip</ZoruLabel>
          {drips.length === 0 ? (
            <p className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
              No drips yet. Create one at <code>/sabsms/drips/new</code>. {"// TODO: full drip picker dialog ships with Phase 4"}
            </p>
          ) : (
            <ZoruSelect
              value={
                draft.schedule?.kind === "drip" ? draft.schedule.dripId : ""
              }
              onValueChange={(v) =>
                onChange({ schedule: { kind: "drip", dripId: v } })
              }
            >
              <ZoruSelectTrigger id="schedule-drip">
                <ZoruSelectValue placeholder="Pick a drip" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {drips.map((d) => (
                  <ZoruSelectItem key={d.id} value={d.id}>
                    {d.name}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          )}
        </div>
      )}
    </div>
  );
}
