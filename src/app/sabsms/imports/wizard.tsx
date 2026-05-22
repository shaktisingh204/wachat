"use client";

/**
 * SabSMS imports — multi-step wizard component.
 *
 * Mounts inside a Dialog from `imports-table.tsx`. Drives the user
 * through: file pick (SabFiles) → column mapping → preview + dedupe →
 * options (consent / suppression / tags / segment / cron / webhook) →
 * confirm.
 *
 * The wizard is purely a UI composer. On commit it calls the server
 * action `createImport` (passed via prop) so the page stays composable
 * for tests.
 */

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Tag,
  Upload,
  Webhook,
} from "lucide-react";

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Button,
  Checkbox,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Progress,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
} from "@/components/zoruui";
import { SabFilePickerButton, type SabFilePick } from "@/components/sabfiles";

import {
  findDuplicatePhones,
  inferColumnMapping,
  normalisePhone,
  parseCsv,
  type ColumnMapping,
} from "./parse";
import type { CreateImportInput, ImportRecord } from "./actions";

const MAPPING_TEMPLATES_KEY = "sabsms:import-mappings";
const PREVIEW_ROW_LIMIT = 50;
const STEPS = [
  "Upload",
  "Mapping",
  "Preview",
  "Options",
  "Confirm",
] as const;

type StepName = (typeof STEPS)[number];

interface MappingTemplate {
  id: string;
  name: string;
  mapping: ColumnMapping;
  savedAt: string;
}

export interface ImportsWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    input: CreateImportInput,
  ) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  /** Last successful import (used to suggest "rerun with same mapping"). */
  lastImport?: ImportRecord;
}

