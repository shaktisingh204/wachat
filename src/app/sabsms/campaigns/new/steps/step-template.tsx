"use client";

import * as React from "react";
import { FileText } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/sabcrm/20ui";
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
        <div className="md:col-span-2">
          <Field label="Campaign name">
            <Input
              placeholder="May newsletter"
              value={draft.name}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Category">
          <Select
            value={draft.category}
            onValueChange={(v) =>
              onChange({ category: v as SabsmsMessageCategory })
            }
          >
            <SelectTrigger aria-label="Category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Search templates">
        <Input
          placeholder="Search by name or body"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
            Templates ({filtered.length})
          </p>
          <div className="max-h-80 space-y-2 overflow-y-auto rounded-[var(--st-radius)] border border-[var(--st-border)] p-2">
            {filtered.length === 0 ? (
              <EmptyState
                icon={FileText}
                size="sm"
                title="No templates yet"
                description="Create one at /sabsms/templates/new to get started."
              />
            ) : (
              filtered.map((t) => {
                const active = t.id === draft.templateId;
                return (
                  <Button
                    key={t.id}
                    variant={active ? "secondary" : "ghost"}
                    block
                    aria-pressed={active}
                    onClick={() =>
                      onChange({
                        templateId: t.id,
                        templateLocale: t.bodies[0]?.locale ?? "en",
                      })
                    }
                    className={`!h-auto !justify-start rounded-[var(--st-radius)] border p-3 text-left ${
                      active
                        ? "border-[var(--st-accent)] bg-[var(--st-bg-muted)]"
                        : "border-[var(--st-border)]"
                    }`}
                  >
                    <span className="block w-full">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[var(--st-text)]">
                          {t.name}
                        </span>
                        <Badge variant="secondary">{t.category}</Badge>
                      </span>
                      <span className="mt-1 line-clamp-2 block text-xs font-normal text-[var(--st-text-secondary)]">
                        {t.bodies[0]?.body}
                      </span>
                    </span>
                  </Button>
                );
              })
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
            <CardDescription>
              {selected
                ? `${selected.name} - ${selected.category}`
                : "Pick a template to preview its body."}
            </CardDescription>
          </CardHeader>
          <CardBody>
            {selected && selected.bodies.length > 1 && (
              <div className="mb-3">
                <Field label="Locale">
                  <Select
                    value={draft.templateLocale ?? selected.bodies[0]?.locale}
                    onValueChange={(v) => onChange({ templateLocale: v })}
                  >
                    <SelectTrigger aria-label="Locale">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selected.bodies.map((b) => (
                        <SelectItem key={b.locale} value={b.locale}>
                          {b.locale}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}
            <pre className="whitespace-pre-wrap rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] p-3 text-xs text-[var(--st-text)]">
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
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
