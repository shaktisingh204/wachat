"use client";

/**
 * SabSMS imports - multi-step wizard component.
 *
 * Mounts inside a Dialog from `imports-table.tsx`. Drives the user
 * through: file pick (SabFiles) -> column mapping -> preview + dedupe ->
 * options (consent / suppression / tags / segment / cron / webhook) ->
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
  Tag as TagIcon,
  Upload,
  Webhook,
} from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Label,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/sabcrm/20ui";
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
  const [totalRows, setTotalRows] = React.useState<number>(0);
  const [aiMappingLoading, setAiMappingLoading] = React.useState(false);
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
      // Corrupt local storage - fall back to empty.
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

  // Parse CSV when a SabFile is picked (Chunked to prevent timeout on large files).
  React.useEffect(() => {
    if (!picked?.url) return undefined;
    let cancelled = false;
    setParsing(true);
    setParseError(null);
    (async () => {
      try {
        const res = await fetch(picked.url);
        if (!res.body) throw new Error("No response body.");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let firstChunk = "";
        let lineCount = 0;
        let gotPreview = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!gotPreview) {
            firstChunk += chunk;
            if (firstChunk.length > 50000 || firstChunk.split("\n").length > 50) {
              gotPreview = true;
              const lines = firstChunk.split("\n");
              firstChunk = lines.slice(0, 50).join("\n");
            }
          }
          for (let i = 0; i < chunk.length; i++) {
            if (chunk[i] === '\n') lineCount++;
          }
        }
        if (cancelled) return;

        setTotalRows(Math.max(lineCount - 1, 0));
        const parsed = parseCsv(firstChunk);
        setHeaders(parsed.headers);
        setRows(parsed.rows);
        setMapping(inferColumnMapping(parsed.headers));
        setName(picked.name.replace(/\.csv$/i, ""));
        if (parsed.errors.length > 0) {
          setParseError(`Preview parsed with warnings.`);
        }
      } catch (err) {
        if (!cancelled) setParseError(err instanceof Error ? err.message : "Failed to read CSV file.");
      } finally {
        if (!cancelled) setParsing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [picked]);

  // AI-powered mapping
  const handleAiMapping = React.useCallback(async () => {
    if (headers.length === 0 || rows.length === 0) return;
    setAiMappingLoading(true);
    try {
      const res = await fetch("/api/sabsms/imports/ai-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers, sampleRows: rows.slice(0, 3) })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.mapping) {
          setMapping(data.mapping);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiMappingLoading(false);
    }
  }, [headers, rows]);

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
      const validCount = Math.max(totalRows - invalidCount - duplicates.length, 0);
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
        totalRows: totalRows,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-[var(--st-border)] px-6 py-4">
          <DialogTitle>New import</DialogTitle>
          <DialogDescription>
            Step {stepIndex + 1} of {STEPS.length} - {step}
          </DialogDescription>
          <Progress value={progressPct} size="sm" className="mt-3" aria-label="Import progress" />
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === "Upload" && (
            <UploadStep
              picked={picked}
              parsing={parsing}
              parseError={parseError}
              rowsCount={totalRows}
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
              aiMappingLoading={aiMappingLoading}
              onAiMapping={handleAiMapping}
            />
          )}

          {step === "Preview" && (
            <PreviewStep
              headers={headers}
              rows={previewRows}
              totalRows={totalRows}
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
              totalRows={totalRows}
              invalidCount={invalidCount}
              duplicateCount={duplicates.length}
              submitError={submitError}
            />
          )}
        </div>

        <DialogFooter className="border-t border-[var(--st-border)] px-6 py-3">
          <div className="flex w-full items-center justify-between gap-2">
            <Button
              variant="ghost"
              iconLeft={ChevronLeft}
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              disabled={stepIndex === 0 || submitting}
            >
              Back
            </Button>
            {step !== "Confirm" ? (
              <Button
                variant="primary"
                iconRight={ChevronRight}
                onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
                disabled={!canAdvance()}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="primary"
                iconLeft={submitting ? undefined : Upload}
                loading={submitting}
                onClick={handleSubmit}
                disabled={!canAdvance() || submitting}
              >
                {submitting ? "Queuing" : "Start import"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Steps ------------------------------------------------------------------

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
      <p className="text-sm text-[var(--st-text)]">
        Drag your CSV into SabFiles, or pick a file already in your library.
        Every imported file lives in SabFiles, we never accept external URLs.
      </p>
      <div className="rounded-[var(--st-radius)] border-2 border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-6 py-8 text-center">
        <Upload className="mx-auto mb-3 h-6 w-6 text-[var(--st-text-secondary)]" aria-hidden="true" />
        <p className="mb-3 text-sm text-[var(--st-text)]">
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
        <Alert
          tone={parseError ? "warning" : "success"}
          icon={parsing ? Loader2 : CheckCircle2}
          title={picked.name}
        >
          {parsing
            ? "Parsing"
            : `${rowsCount.toLocaleString()} data row${rowsCount === 1 ? "" : "s"}.`}
          {parseError && (
            <span className="block text-[var(--st-text-secondary)]">{parseError}</span>
          )}
        </Alert>
      )}

      {lastImport && (
        <p className="text-xs text-[var(--st-text-secondary)]">
          Last import: <strong>{lastImport.name}</strong> ,{" "}
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
  aiMappingLoading,
  onAiMapping,
}: {
  aiMappingLoading?: boolean;
  onAiMapping?: () => void;
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
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-[var(--st-text)] max-w-xl">
          Match each contact field to a column in your CSV. We have auto-detected
          the most likely matches, adjust as needed.
        </p>
        <Button
          variant="outline"
          size="sm"
          loading={aiMappingLoading}
          onClick={onAiMapping}
          disabled={aiMappingLoading}
        >
          AI Automap
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label>{f.label}</Label>
            <Select
              value={mapping[f.key] ?? "__none__"}
              onValueChange={(v) =>
                onMappingChange({
                  ...mapping,
                  [f.key]: v === "__none__" ? undefined : v,
                })
              }
            >
              <SelectTrigger aria-label={f.label}>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {headers.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <Separator />

      <div className="space-y-2">
        <Field label="Saved mapping templates">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={templateName}
              onChange={(e) => onTemplateNameChange(e.target.value)}
              placeholder="Template name"
              className="max-w-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={onSaveTemplate}
              disabled={!templateName.trim()}
            >
              Save current mapping
            </Button>
          </div>
        </Field>
        {templates.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {templates.map((t) => (
              <Button
                key={t.id}
                variant="ghost"
                size="sm"
                iconLeft={TagIcon}
                onClick={() => onLoadTemplate(t.id)}
              >
                {t.name}
              </Button>
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
        <Badge variant="secondary">
          {totalRows.toLocaleString()} total
        </Badge>
        <Badge variant="secondary">
          Showing first {rows.length.toLocaleString()}
        </Badge>
        {duplicates.length > 0 && (
          <Badge variant="destructive">
            {duplicates.length.toLocaleString()} duplicate phone
            {duplicates.length === 1 ? "" : "s"}
          </Badge>
        )}
        {invalidCount > 0 && (
          <Badge variant="destructive">
            {invalidCount.toLocaleString()} invalid phone
            {invalidCount === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
        <div className="max-h-[40vh] overflow-auto">
          <Table density="compact" stickyHeader className="text-xs">
            <THead>
              <Tr>
                {headers.map((h) => (
                  <Th key={h}>
                    {h}
                    {h === phoneCol && (
                      <span className="ml-1.5 text-[10px] text-[var(--st-text-tertiary)]">
                        normalised
                      </span>
                    )}
                  </Th>
                ))}
              </Tr>
            </THead>
            <TBody>
              {rows.map((r, i) => (
                <Tr key={i}>
                  {headers.map((h) => {
                    const raw = r[h] ?? "";
                    const isPhone = h === phoneCol;
                    const norm = isPhone ? normalisePhone(raw) : null;
                    return (
                      <Td key={h} className="align-top text-[var(--st-text)]">
                        {isPhone ? (
                          <span>
                            <code className="text-[11px]">{raw}</code>
                            {norm && norm !== raw && (
                              <span className="ml-1 text-[10px] text-[var(--st-text-secondary)]">
                                {"-> "}
                                <code>{norm}</code>
                              </span>
                            )}
                            {!norm && (
                              <span className="ml-1 text-[10px] text-[var(--st-danger)]">
                                invalid
                              </span>
                            )}
                          </span>
                        ) : (
                          raw
                        )}
                      </Td>
                    );
                  })}
                </Tr>
              ))}
            </TBody>
          </Table>
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
        <Checkbox
          checked={skipSuppressed}
          onChange={(e) => onSkipSuppressed(e.target.checked)}
          className="items-start"
          label={
            <span className="text-sm text-[var(--st-text)]">
              Skip phones already in the suppression list.
            </span>
          }
        />
        <Checkbox
          checked={skipDuplicates}
          onChange={(e) => onSkipDuplicates(e.target.checked)}
          className="items-start"
          label={
            <span className="text-sm text-[var(--st-text)]">
              Skip duplicate phones within this file.
            </span>
          }
        />
        <Checkbox
          checked={consentAttested}
          onChange={(e) => onConsentAttested(e.target.checked)}
          className="items-start rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] p-3"
          label={
            <span className="text-sm text-[var(--st-text)]">
              <strong>Consent attestation (required).</strong> I confirm every
              recipient in this file has given prior express written consent to
              receive SMS messages, and that consent records are retained.
            </span>
          }
        />
      </div>

      <Separator />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Bulk tags (comma-separated)">
          <Input
            value={bulkTagsRaw}
            onChange={(e) => onBulkTagsRaw(e.target.value)}
            placeholder="e.g. webinar-2026, hot-lead"
          />
        </Field>
        <Field label="Assign to segment (id)">
          <Input
            value={segmentId}
            onChange={(e) => onSegmentId(e.target.value)}
            placeholder="seg_..."
          />
        </Field>
        <Field label="Add to list (id)">
          <Input
            value={listId}
            onChange={(e) => onListId(e.target.value)}
            placeholder="lst_..."
          />
        </Field>
        <Field label="Schedule (cron expression)">
          <Input
            value={cronExpression}
            onChange={(e) => onCron(e.target.value)}
            placeholder="0 9 * * 1 (Mondays 9am)"
          />
        </Field>
        <Field
          className="sm:col-span-2"
          label={
            <span className="inline-flex items-center gap-1">
              <Webhook className="h-3.5 w-3.5" aria-hidden="true" />
              On-complete webhook URL
            </span>
          }
        >
          <Input
            type="url"
            value={webhookUrl}
            onChange={(e) => onWebhook(e.target.value)}
            placeholder="https://example.com/hooks/import"
          />
        </Field>
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
      <Field label="Import name">
        <Input
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Q1 webinar attendees"
        />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total" value={totalRows.toLocaleString()} />
        <StatCard label="Will import" value={validRows.toLocaleString()} />
        <StatCard label="Cost estimate (HLR)" value={`$${cost.toFixed(2)}`} />
      </div>
      {submitError && (
        <Alert tone="danger" icon={AlertCircle}>
          <AlertTitle>Failed to queue import</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
