"use client";

import * as React from "react";

import {
  Badge,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from "@/components/zoruui";
import type { SabsmsMessageCategory } from "@/lib/sabsms/types";

import type { CampaignDraft } from "../types";

export interface TemplateOption {
  id: string;
  name: string;
  category: SabsmsMessageCategory;
  status: string;
  bodies: { locale: string; body: string }[];
  variables?: string[];
}

interface StepTemplateProps {
  draft: CampaignDraft;
  templates: TemplateOption[];
  onChange: (patch: Partial<CampaignDraft>) => void;
}

const CATEGORIES: { value: SabsmsMessageCategory; label: string }[] = [
  { value: "transactional", label: "Transactional" },
  { value: "otp", label: "OTP" },
  { value: "marketing", label: "Marketing" },
  { value: "alert", label: "Alert" },
  { value: "service", label: "Service" },
];

export function StepTemplate({ draft, templates, onChange }: StepTemplateProps) {
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.bodies.some((b) => b.body.toLowerCase().includes(q)),
    );
  }, [search, templates]);

  const selected = templates.find((t) => t.id === draft.templateId);
  const previewBody =
    selected?.bodies.find((b) => b.locale === draft.templateLocale)?.body ??
    selected?.bodies[0]?.body ??
    "";

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="campaign-name">Campaign name</Label>
          <Input
            id="campaign-name"
            placeholder="May newsletter"
            value={draft.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="campaign-category">Category</Label>
          <Select
            value={draft.category}
            onValueChange={(v) =>
              onChange({ category: v as SabsmsMessageCategory })
            }
          >
            <ZoruSelectTrigger id="campaign-category">
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {CATEGORIES.map((c) => (
                <ZoruSelectItem key={c.value} value={c.value}>
                  {c.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="template-search">Search templates</Label>
        <Input
          id="template-search"
          placeholder="Search by name or body…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Templates ({filtered.length})
          </p>
          <div className="max-h-80 space-y-2 overflow-y-auto rounded border border-slate-200 p-2">
            {filtered.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">
                No templates yet. Create one at{" "}
                <code>/sabsms/templates/new</code>.
              </p>
            ) : (
              filtered.map((t) => {
                const active = t.id === draft.templateId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      onChange({
                        templateId: t.id,
                        templateLocale: t.bodies[0]?.locale ?? "en",
                      })
                    }
                    className={`w-full rounded border p-3 text-left transition ${
                      active
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800">
                        {t.name}
                      </span>
                      <Badge variant="secondary">{t.category}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {t.bodies[0]?.body}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle className="text-base">Preview</ZoruCardTitle>
            <ZoruCardDescription>
              {selected
                ? `${selected.name} · ${selected.category}`
                : "Pick a template to preview its body."}
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            {selected && selected.bodies.length > 1 && (
              <div className="mb-3 space-y-2">
                <Label htmlFor="locale-select">Locale</Label>
                <Select
                  value={draft.templateLocale ?? selected.bodies[0]?.locale}
                  onValueChange={(v) => onChange({ templateLocale: v })}
                >
                  <ZoruSelectTrigger id="locale-select">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {selected.bodies.map((b) => (
                      <ZoruSelectItem key={b.locale} value={b.locale}>
                        {b.locale}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </Select>
              </div>
            )}
            <pre className="whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs text-slate-700">
              {previewBody || "No template selected."}
            </pre>
            {selected?.variables && selected.variables.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {selected.variables.map((v) => (
                  <Badge key={v} variant="outline">
                    {`{{${v}}}`}
                  </Badge>
                ))}
              </div>
            )}
          </ZoruCardContent>
        </Card>
      </div>
    </div>
  );
}
