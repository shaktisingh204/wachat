'use client';

/**
 * SabCRM — CSV/XLSX import dialog.
 *
 * A four-step wizard rendered inside a ZoruUI dialog:
 *
 *   Step 1 – Upload
 *     The user picks a CSV or XLSX file exclusively through
 *     `<SabFileToFileButton>` (SabFiles only; no free-text URL input per
 *     SabNode policy). The file is parsed client-side with PapaParse for
 *     CSV. XLSX is treated as CSV (the server only processes string rows).
 *
 *   Step 2 – Map columns
 *     Shows every CSV header alongside a field selector.  Auto-suggestions
 *     come from `buildColumnMappingSuggestionsAction`.  Required fields with
 *     no mapping are flagged.
 *
 *   Step 3 – Preview
 *     Renders the first MAX_PREVIEW_ROWS rows in their mapped state so the
 *     user can spot formatting issues before committing.
 *
 *   Step 4 – Import
 *     Calls `importRecordsAction` and shows a per-row summary
 *     (succeeded / failed). On completion, calls `onImported` with the
 *     batch result so the host can refresh its table.
 *
 * Design constraints:
 *   - ZoruUI only (Dialog, Button, Select, Badge, Progress, Label, …).
 *   - File inputs via `<SabFileToFileButton>` — never `<input type="file">`.
 *   - All server calls through gated actions in `sabcrm.actions.ts`.
 *   - No `any`. Strict TS throughout.
 */

import * as React from 'react';
import Papa from 'papaparse';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
} from 'lucide-react';

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  cn,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  SabFileToFileButton,
  type SabFilePick,
} from '@/components/sabfiles';
import {
  buildColumnMappingSuggestionsAction,
  importRecordsAction,
} from '@/app/actions/sabcrm.actions';
import type { MappingValidationIssue } from '@/app/actions/sabcrm.actions.types';
import type {
  FieldMetadata,
  ObjectMetadata,
} from '@/lib/sabcrm/types';
import type { ImportBatchResult, ColumnMapping, RawRow } from '@/lib/sabcrm/import-export.server';

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

/** Maximum rows shown in the preview table (client only). */
const MAX_PREVIEW_ROWS = 5;

/** Accepted file MIME types for the SabFiles picker. */
const ACCEPTED_MIMES = ['text/csv', 'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

type WizardStep = 'upload' | 'mapping' | 'preview' | 'import';

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'mapping', label: 'Map columns' },
  { id: 'preview', label: 'Preview' },
  { id: 'import', label: 'Import' },
];