export function ImportsWizard({
  open,
  onOpenChange,
  onSubmit,
  lastImport,
}: ImportsWizardProps) {
  const [stepIndex, setStepIndex] = React.useState(0);
  const [picked, setPicked] = React.useState<SabFilePick | null>(null);
  const [csvText, setCsvText] = React.useState<string>("");
  const [parsing, setParsing] = React.useState(false);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = React.useState<ColumnMapping>({});
  const [skipSuppressed, setSkipSuppressed] = React.useState(true);
  const [skipDuplicates, setSkipDuplicates] = React.useState(true);
  const [consentAttested, setConsentAttested] = React.useState(false);
  const [bulkTagsRaw, setBulkTagsRaw] = React.useState("");
  const [segmentId, setSegmentId] = React.useState("");
  const [listId, setListId] = React.useState("");
  const [cronExpression, setCronExpression] = React.useState("");
  const [webhookUrl, setWebhookUrl] = React.useState("");
  const [name, setName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [templates, setTemplates] = React.useState<MappingTemplate[]>([]);
  const [templateName, setTemplateName] = React.useState("");

  // Load saved column-mapping templates once on mount.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(MAPPING_TEMPLATES_KEY);
      if (raw) setTemplates(JSON.parse(raw) as MappingTemplate[]);
    } catch {
      // Corrupt local storage — fall back to empty.
      setTemplates([]);
    }
  }, []);

  // Reset wizard state when the dialog closes so the next open is clean.
  React.useEffect(() => {
    if (!open) {
      setStepIndex(0);
      setPicked(null);
      setCsvText("");
      setHeaders([]);
      setRows([]);
      setMapping({});
      setName("");
      setParseError(null);
      setSubmitError(null);
    }
  }, [open]);

  // Parse CSV when a SabFile is picked.
  React.useEffect(() => {
    if (!picked?.url) return;
    let cancelled = false;
    setParsing(true);
    setParseError(null);
    (async () => {
      try {
        const res = await fetch(picked.url);
        const text = await res.text();
        if (cancelled) return;
        const parsed = parseCsv(text);
        setCsvText(text);
        setHeaders(parsed.headers);
        setRows(parsed.rows);
        setMapping(inferColumnMapping(parsed.headers));
        setName(picked.name.replace(/\.csv$/i, ""));
        if (parsed.errors.length > 0) {
          setParseError(
            `Parsed with ${parsed.errors.length} warning${parsed.errors.length === 1 ? "" : "s"}.`,
          );
        }
      } catch (err) {
        if (!cancelled) {
          setParseError(
            err instanceof Error ? err.message : "Failed to read CSV file.",
          );
        }
      } finally {
        if (!cancelled) setParsing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [picked]);

  const phoneCol = mapping.phone;
  const previewRows = rows.slice(0, PREVIEW_ROW_LIMIT);
  const duplicates = React.useMemo(() => {
    if (!phoneCol) return [] as string[];
    return findDuplicatePhones(rows, phoneCol);
  }, [rows, phoneCol]);
  const invalidCount = React.useMemo(() => {
    if (!phoneCol) return 0;
    return rows.reduce(
      (sum, r) => (normalisePhone(r[phoneCol] ?? "") ? sum : sum + 1),
      0,
    );
  }, [rows, phoneCol]);

  const step: StepName = STEPS[stepIndex];

  function canAdvance(): boolean {
    switch (step) {
      case "Upload":
        return !!picked && !parsing && headers.length > 0;
      case "Mapping":
        return !!mapping.phone;
      case "Preview":
        return rows.length > 0;
      case "Options":
        return consentAttested;
      case "Confirm":
        return name.trim().length > 0;
      default:
        return false;
    }
  }

  function saveTemplate() {
    if (!templateName.trim() || typeof window === "undefined") return;
    const tpl: MappingTemplate = {
      id: `${Date.now()}`,
      name: templateName.trim(),
      mapping,
      savedAt: new Date().toISOString(),
    };
    const next = [...templates.filter((t) => t.name !== tpl.name), tpl];
    setTemplates(next);
    try {
      window.localStorage.setItem(MAPPING_TEMPLATES_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota / disabled storage.
    }
    setTemplateName("");
  }

  function loadTemplate(id: string) {
    const tpl = templates.find((t) => t.id === id);
    if (tpl) setMapping(tpl.mapping);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const tags = bulkTagsRaw
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter(Boolean);
      const validCount = rows.length - invalidCount - duplicates.length;
      const result = await onSubmit({
        name: name.trim(),
        sabFileId: picked?.id,
        sabFileUrl: picked?.url,
        mapping,
        options: {
          skipSuppressed,
          skipDuplicates,
          consentAttested,
          bulkTags: tags,
          segmentId: segmentId || undefined,
          listId: listId || undefined,
          cronExpression: cronExpression || undefined,
          webhookUrl: webhookUrl || undefined,
        },
        totalRows: rows.length,
        costEstimate: {
          units: Math.max(validCount, 0),
          currency: "USD",
          amount: Math.max(validCount, 0) * 0.0075,
        },
      });
      if (result.ok) {
        onOpenChange(false);
      } else {
        setSubmitError(result.error);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to start import.");
    } finally {
      setSubmitting(false);
    }
  }

  const progressPct = ((stepIndex + 1) / STEPS.length) * 100;

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-0 p-0">
        <ZoruDialogHeader className="border-b border-slate-200 px-6 py-4">
          <ZoruDialogTitle>New import</ZoruDialogTitle>
          <ZoruDialogDescription>
            Step {stepIndex + 1} of {STEPS.length} — {step}
          </ZoruDialogDescription>
          <ZoruProgress value={progressPct} className="mt-3 h-1" />
        </ZoruDialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === "Upload" && (
            <UploadStep
              picked={picked}
              parsing={parsing}
              parseError={parseError}
              rowsCount={rows.length}
              lastImport={lastImport}
              onPick={setPicked}
            />
          )}

          {step === "Mapping" && (
            <MappingStep
              headers={headers}
              mapping={mapping}
              templates={templates}
              templateName={templateName}
              onMappingChange={setMapping}
              onTemplateNameChange={setTemplateName}
              onSaveTemplate={saveTemplate}
              onLoadTemplate={loadTemplate}
            />
          )}

          {step === "Preview" && (
            <PreviewStep
              headers={headers}
              rows={previewRows}
              totalRows={rows.length}
              phoneCol={phoneCol}
              duplicates={duplicates}
              invalidCount={invalidCount}
            />
          )}

          {step === "Options" && (
            <OptionsStep
              skipSuppressed={skipSuppressed}
              skipDuplicates={skipDuplicates}
              consentAttested={consentAttested}
              bulkTagsRaw={bulkTagsRaw}
              segmentId={segmentId}
              listId={listId}
              cronExpression={cronExpression}
              webhookUrl={webhookUrl}
              onSkipSuppressed={setSkipSuppressed}
              onSkipDuplicates={setSkipDuplicates}
              onConsentAttested={setConsentAttested}
              onBulkTagsRaw={setBulkTagsRaw}
              onSegmentId={setSegmentId}
              onListId={setListId}
              onCron={setCronExpression}
              onWebhook={setWebhookUrl}
            />
          )}

          {step === "Confirm" && (
            <ConfirmStep
              name={name}
              onName={setName}
              totalRows={rows.length}
              invalidCount={invalidCount}
              duplicateCount={duplicates.length}
              submitError={submitError}
            />
          )}
        </div>

        <ZoruDialogFooter className="border-t border-slate-200 px-6 py-3">
          <div className="flex w-full items-center justify-between gap-2">
            <ZoruButton
              variant="ghost"
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              disabled={stepIndex === 0 || submitting}
            >
              <ChevronLeft className="mr-1.5 h-4 w-4" />
              Back
            </ZoruButton>
            {step !== "Confirm" ? (
              <ZoruButton
                onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
                disabled={!canAdvance()}
              >
                Next
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </ZoruButton>
            ) : (
              <ZoruButton
                onClick={handleSubmit}
                disabled={!canAdvance() || submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Queuing…
                  </>
                ) : (
                  <>
                    <Upload className="mr-1.5 h-4 w-4" />
                    Start import
                  </>
                )}
              </ZoruButton>
            )}
          </div>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────

function UploadStep({
  picked,
  parsing,
  parseError,
  rowsCount,
  lastImport,
  onPick,
}: {
  picked: SabFilePick | null;
  parsing: boolean;
  parseError: string | null;
  rowsCount: number;
  lastImport?: ImportRecord;
  onPick: (p: SabFilePick) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Drag your CSV into SabFiles, or pick a file already in your library.
        Every imported file lives in SabFiles — we never accept external URLs.
      </p>
      <div className="rounded-md border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
        <Upload className="mx-auto mb-3 h-6 w-6 text-slate-500" />
        <p className="mb-3 text-sm text-slate-600">
          Pick a CSV from SabFiles to begin.
        </p>
        <SabFilePickerButton
          accept="document"
          onPick={onPick}
          variant="default"
        >
          Choose CSV from SabFiles
        </SabFilePickerButton>
      </div>

      {picked && (
        <ZoruAlert variant={parseError ? "default" : "default"}>
          {parsing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <ZoruAlertTitle>{picked.name}</ZoruAlertTitle>
          <ZoruAlertDescription>
            {parsing
              ? "Parsing…"
              : `${rowsCount.toLocaleString()} data row${rowsCount === 1 ? "" : "s"}.`}
            {parseError && <span className="block text-amber-700">{parseError}</span>}
          </ZoruAlertDescription>
        </ZoruAlert>
      )}

      {lastImport && (
        <p className="text-xs text-slate-500">
          Last import: <strong>{lastImport.name}</strong> ·{" "}
          {lastImport.counts.imported.toLocaleString()} contacts imported.
        </p>
      )}
    </div>
  );
}

function MappingStep({
  headers,
  mapping,
  templates,
  templateName,
  onMappingChange,
  onTemplateNameChange,
  onSaveTemplate,
  onLoadTemplate,
}: {
  headers: string[];
  mapping: ColumnMapping;
  templates: MappingTemplate[];
  templateName: string;
  onMappingChange: (m: ColumnMapping) => void;
  onTemplateNameChange: (s: string) => void;
  onSaveTemplate: () => void;
  onLoadTemplate: (id: string) => void;
}) {
  const fields: { key: keyof ColumnMapping; label: string; required?: boolean }[] = [
    { key: "phone", label: "Phone (required)", required: true },
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "tags", label: "Tags" },
  ];
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        Match each contact field to a column in your CSV. We've auto-detected
        the most likely matches — adjust as needed.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <ZoruLabel>{f.label}</ZoruLabel>
            <ZoruSelect
              value={mapping[f.key] ?? "__none__"}
              onValueChange={(v) =>
                onMappingChange({
                  ...mapping,
                  [f.key]: v === "__none__" ? undefined : v,
                })
              }
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="— None —" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="__none__">— None —</ZoruSelectItem>
                {headers.map((h) => (
                  <ZoruSelectItem key={h} value={h}>
                    {h}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
        ))}
      </div>

      <ZoruSeparator />

      <div className="space-y-2">
        <ZoruLabel>Saved mapping templates</ZoruLabel>
        <div className="flex flex-wrap items-center gap-2">
          <ZoruInput
            value={templateName}
            onChange={(e) => onTemplateNameChange(e.target.value)}
            placeholder="Template name"
            className="max-w-xs"
          />
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={onSaveTemplate}
            disabled={!templateName.trim()}
          >
            Save current mapping
          </ZoruButton>
        </div>
        {templates.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {templates.map((t) => (
              <ZoruButton
                key={t.id}
                variant="ghost"
                size="sm"
                onClick={() => onLoadTemplate(t.id)}
              >
                <Tag className="mr-1.5 h-3.5 w-3.5" />
                {t.name}
              </ZoruButton>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewStep({
  headers,
  rows,
  totalRows,
  phoneCol,
  duplicates,
  invalidCount,
}: {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  phoneCol?: string;
  duplicates: string[];
  invalidCount: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ZoruBadge variant="secondary">
          {totalRows.toLocaleString()} total
        </ZoruBadge>
        <ZoruBadge variant="secondary">
          Showing first {rows.length.toLocaleString()}
        </ZoruBadge>
        {duplicates.length > 0 && (
          <ZoruBadge variant="destructive">
            {duplicates.length.toLocaleString()} duplicate phone
            {duplicates.length === 1 ? "" : "s"}
          </ZoruBadge>
        )}
        {invalidCount > 0 && (
          <ZoruBadge variant="destructive">
            {invalidCount.toLocaleString()} invalid phone
            {invalidCount === 1 ? "" : "s"}
          </ZoruBadge>
        )}
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200">
        <div className="max-h-[40vh] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                {headers.map((h) => (
                  <th
                    key={h}
                    className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-700"
                  >
                    {h}
                    {h === phoneCol && (
                      <span className="ml-1.5 text-[10px] text-amber-700">
                        normalised
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="even:bg-slate-50/50">
                  {headers.map((h) => {
                    const raw = r[h] ?? "";
                    const isPhone = h === phoneCol;
                    const norm = isPhone ? normalisePhone(raw) : null;
                    return (
                      <td
                        key={h}
                        className="border-b border-slate-100 px-3 py-1.5 align-top text-slate-700"
                      >
                        {isPhone ? (
                          <span>
                            <code className="text-[11px]">{raw}</code>
                            {norm && norm !== raw && (
                              <span className="ml-1 text-[10px] text-slate-500">
                                → <code>{norm}</code>
                              </span>
                            )}
                            {!norm && (
                              <span className="ml-1 text-[10px] text-red-600">
                                invalid
                              </span>
                            )}
                          </span>
                        ) : (
                          raw
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OptionsStep({
  skipSuppressed,
  skipDuplicates,
  consentAttested,
  bulkTagsRaw,
  segmentId,
  listId,
  cronExpression,
  webhookUrl,
  onSkipSuppressed,
  onSkipDuplicates,
  onConsentAttested,
  onBulkTagsRaw,
  onSegmentId,
  onListId,
  onCron,
  onWebhook,
}: {
  skipSuppressed: boolean;
  skipDuplicates: boolean;
  consentAttested: boolean;
  bulkTagsRaw: string;
  segmentId: string;
  listId: string;
  cronExpression: string;
  webhookUrl: string;
  onSkipSuppressed: (b: boolean) => void;
  onSkipDuplicates: (b: boolean) => void;
  onConsentAttested: (b: boolean) => void;
  onBulkTagsRaw: (s: string) => void;
  onSegmentId: (s: string) => void;
  onListId: (s: string) => void;
  onCron: (s: string) => void;
  onWebhook: (s: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <label className="flex items-start gap-2">
          <ZoruCheckbox
            checked={skipSuppressed}
            onCheckedChange={(v) => onSkipSuppressed(v === true)}
          />
          <span className="text-sm">
            Skip phones already in the suppression list.
          </span>
        </label>
        <label className="flex items-start gap-2">
          <ZoruCheckbox
            checked={skipDuplicates}
            onCheckedChange={(v) => onSkipDuplicates(v === true)}
          />
          <span className="text-sm">
            Skip duplicate phones within this file.
          </span>
        </label>
        <label className="flex items-start gap-2 rounded-md bg-amber-50 p-3">
          <ZoruCheckbox
            checked={consentAttested}
            onCheckedChange={(v) => onConsentAttested(v === true)}
          />
          <span className="text-sm text-amber-900">
            <strong>Consent attestation (required).</strong> I confirm every
            recipient in this file has given prior express written consent to
            receive SMS messages, and that consent records are retained.
          </span>
        </label>
      </div>

      <ZoruSeparator />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <ZoruLabel>Bulk tags (comma-separated)</ZoruLabel>
          <ZoruInput
            value={bulkTagsRaw}
            onChange={(e) => onBulkTagsRaw(e.target.value)}
            placeholder="e.g. webinar-2026, hot-lead"
          />
        </div>
        <div className="space-y-1.5">
          <ZoruLabel>Assign to segment (id)</ZoruLabel>
          <ZoruInput
            value={segmentId}
            onChange={(e) => onSegmentId(e.target.value)}
            placeholder="seg_…"
          />
        </div>
        <div className="space-y-1.5">
          <ZoruLabel>Add to list (id)</ZoruLabel>
          <ZoruInput
            value={listId}
            onChange={(e) => onListId(e.target.value)}
            placeholder="lst_…"
          />
        </div>
        <div className="space-y-1.5">
          <ZoruLabel>Schedule (cron expression)</ZoruLabel>
          <ZoruInput
            value={cronExpression}
            onChange={(e) => onCron(e.target.value)}
            placeholder="0 9 * * 1 (Mondays 9am)"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <ZoruLabel>
            <Webhook className="mr-1 inline h-3.5 w-3.5" />
            On-complete webhook URL
          </ZoruLabel>
          <ZoruInput
            value={webhookUrl}
            onChange={(e) => onWebhook(e.target.value)}
            placeholder="https://example.com/hooks/import"
          />
        </div>
      </div>
    </div>
  );
}

function ConfirmStep({
  name,
  onName,
  totalRows,
  invalidCount,
  duplicateCount,
  submitError,
}: {
  name: string;
  onName: (s: string) => void;
  totalRows: number;
  invalidCount: number;
  duplicateCount: number;
  submitError: string | null;
}) {
  const validRows = Math.max(totalRows - invalidCount - duplicateCount, 0);
  const cost = validRows * 0.0075;
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <ZoruLabel>Import name</ZoruLabel>
        <ZoruInput
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Q1 webinar attendees"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <SummaryStat label="Total" value={totalRows.toLocaleString()} />
        <SummaryStat
          label="Will import"
          value={validRows.toLocaleString()}
          tone="ok"
        />
        <SummaryStat
          label="Cost estimate (HLR)"
          value={`$${cost.toFixed(2)}`}
        />
      </div>
      {submitError && (
        <ZoruAlert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Failed to queue import</ZoruAlertTitle>
          <ZoruAlertDescription>{submitError}</ZoruAlertDescription>
        </ZoruAlert>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok";
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        tone === "ok"
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={`text-lg font-semibold ${
          tone === "ok" ? "text-emerald-900" : "text-slate-800"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
