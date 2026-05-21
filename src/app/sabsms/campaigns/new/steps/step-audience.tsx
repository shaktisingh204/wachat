"use client";

import * as React from "react";

import {
  ZoruBadge,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCheckbox,
  ZoruLabel,
  ZoruRadioCard,
  ZoruRadioGroup,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from "@/components/zoruui";
import { SabFilePickerButton } from "@/components/sabfiles";

import type { AudienceDraft, CampaignDraft } from "../types";

export interface SegmentOption {
  id: string;
  name: string;
  count?: number;
}

export interface ContactOption {
  id: string;
  name: string;
  phone: string;
}

interface StepAudienceProps {
  draft: CampaignDraft;
  segments: SegmentOption[];
  contacts: ContactOption[];
  onChange: (patch: Partial<CampaignDraft>) => void;
}

type AudienceKind = AudienceDraft["kind"];

export function StepAudience({
  draft,
  segments,
  contacts,
  onChange,
}: StepAudienceProps) {
  const kind: AudienceKind = draft.audience?.kind ?? "contacts";

  function setKind(next: AudienceKind) {
    if (next === "segment") {
      onChange({ audience: { kind: "segment", segmentId: "" } });
    } else if (next === "contacts") {
      onChange({ audience: { kind: "contacts", contactIds: [] } });
    } else {
      onChange({ audience: { kind: "csv", sabFileId: "" } });
    }
  }

  return (
    <div className="space-y-5">
      <ZoruRadioGroup
        value={kind}
        onValueChange={(v) => setKind(v as AudienceKind)}
        className="grid gap-3 md:grid-cols-3"
      >
        <ZoruRadioCard
          value="segment"
          label="Segment"
          description="Pick a saved CRM segment."
        />
        <ZoruRadioCard
          value="contacts"
          label="Contacts"
          description="Hand-pick recipients."
        />
        <ZoruRadioCard
          value="csv"
          label="CSV upload"
          description="Upload via SabFiles."
        />
      </ZoruRadioGroup>

      {kind === "segment" && (
        <div className="space-y-2">
          <ZoruLabel>Segment</ZoruLabel>
          {segments.length === 0 ? (
            <p className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
              No segments yet. Create one in the CRM. {"// TODO: wire segments collection once shipped"}
            </p>
          ) : (
            <ZoruSelect
              value={
                draft.audience?.kind === "segment"
                  ? draft.audience.segmentId
                  : ""
              }
              onValueChange={(v) =>
                onChange({ audience: { kind: "segment", segmentId: v } })
              }
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="Pick a segment" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {segments.map((s) => (
                  <ZoruSelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.count != null ? ` (${s.count})` : ""}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          )}
        </div>
      )}

      {kind === "contacts" && (
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle className="text-base">Contacts</ZoruCardTitle>
            <ZoruCardDescription>
              Hand-pick recipients from your saved contacts.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            {contacts.length === 0 ? (
              <p className="text-sm text-slate-500">
                No contacts yet — add them at <code>/sabsms/contacts</code>.
              </p>
            ) : (
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {contacts.map((c) => {
                  const ids =
                    draft.audience?.kind === "contacts"
                      ? draft.audience.contactIds
                      : [];
                  const checked = ids.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-slate-50"
                    >
                      <ZoruCheckbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          const next = v
                            ? Array.from(new Set([...ids, c.id]))
                            : ids.filter((x) => x !== c.id);
                          onChange({
                            audience: {
                              kind: "contacts",
                              contactIds: next,
                            },
                          });
                        }}
                      />
                      <div className="flex flex-1 items-center justify-between">
                        <span className="text-sm text-slate-700">{c.name}</span>
                        <code className="text-xs text-slate-500">
                          {c.phone}
                        </code>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </ZoruCardContent>
        </ZoruCard>
      )}

      {kind === "csv" && (
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle className="text-base">CSV upload</ZoruCardTitle>
            <ZoruCardDescription>
              Files live in SabFiles — never a free-text URL.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-3">
            <SabFilePickerButton
              accept="document"
              onPick={(p) =>
                onChange({
                  audience: {
                    kind: "csv",
                    sabFileId: p.id,
                    sabFileName: p.name,
                  },
                })
              }
            >
              {draft.audience?.kind === "csv" && draft.audience.sabFileId
                ? "Replace CSV"
                : "Pick a CSV"}
            </SabFilePickerButton>
            {draft.audience?.kind === "csv" && draft.audience.sabFileId && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <ZoruBadge variant="secondary">
                  {draft.audience.sabFileName ?? "csv"}
                </ZoruBadge>
                <code className="text-xs text-slate-500">
                  sabFileId={draft.audience.sabFileId}
                </code>
              </div>
            )}
          </ZoruCardContent>
        </ZoruCard>
      )}
    </div>
  );
}