export interface ImportDialogProps {
  /** The CRM object metadata — used for field labels, types, required flags. */
  object: ObjectMetadata;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Active project override forwarded to the server action. */
  projectId?: string;
  /** Called with the batch result after a successful (even partial) import. */
  onImported?: (result: ImportBatchResult) => void;
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                            */
/* -------------------------------------------------------------------------- */

/** Fields importable via CSV (excludes RELATION and FILE). */
function importableFields(object: ObjectMetadata): FieldMetadata[] {
  return object.fields.filter(
    (f) => f.type !== 'RELATION' && f.type !== 'FILE',
  );
}

/** Human-readable type hint for the mapping step. */
function typeBadge(field: FieldMetadata): string {
  switch (field.type) {
    case 'TEXT':       return 'Text';
    case 'NUMBER':     return 'Number';
    case 'CURRENCY':   return 'Currency';
    case 'BOOLEAN':    return 'Bool';
    case 'DATE':       return 'Date';
    case 'DATE_TIME':  return 'DateTime';
    case 'EMAIL':      return 'Email';
    case 'PHONE':      return 'Phone';
    case 'LINK':       return 'Link';
    case 'SELECT':     return 'Select';
    case 'MULTI_SELECT': return 'Multi';
    case 'RATING':     return 'Rating';
    default:           return field.type;
  }
}

/**
 * Tries to parse text as CSV.  Returns `{ headers, rows }` or throws.
 * Works for both CSV and simple TSV (PapaParse auto-detects the delimiter).
 */
function parseCsv(text: string): { headers: string[]; rows: RawRow[] } {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const headers = result.meta.fields ?? [];
  // Coerce every cell to string (PapaParse returns `any`).
  const rows: RawRow[] = result.data.map((row) => {
    const out: RawRow = {};
    for (const h of headers) {
      const v = (row as Record<string, unknown>)[h];
      out[h] = v == null ? '' : String(v).trim();
    }
    return out;
  });
  return { headers, rows };
}

/* -------------------------------------------------------------------------- */
/* Step indicator                                                              */
/* -------------------------------------------------------------------------- */

function StepIndicator({
  steps,
  current,
}: {
  steps: typeof STEPS;
  current: WizardStep;
}): React.ReactElement {
  const currentIndex = steps.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center gap-0" aria-label="Import steps">
      {steps.map((step, idx) => {
        const done = idx < currentIndex;
        const active = idx === currentIndex;
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                  done &&
                    'border-[var(--st-text)] bg-[var(--st-text)] text-[var(--st-bg)]',
                  active &&
                    'border-[var(--st-text)] bg-[var(--st-bg)] text-[var(--st-text)]',
                  !done && !active &&
                    'border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]',
                )}
                aria-current={active ? 'step' : undefined}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
              </div>
              <span
                className={cn(
                  'hidden text-[10px] leading-none sm:block',
                  active ? 'font-medium text-[var(--st-text)]' : 'text-[var(--st-text-secondary)]',
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  'mb-4 h-px flex-1 transition-colors',
                  idx < currentIndex ? 'bg-[var(--st-text)]' : 'bg-[var(--st-border)]',
                )}
                aria-hidden
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 1 — Upload                                                             */
/* -------------------------------------------------------------------------- */

interface UploadStepProps {
  onParsed: (params: {
    pick: SabFilePick;
    headers: string[];
    rows: RawRow[];
  }) => void;
}

function UploadStep({ onParsed }: UploadStepProps): React.ReactElement {
  const { toast } = useZoruToast();
  const [busy, setBusy] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);

  const handlePickFile = React.useCallback(
    async (file: File, pick: SabFilePick) => {
      setBusy(true);
      try {
        let text: string;
        const mime = file.type.toLowerCase();
        if (
          mime.includes('spreadsheetml') ||
          mime.includes('ms-excel') ||
          file.name.toLowerCase().endsWith('.xlsx') ||
          file.name.toLowerCase().endsWith('.xls')
        ) {
          // XLSX: use SheetJS when available, otherwise inform the user to
          // export as CSV first. We avoid bundling SheetJS to keep the chunk
          // small and because xlsx is not in the project's dependencies.
          toast({
            title: 'Use CSV format',
            description:
              'Please export your spreadsheet as CSV before importing.',
            variant: 'destructive',
          });
          setBusy(false);
          return;
        } else {
          text = await file.text();
        }

        const { headers, rows } = parseCsv(text);

        if (headers.length === 0) {
          toast({
            title: 'Empty file',
            description: 'The selected file has no column headers.',
            variant: 'destructive',
          });
          setBusy(false);
          return;
        }

        if (rows.length === 0) {
          toast({
            title: 'No data',
            description: 'The file has headers but no data rows.',
            variant: 'destructive',
          });
          setBusy(false);
          return;
        }

        setFileName(pick.name);
        onParsed({ pick, headers, rows });
      } catch (e) {
        toast({
          title: 'Parse error',
          description:
            e instanceof Error ? e.message : 'Could not parse the file.',
          variant: 'destructive',
        });
      } finally {
        setBusy(false);
      }
    },
    [onParsed, toast],
  );

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div
        className={cn(
          'flex w-full flex-col items-center gap-4 rounded-[var(--zoru-radius-lg)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)]/40 p-8 text-center',
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--st-border)] bg-[var(--st-bg)]">
          <FileSpreadsheet className="h-5 w-5 text-[var(--st-text-secondary)]" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-[var(--st-text)]">
            {fileName ? fileName : 'Pick a CSV file from SabFiles'}
          </p>
          <p className="text-xs text-[var(--st-text-secondary)]">
            CSV format · up to 5,000 rows per import
          </p>
        </div>
        <SabFileToFileButton
          onPickFile={handlePickFile}
          variant="outline"
          className="gap-2"
          // Limit to document/all so SabFiles shows relevant files.
          accept="all"
        >
          {busy ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {fileName ? 'Change file' : 'Choose from SabFiles'}
        </SabFileToFileButton>
      </div>

      <div className="w-full rounded-[var(--zoru-radius-md)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]/40 p-4 text-xs text-[var(--st-text-secondary)]">
        <p className="font-medium text-[var(--st-text)]">Tips</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>The first row must be a header row.</li>
          <li>
            RELATION and FILE fields are not importable via CSV — set them in
            the record detail after import.
          </li>
          <li>
            Boolean fields accept: <code>true / false / yes / no / 1 / 0</code>.
          </li>
          <li>
            SELECT fields must match one of the configured option values (case-insensitive).
          </li>
        </ul>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 2 — Mapping                                                            */
/* -------------------------------------------------------------------------- */

interface MappingStepProps {
  csvHeaders: string[];
  rowCount: number;
  fields: FieldMetadata[];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
  issues: MappingValidationIssue[];
}

/**
 * Inverted mapping: field key → CSV header.
 * The server-side `ColumnMapping` type is `fieldKey → csvHeader`.
 */
function MappingStep({
  csvHeaders,
  rowCount,
  fields,
  mapping,
  onChange,
  issues,
}: MappingStepProps): React.ReactElement {
  const issuesByField = React.useMemo(() => {
    const m = new Map<string, MappingValidationIssue[]>();
    for (const issue of issues) {
      if (issue.fieldKey) {
        const prev = m.get(issue.fieldKey) ?? [];
        m.set(issue.fieldKey, [...prev, issue]);
      }
    }
    return m;
  }, [issues]);

  const topIssues = issues.filter((i) => !i.fieldKey);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-[var(--st-text-secondary)]">
        <span>
          <strong className="text-[var(--st-text)]">{csvHeaders.length}</strong> columns
          detected · <strong className="text-[var(--st-text)]">{rowCount}</strong> data rows
        </span>
      </div>

      {topIssues.length > 0 && (
        <div className="rounded-[var(--zoru-radius-md)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]/40 p-3 text-xs text-[var(--st-text-secondary)]">
          {topIssues.map((issue, idx) => (
            <p key={idx} className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--st-danger)]" />
              {issue.message}
            </p>
          ))}
        </div>
      )}

      {/* Table header */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 pb-1 text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        <span>CSV column</span>
        <span className="w-4" />
        <span>CRM field</span>
      </div>

      <Separator />

      {/* One row per CRM importable field */}
      <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: '280px' }}>
        {fields.map((field) => {
          const fieldIssues = issuesByField.get(field.key) ?? [];
          const hasIssue = fieldIssues.length > 0;

          return (
            <div key={field.key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3">
              {/* CSV header selector */}
              <Select
                value={mapping[field.key] ?? '__none__'}
                onValueChange={(val) => {
                  const next = { ...mapping };
                  if (val === '__none__') {
                    delete next[field.key];
                  } else {
                    next[field.key] = val;
                  }
                  onChange(next);
                }}
              >
                <SelectTrigger
                  className={cn(
                    'h-8 text-xs',
                    hasIssue && 'border-[var(--st-danger)] focus:ring-[var(--st-danger)]',
                  )}
                >
                  <SelectValue placeholder="Not mapped" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="italic text-[var(--st-text-secondary)]">Not mapped</span>
                  </SelectItem>
                  {csvHeaders.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Arrow */}
              <ArrowRight className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />

              {/* Field descriptor */}
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-[var(--st-text)]">
                    {field.label}
                  </span>
                  {field.required && (
                    <span className="text-[10px] text-[var(--st-danger)]" aria-label="required">
                      *
                    </span>
                  )}
                  <Badge
                    variant="outline"
                    className="h-4 px-1 py-0 text-[9px] font-normal"
                  >
                    {typeBadge(field)}
                  </Badge>
                </div>
                {hasIssue && (
                  <p className="text-[10px] text-[var(--st-danger)]">
                    {fieldIssues[0].message}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[var(--st-text-secondary)]">
        Fields marked <span className="text-[var(--st-danger)]">*</span> are required.
        Unmapped required fields with no default value will cause row errors.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 3 — Preview                                                            */
/* -------------------------------------------------------------------------- */

interface PreviewStepProps {
  csvHeaders: string[];
  rows: RawRow[];
  mapping: ColumnMapping;
  fields: FieldMetadata[];
}

function PreviewStep({
  csvHeaders,
  rows,
  mapping,
  fields,
}: PreviewStepProps): React.ReactElement {
  const preview = rows.slice(0, MAX_PREVIEW_ROWS);

  // Only show columns that have a mapping, in mapping order.
  const mappedFieldKeys = fields
    .filter((f) => mapping[f.key])
    .map((f) => f.key);

  const fieldByKey = new Map<string, FieldMetadata>(
    fields.map((f) => [f.key, f]),
  );

  if (mappedFieldKeys.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <AlertCircle className="h-8 w-8 text-[var(--st-text-secondary)]" />
        <p className="text-sm text-[var(--st-text-secondary)]">
          No columns are mapped yet. Go back and map at least one column to see
          a preview.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-[var(--st-text-secondary)]">
        Showing the first{' '}
        <strong className="text-[var(--st-text)]">
          {Math.min(preview.length, MAX_PREVIEW_ROWS)}
        </strong>{' '}
        of <strong className="text-[var(--st-text)]">{rows.length}</strong> rows after
        mapping.
      </p>

      {/* Scrollable preview table */}
      <div className="overflow-auto rounded-[var(--zoru-radius-md)] border border-[var(--st-border)]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]/60">
              <th className="px-2 py-2 text-left font-medium text-[var(--st-text-secondary)]">
                #
              </th>
              {mappedFieldKeys.map((key) => (
                <th
                  key={key}
                  className="whitespace-nowrap px-3 py-2 text-left font-medium text-[var(--st-text-secondary)]"
                >
                  {fieldByKey.get(key)?.label ?? key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="border-b border-[var(--st-border)]/50 last:border-0 hover:bg-[var(--st-bg-secondary)]/40"
              >
                <td className="px-2 py-1.5 text-[var(--st-text-secondary)]">
                  {rowIdx + 1}
                </td>
                {mappedFieldKeys.map((key) => {
                  const csvHeader = mapping[key];
                  const raw = csvHeader ? (row[csvHeader] ?? '') : '';
                  return (
                    <td
                      key={key}
                      className="max-w-[180px] truncate px-3 py-1.5 text-[var(--st-text)]"
                      title={raw}
                    >
                      {raw || (
                        <span className="text-[var(--st-text-secondary)]">(empty)</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > MAX_PREVIEW_ROWS && (
        <p className="text-xs text-[var(--st-text-secondary)]">
          … and {rows.length - MAX_PREVIEW_ROWS} more rows not shown.
        </p>
      )}

      {/* Unmapped CSV headers notice */}
      {(() => {
        const mappedCsvHeaders = new Set(Object.values(mapping));
        const unmapped = csvHeaders.filter((h) => !mappedCsvHeaders.has(h));
        if (unmapped.length === 0) return null;
        return (
          <p className="text-xs text-[var(--st-text-secondary)]">
            <strong className="text-[var(--st-text)]">{unmapped.length}</strong> CSV
            column{unmapped.length !== 1 ? 's' : ''} not mapped and will be
            ignored: {unmapped.map((h) => `"${h}"`).join(', ')}.
          </p>
        );
      })()}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 4 — Import (result view)                                              */
/* -------------------------------------------------------------------------- */

interface ImportStepProps {
  result: ImportBatchResult | null;
  busy: boolean;
}

function ImportStep({ result, busy }: ImportStepProps): React.ReactElement {
  if (busy) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--st-text-secondary)]" />
        <p className="text-sm text-[var(--st-text-secondary)]">Importing records…</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <p className="text-sm text-[var(--st-text-secondary)]">Ready to import.</p>
      </div>
    );
  }

  const pct =
    result.total > 0
      ? Math.round((result.succeeded / result.total) * 100)
      : 0;

  // Collect failed rows with their first error message.
  const failedRows: { index: number; errors: string[] }[] = [];
  result.rows.forEach((r, i) => {
    if (!r.ok) failedRows.push({ index: i + 1, errors: r.errors });
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center gap-1 rounded-[var(--zoru-radius-md)] border border-[var(--st-border)] p-3">
          <span className="text-2xl font-bold text-[var(--st-text)]">{result.total}</span>
          <span className="text-xs text-[var(--st-text-secondary)]">Total</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-[var(--zoru-radius-md)] border border-[var(--st-border)] p-3">
          <span className="flex items-center gap-1 text-2xl font-bold text-[var(--st-text)]">
            <CheckCircle2 className="h-5 w-5 text-[var(--st-status-ok)]" />
            {result.succeeded}
          </span>
          <span className="text-xs text-[var(--st-text-secondary)]">Imported</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-[var(--zoru-radius-md)] border border-[var(--st-border)] p-3">
          <span className="flex items-center gap-1 text-2xl font-bold text-[var(--st-text)]">
            {result.failed > 0 && (
              <XCircle className="h-5 w-5 text-[var(--st-danger)]" />
            )}
            {result.failed}
          </span>
          <span className="text-xs text-[var(--st-text-secondary)]">Failed</span>
        </div>
      </div>

      <Progress value={pct} className="h-1.5" />

      {/* Failed row list (capped at 20 for UI sanity) */}
      {failedRows.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-[var(--st-text)]">
            Failed rows ({failedRows.length})
          </p>
          <div
            className="overflow-y-auto rounded-[var(--zoru-radius-md)] border border-[var(--st-border)]"
            style={{ maxHeight: '180px' }}
          >
            {failedRows.slice(0, 20).map(({ index, errors }) => (
              <div
                key={index}
                className="flex gap-2 border-b border-[var(--st-border)]/50 px-3 py-2 text-xs last:border-0"
              >
                <span className="shrink-0 font-medium text-[var(--st-text-secondary)]">
                  Row {index}
                </span>
                <span className="text-[var(--st-danger)]">{errors[0]}</span>
              </div>
            ))}
            {failedRows.length > 20 && (
              <p className="px-3 py-2 text-xs text-[var(--st-text-secondary)]">
                … and {failedRows.length - 20} more.
              </p>
            )}
          </div>
        </div>
      )}

      {result.succeeded === result.total && result.total > 0 && (
        <div className="flex items-center gap-2 rounded-[var(--zoru-radius-md)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]/40 px-3 py-2 text-xs text-[var(--st-text)]">
          <CheckCircle2 className="h-4 w-4 text-[var(--st-status-ok)]" />
          All {result.total} records imported successfully.
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main dialog                                                                 */
/* -------------------------------------------------------------------------- */

export function ImportDialog({
  object,
  open,
  onOpenChange,
  projectId,
  onImported,
}: ImportDialogProps): React.ReactElement {
  const { toast } = useZoruToast();

  // Wizard state
  const [step, setStep] = React.useState<WizardStep>('upload');

  // Upload state
  const [csvHeaders, setCsvHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<RawRow[]>([]);

  // Mapping state
  const [mapping, setMapping] = React.useState<ColumnMapping>({});
  const [mappingIssues, setMappingIssues] = React.useState<MappingValidationIssue[]>([]);
  const [suggestBusy, setSuggestBusy] = React.useState(false);

  // Import state
  const [importResult, setImportResult] = React.useState<ImportBatchResult | null>(null);
  const [importBusy, setImportBusy] = React.useState(false);

  const fields = React.useMemo(() => importableFields(object), [object]);

  // Reset on close / reopen
  React.useEffect(() => {
    if (!open) return;
    setStep('upload');
    setCsvHeaders([]);
    setRows([]);
    setMapping({});
    setMappingIssues([]);
    setImportResult(null);
    setImportBusy(false);
  }, [open]);

  /* ── Step 1 → 2: file parsed ─────────────────────────────────────────── */

  const handleParsed = React.useCallback(
    async ({
      headers,
      rows: parsedRows,
    }: {
      pick: SabFilePick;
      headers: string[];
      rows: RawRow[];
    }) => {
      setCsvHeaders(headers);
      setRows(parsedRows);

      // Auto-suggest mapping from the server.
      setSuggestBusy(true);
      const res = await buildColumnMappingSuggestionsAction(
        object.slug,
        headers,
        projectId,
      );
      setSuggestBusy(false);

      if (res.ok) {
        setMapping(res.data);
      }

      setStep('mapping');
    },
    [object.slug, projectId],
  );

  /* ── Step 2 → 3: validate mapping ────────────────────────────────────── */

  const goToPreview = React.useCallback(async () => {
    // Client-side check: at least one field mapped.
    if (Object.keys(mapping).length === 0) {
      toast({
        title: 'No columns mapped',
        description: 'Map at least one CSV column to a CRM field.',
        variant: 'destructive',
      });
      return;
    }

    // Check for required fields with no mapping and no default.
    const requiredUnmapped = fields.filter(
      (f) =>
        f.required &&
        f.defaultValue === undefined &&
        !mapping[f.key],
    );
    if (requiredUnmapped.length > 0) {
      const names = requiredUnmapped.map((f) => f.label).join(', ');
      const newIssues: MappingValidationIssue[] = requiredUnmapped.map((f) => ({
        kind: 'required_unmapped',
        fieldKey: f.key,
        fieldLabel: f.label,
        message: `Required field "${f.label}" has no column mapping and no default value.`,
      }));
      setMappingIssues(newIssues);
      toast({
        title: 'Required fields unmapped',
        description: `Map these fields or they will cause row errors: ${names}.`,
        variant: 'destructive',
      });
      return;
    }

    setMappingIssues([]);
    setStep('preview');
  }, [mapping, fields, toast]);

  /* ── Step 4: run import ───────────────────────────────────────────────── */

  const runImport = React.useCallback(async () => {
    if (importBusy) return;
    setImportBusy(true);

    const res = await importRecordsAction(
      {
        object: object.slug,
        columnMapping: mapping,
        rows,
        stopOnFirstError: false,
      },
      projectId,
    );

    setImportBusy(false);

    if (!res.ok) {
      toast({
        title: 'Import failed',
        description: res.error,
        variant: 'destructive',
      });
      return;
    }

    setImportResult(res.data);
    onImported?.(res.data);

    if (res.data.failed === 0) {
      toast({ title: `${res.data.succeeded} records imported.` });
    } else {
      toast({
        title: `Import complete with ${res.data.failed} error(s)`,
        description: `${res.data.succeeded} succeeded, ${res.data.failed} failed.`,
        variant: 'destructive',
      });
    }
  }, [importBusy, object.slug, mapping, rows, projectId, onImported, toast]);

  /* ── Navigation ───────────────────────────────────────────────────────── */

  const currentIndex = STEPS.findIndex((s) => s.id === step);

  const handleBack = React.useCallback(() => {
    if (currentIndex > 0) {
      setStep(STEPS[currentIndex - 1].id);
    }
  }, [currentIndex]);

  const handleNext = React.useCallback(async () => {
    if (step === 'mapping') {
      await goToPreview();
      return;
    }
    if (step === 'preview') {
      setStep('import');
      await runImport();
      return;
    }
    if (currentIndex < STEPS.length - 1) {
      setStep(STEPS[currentIndex + 1].id);
    }
  }, [step, currentIndex, goToPreview, runImport]);

  const nextLabel = (() => {
    if (step === 'preview') return 'Start import';
    if (step === 'import') return 'Done';
    return 'Next';
  })();

  const canGoNext = (() => {
    if (step === 'upload') return false; // progresses via onParsed
    if (step === 'import') return !importBusy;
    return true;
  })();

  const isDone = step === 'import' && !importBusy;

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="border-b border-[var(--st-border)] p-5">
          <DialogTitle>
            Import {object.labelPlural.toLowerCase()}
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file, map its columns to CRM fields, then import.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="border-b border-[var(--st-border)] px-5 py-4">
          <StepIndicator steps={STEPS} current={step} />
          {suggestBusy && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--st-text-secondary)]">
              <Loader2 className="h-3 w-3 animate-spin" />
              Auto-detecting column mapping…
            </p>
          )}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === 'upload' && <UploadStep onParsed={handleParsed} />}

          {step === 'mapping' && (
            <MappingStep
              csvHeaders={csvHeaders}
              rowCount={rows.length}
              fields={fields}
              mapping={mapping}
              onChange={setMapping}
              issues={mappingIssues}
            />
          )}

          {step === 'preview' && (
            <PreviewStep
              csvHeaders={csvHeaders}
              rows={rows}
              mapping={mapping}
              fields={fields}
            />
          )}

          {step === 'import' && (
            <ImportStep result={importResult} busy={importBusy} />
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)]/40 p-4">
          {isDone ? (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={currentIndex === 0 || importBusy}
                onClick={handleBack}
                className="gap-1"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              {step !== 'upload' && (
                <Button
                  type="button"
                  disabled={!canGoNext || importBusy}
                  onClick={handleNext}
                  className="gap-1"
                >
                  {importBusy ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  {nextLabel}
                  {step !== 'preview' && !importBusy && (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
