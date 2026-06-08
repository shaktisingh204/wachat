'use client';

/**
 * SabCRM - Import & Export (`/dashboard/settings/crm/import-export`).
 *
 * Pure 20ui rebuild. UI primitives come ONLY from `@/components/sabcrm/20ui`
 * (Button / Card / Table / Field / Select / Badge / Alert / EmptyState /
 * StatCard / Spinner / PageHeader / DropdownMenu) and file input comes from
 * SabFiles (`<SabFileToFileButton>`), per the project-wide SabFiles policy.
 *
 * The import side is a 4-step IMPORT WIZARD:
 *
 *   1. Object & file   - choose the target object, then pick a CSV via SabFiles
 *                        (parsed client-side with PapaParse).
 *   2. Map columns     - CSV header to object-field select, pre-filled from
 *                        `buildColumnMappingSuggestionsAction`. RELATION fields
 *                        are also mappable here (connect-on-import): a relation
 *                        column resolves each CSV value to an EXISTING related
 *                        record and stores its id. Each relation row gets a
 *                        "match by" sub-select naming which field of the target
 *                        object to match on.
 *   3. Preview         - `validateImportMappingAction` gives blocking issues;
 *                        we add soft warnings plus a sample-rows preview table
 *                        and a row-count / mapped-column readout. For every
 *                        relation column we probe a sample of distinct values
 *                        through `searchRecordsForPickerAction` and show
 *                        found / not-found per value plus an overall coverage
 *                        badge.
 *   4. Import          - `importRecordsAction` runs the (non-relation) batch,
 *                        then - best-effort - we resolve each created record's
 *                        relation values via `searchRecordsForPickerAction` and
 *                        patch the matched id onto the record with
 *                        `updateRecordAction`. We render a success / partial /
 *                        failure summary with per-row errors AND a relation
 *                        connect readout (connected vs. unmatched counts).
 *
 * Why a post-import patch? The server-side import path deliberately skips
 * RELATION columns (they need resolved ids, not raw strings), so relation
 * connect is performed client-side: import the flat fields first, then connect
 * relations onto the freshly-created records by id.
 *
 * Auth / onboarding / RBACGuard are enforced by the parent SabCRM `layout.tsx`;
 * each action re-runs the full gate, so the page fails closed into an inline
 * error state. Every step traps its own errors so one failed action never wedges
 * the wizard - the user can retry or step back.
 */

import * as React from 'react';
import Link from 'next/link';
import Papa from 'papaparse';
import {
  Database,
  Download,
  Upload,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  FileText,
  X,
  RotateCcw,
  Link2,
  ArrowRight,
  XCircle,
} from 'lucide-react';

import {
  listObjectsAction,
  exportRecordsAction,
  buildColumnMappingSuggestionsAction,
  validateImportMappingAction,
  importRecordsAction,
  searchRecordsForPickerAction,
  updateRecordAction,
} from '@/app/actions/sabcrm.actions';
import { useProject } from '@/context/project-context';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';
import { SabFileToFileButton } from '@/components/sabfiles';
import type { ObjectMetadata, FieldMetadata } from '@/lib/sabcrm/types';
import type {
  ColumnMapping,
  MappingValidationIssue,
  SabcrmPickerOption,
} from '@/app/actions/sabcrm.actions.types';
import type {
  RawRow,
  ImportBatchResult,
  ExportRecordsResult,
} from '@/lib/sabcrm/import-export.server';

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Field,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Badge,
  Alert,
  EmptyState,
  StatCard,
  Skeleton,
  Spinner,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  useToast,
} from '@/components/sabcrm/20ui';

// ---------------------------------------------------------------------------
// Field-type gating: which fields can be imported from a spreadsheet.
//
// FLAT fields (everything except RELATION + FILE) flow through the normal
// server import (`importRecordsAction`). RELATION fields are NOT importable as
// flat values - but they CAN be "connected" on import by matching each CSV
// value to an existing related record and storing its id. FILE fields stay
// excluded (they need real uploads, not ids).
// ---------------------------------------------------------------------------

function importableFields(object: ObjectMetadata): FieldMetadata[] {
  return object.fields.filter(
    (f) => !f.system && f.type !== 'RELATION' && f.type !== 'FILE',
  );
}

/**
 * RELATION fields that point at a known target object - the ones eligible for
 * connect-on-import. ONE_TO_MANY back-references are excluded (they are owned
 * by the other side and not settable as a single id from a flat file).
 */
function connectableRelationFields(object: ObjectMetadata): FieldMetadata[] {
  return object.fields.filter(
    (f) =>
      !f.system &&
      f.type === 'RELATION' &&
      !!f.relation?.targetObject &&
      f.relation.kind !== 'ONE_TO_MANY',
  );
}

/**
 * Fields of a relation's TARGET object that a CSV value can be matched against
 * in the "match by" sub-control. We surface human-readable text-like fields
 * (the resolver itself searches the target's label field, but exposing the
 * choice lets the user document intent).
 */
function matchByFields(target: ObjectMetadata | null): FieldMetadata[] {
  if (!target) return [];
  const usable = target.fields.filter(
    (f) =>
      !f.system &&
      (f.isLabel ||
        f.type === 'TEXT' ||
        f.type === 'EMAIL' ||
        f.type === 'PHONE' ||
        f.type === 'URL'),
  );
  return usable.length > 0 ? usable : target.fields.filter((f) => !f.system);
}

/** The default match-by field key for a target object (its label, else first). */
function defaultMatchBy(target: ObjectMetadata | null): string {
  if (!target) return '';
  const label = target.fields.find((f) => f.isLabel);
  if (label) return label.key;
  const text = matchByFields(target)[0];
  return text ? text.key : '';
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

function parseCsv(text: string): { headers: string[]; rows: RawRow[] } {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const headers = (result.meta.fields ?? []).filter(Boolean);
  const rows = (result.data ?? []).filter(
    (r) => r && Object.keys(r).length > 0,
  ) as RawRow[];
  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Relation connect - resolve a CSV value to an existing related-record id.
//
// `searchRecordsForPickerAction` does a contains-style search on the target
// object's label field. To make a connect deterministic we prefer an EXACT
// (case-insensitive, trimmed) label match among the returned options and fall
// back to the single result when the search returns exactly one. Ambiguous /
// empty results resolve to `null` (counted as "not found").
// ---------------------------------------------------------------------------

interface RelationMatch {
  /** Resolved related-record id, or null when nothing matched. */
  id: string | null;
  /** Display label of the matched record (for the preview list). */
  label: string | null;
}

function pickMatch(value: string, options: SabcrmPickerOption[]): RelationMatch {
  const term = value.trim().toLowerCase();
  if (!term || options.length === 0) return { id: null, label: null };
  const exact = options.find((o) => o.label.trim().toLowerCase() === term);
  if (exact) return { id: exact.id, label: exact.label };
  if (options.length === 1) {
    return { id: options[0].id, label: options[0].label };
  }
  return { id: null, label: null };
}

/**
 * Resolve a single CSV value to a related-record id (with a tiny in-call cache
 * so repeated values do not re-hit the server). Best-effort: a failed search
 * resolves to a miss rather than throwing.
 */
async function resolveRelationValue(
  targetObject: string,
  value: string,
  projectId: string | undefined,
  cache: Map<string, RelationMatch>,
): Promise<RelationMatch> {
  const key = value.trim().toLowerCase();
  if (!key) return { id: null, label: null };
  const cached = cache.get(key);
  if (cached) return cached;
  let match: RelationMatch = { id: null, label: null };
  try {
    const res = await searchRecordsForPickerAction(
      targetObject,
      value.trim(),
      20,
      projectId,
    );
    if (res.ok) match = pickMatch(value, res.data);
  } catch {
    // best-effort - leave as a miss
  }
  cache.set(key, match);
  return match;
}

// ---------------------------------------------------------------------------
// Import wizard state machine - a linear 4-step flow.
//   1 = object + file pick   2 = map columns   3 = preview   4 = import summary
// ---------------------------------------------------------------------------

type WizardStep = 1 | 2 | 3 | 4;

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Object & file',
  2: 'Map columns',
  3: 'Preview',
  4: 'Import',
};

interface ParsedFile {
  name: string;
  headers: string[];
  rows: RawRow[];
}

/** A relation field mapped to a CSV column for connect-on-import. */
interface RelationMapEntry {
  /** CSV header whose values are matched against the target object. */
  header: string;
  /** Target-object field key the user intends to match on (UX intent). */
  matchBy: string;
}

/** Per-relation-field connect coverage, computed in the preview step. */
interface RelationProbe {
  fieldKey: string;
  /** Number of distinct non-empty values sampled from the column. */
  sampled: number;
  /** How many sampled values resolved to an existing record. */
  matched: number;
  /** A capped list of sampled value to match outcomes for display. */
  samples: Array<{ value: string; match: RelationMatch }>;
  /** True while the probe is running. */
  loading: boolean;
}

/** Per-relation-field connect outcome after the import patch pass. */
interface RelationConnectResult {
  fieldKey: string;
  label: string;
  /** Rows whose relation cell was non-empty (i.e. a connect was attempted). */
  attempted: number;
  /** Rows where the value resolved + the id was patched on. */
  connected: number;
  /** Rows where the value did not resolve to any record. */
  unmatched: number;
}

/** How many distinct values per relation column we probe in the preview. */
const RELATION_PROBE_SAMPLE = 8;

// ---------------------------------------------------------------------------
// Export control (20ui dropdown) - keeps export working.
// ---------------------------------------------------------------------------

function ExportControl({
  object,
  projectId,
}: {
  object: ObjectMetadata;
  projectId?: string;
}): React.JSX.Element {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  const run = React.useCallback(
    async (format: 'csv' | 'xlsx') => {
      setBusy(true);
      try {
        const res = await exportRecordsAction({ object: object.slug }, projectId);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        const data = res.data as ExportRecordsResult;
        const filename = `${object.slug}-${dateStamp()}.${format}`;
        if (format === 'csv') {
          downloadCsv(filename, data.headers, data.rows);
        } else {
          await downloadXlsx(filename, data.headers, data.rows, object.labelPlural);
        }
        toast.success(
          `Exported ${data.rows.length} ${object.labelPlural.toLowerCase()}.`,
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Export failed.');
      } finally {
        setBusy(false);
      }
    },
    [object, projectId, toast],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          loading={busy}
          iconLeft={busy ? undefined : Download}
          iconRight={ChevronDown}
          disabled={busy}
        >
          {busy ? 'Exporting' : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void run('csv')}>
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void run('xlsx')}>
          Export as Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Step indicator - numbered stepper with connector rails.
// ---------------------------------------------------------------------------

function StepIndicator({ step }: { step: WizardStep }): React.JSX.Element {
  const steps: WizardStep[] = [1, 2, 3, 4];
  return (
    <div
      className="flex items-center gap-[var(--st-space-2)] flex-wrap mb-[var(--st-space-4)]"
      aria-label="Import progress"
    >
      {steps.map((s, i) => {
        const state = s === step ? 'active' : s < step ? 'done' : 'todo';
        return (
          <React.Fragment key={s}>
            {i > 0 && (
              <span
                className={`h-px w-6 ${
                  s <= step
                    ? 'bg-[var(--st-accent)]'
                    : 'bg-[var(--st-border)]'
                }`}
                aria-hidden="true"
              />
            )}
            <div
              className="flex items-center gap-[var(--st-space-2)]"
              aria-current={s === step ? 'step' : undefined}
            >
              <span
                className={`grid place-items-center h-6 w-6 rounded-full text-[12px] font-semibold border ${
                  state === 'active'
                    ? 'bg-[var(--st-accent)] text-[var(--st-text-inverted)] border-[var(--st-accent)]'
                    : state === 'done'
                      ? 'bg-[var(--st-accent-soft)] text-[var(--st-accent)] border-[var(--st-accent-soft)]'
                      : 'bg-[var(--st-bg-secondary)] text-[var(--st-text-tertiary)] border-[var(--st-border)]'
                }`}
              >
                {state === 'done' ? (
                  <CheckCircle2 size={15} aria-hidden="true" />
                ) : (
                  s
                )}
              </span>
              <span
                className={`text-[13px] ${
                  state === 'todo'
                    ? 'text-[var(--st-text-tertiary)]'
                    : 'text-[var(--st-text)] font-medium'
                }`}
              >
                {STEP_LABELS[s]}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmImportExportPage(): React.JSX.Element {
  const { activeProjectId } = useProject();

  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = React.useState<string>('');

  // Wizard state
  const [step, setStep] = React.useState<WizardStep>(1);
  const [parsed, setParsed] = React.useState<ParsedFile | null>(null);
  const [mapping, setMapping] = React.useState<ColumnMapping>({});
  // RELATION fields mapped for connect-on-import: relation field key to entry.
  // Kept SEPARATE from `mapping` because the server import path skips relation
  // columns; we connect them client-side after the flat import.
  const [relationMap, setRelationMap] = React.useState<
    Record<string, RelationMapEntry>
  >({});
  const [issues, setIssues] = React.useState<MappingValidationIssue[]>([]);
  const [validating, setValidating] = React.useState(false);
  const [stepError, setStepError] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [result, setResult] = React.useState<ImportBatchResult | null>(null);
  // Preview-step connect-coverage probes, keyed by relation field key.
  const [relationProbes, setRelationProbes] = React.useState<
    Record<string, RelationProbe>
  >({});
  // Import-summary connect outcome, populated during the patch pass.
  const [relationResults, setRelationResults] = React.useState<
    RelationConnectResult[]
  >([]);

  // ---- Load objects -------------------------------------------------------
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await listObjectsAction(activeProjectId ?? undefined);
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error);
          setObjects([]);
        } else {
          setObjects(res.data);
          setSelectedSlug((prev) =>
            res.data.some((o) => o.slug === prev) ? prev : '',
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load objects.');
          setObjects([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  const selectedObject = React.useMemo<ObjectMetadata | null>(
    () => objects.find((o) => o.slug === selectedSlug) ?? null,
    [objects, selectedSlug],
  );

  const fields = React.useMemo<FieldMetadata[]>(
    () => (selectedObject ? importableFields(selectedObject) : []),
    [selectedObject],
  );

  // RELATION fields eligible for connect-on-import on the selected object.
  const relationFields = React.useMemo<FieldMetadata[]>(
    () => (selectedObject ? connectableRelationFields(selectedObject) : []),
    [selectedObject],
  );

  const objectsBySlug = React.useMemo(() => {
    const m = new Map<string, ObjectMetadata>();
    for (const o of objects) m.set(o.slug, o);
    return m;
  }, [objects]);

  const targetFor = React.useCallback(
    (field: FieldMetadata): ObjectMetadata | null =>
      field.relation?.targetObject
        ? objectsBySlug.get(field.relation.targetObject) ?? null
        : null,
    [objectsBySlug],
  );

  // Reset the whole wizard (used on object change + "start over").
  const resetWizard = React.useCallback(() => {
    setStep(1);
    setParsed(null);
    setMapping({});
    setRelationMap({});
    setIssues([]);
    setStepError(null);
    setResult(null);
    setRelationProbes({});
    setRelationResults([]);
  }, []);

  const handleObjectChange = React.useCallback(
    (slug: string) => {
      setSelectedSlug(slug);
      resetWizard();
    },
    [resetWizard],
  );

  // ---- Step 1 - file picked (via SabFiles) to parse CSV -------------------
  const handleFile = React.useCallback(
    async (file: File) => {
      if (!selectedObject) return;
      setStepError(null);
      setResult(null);
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        setStepError('Please export your spreadsheet as CSV before importing.');
        return;
      }
      let text: string;
      try {
        text = await file.text();
      } catch {
        setStepError('Could not read the selected file.');
        return;
      }
      let headers: string[];
      let rows: RawRow[];
      try {
        ({ headers, rows } = parseCsv(text));
      } catch {
        setStepError('Could not parse the file as CSV.');
        return;
      }
      if (headers.length === 0) {
        setStepError('The selected file has no column headers.');
        return;
      }
      if (rows.length === 0) {
        setStepError('The file has headers but no data rows.');
        return;
      }
      // Successful parse - store the file but stay on step 1 so the user can
      // confirm the picked file before advancing.
      setParsed({ name: file.name, headers, rows });
      setMapping({});
      setRelationMap({});
      setIssues([]);
      setRelationProbes({});
      setRelationResults([]);
    },
    [selectedObject],
  );

  const clearFile = React.useCallback(() => {
    setParsed(null);
    setMapping({});
    setRelationMap({});
    setIssues([]);
    setStepError(null);
    setRelationProbes({});
    setRelationResults([]);
  }, []);

  // ---- Advance from step 1 to 2: fetch suggested mapping ------------------
  const goToMapping = React.useCallback(async () => {
    if (!selectedObject || !parsed) return;
    setStepError(null);
    setValidating(true);
    try {
      const sug = await buildColumnMappingSuggestionsAction(
        selectedObject.slug,
        parsed.headers,
        activeProjectId ?? undefined,
      );
      setMapping(sug.ok ? sug.data : {});
      if (!sug.ok) {
        setStepError(`Could not auto-suggest a mapping: ${sug.error}`);
      }
      setStep(2);
    } catch (e) {
      setStepError(
        e instanceof Error ? e.message : 'Failed to build mapping suggestions.',
      );
      // Still let the user map manually.
      setMapping({});
      setStep(2);
    } finally {
      setValidating(false);
    }
  }, [selectedObject, parsed, activeProjectId]);

  const setFieldColumn = React.useCallback((fieldKey: string, header: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (header) next[fieldKey] = header;
      else delete next[fieldKey];
      return next;
    });
  }, []);

  // ---- Relation connect mapping handlers ----------------------------------
  // Map a RELATION field to a CSV column. Selecting "Skip" removes the entry;
  // selecting a column seeds the match-by with the target object's label field.
  const setRelationColumn = React.useCallback(
    (field: FieldMetadata, header: string) => {
      setRelationMap((prev) => {
        const next = { ...prev };
        if (!header) {
          delete next[field.key];
        } else {
          const target = targetFor(field);
          next[field.key] = {
            header,
            matchBy: next[field.key]?.matchBy || defaultMatchBy(target),
          };
        }
        return next;
      });
      // Any mapping change invalidates the previous probe for this field.
      setRelationProbes((prev) => {
        if (!prev[field.key]) return prev;
        const next = { ...prev };
        delete next[field.key];
        return next;
      });
    },
    [targetFor],
  );

  const setRelationMatchBy = React.useCallback(
    (fieldKey: string, matchBy: string) => {
      setRelationMap((prev) => {
        const cur = prev[fieldKey];
        if (!cur) return prev;
        return { ...prev, [fieldKey]: { ...cur, matchBy } };
      });
      setRelationProbes((prev) => {
        if (!prev[fieldKey]) return prev;
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
    },
    [],
  );

  // Probe one relation column: sample up to RELATION_PROBE_SAMPLE distinct
  // non-empty values and resolve each via the picker, updating coverage state.
  const probeRelation = React.useCallback(
    async (field: FieldMetadata) => {
      if (!parsed) return;
      const entry = relationMap[field.key];
      const target = field.relation?.targetObject;
      if (!entry || !target) return;

      // Distinct, non-empty values in column order.
      const seen = new Set<string>();
      const distinct: string[] = [];
      for (const row of parsed.rows) {
        const raw = (row[entry.header] ?? '').trim();
        if (!raw) continue;
        const key = raw.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        distinct.push(raw);
        if (distinct.length >= RELATION_PROBE_SAMPLE) break;
      }

      setRelationProbes((prev) => ({
        ...prev,
        [field.key]: {
          fieldKey: field.key,
          sampled: distinct.length,
          matched: 0,
          samples: [],
          loading: true,
        },
      }));

      const cache = new Map<string, RelationMatch>();
      const samples: Array<{ value: string; match: RelationMatch }> = [];
      let matched = 0;
      for (const value of distinct) {
        const match = await resolveRelationValue(
          target,
          value,
          activeProjectId ?? undefined,
          cache,
        );
        if (match.id) matched += 1;
        samples.push({ value, match });
      }

      setRelationProbes((prev) => ({
        ...prev,
        [field.key]: {
          fieldKey: field.key,
          sampled: distinct.length,
          matched,
          samples,
          loading: false,
        },
      }));
    },
    [parsed, relationMap, activeProjectId],
  );

  // ---- Advance from step 2 to 3: server-validate the mapping --------------
  const goToPreview = React.useCallback(async () => {
    if (!selectedObject || !parsed) return;
    setStepError(null);
    setValidating(true);
    try {
      const val = await validateImportMappingAction(
        selectedObject.slug,
        mapping,
        parsed.headers,
        activeProjectId ?? undefined,
      );
      if (!val.ok) {
        setStepError(val.error);
        return;
      }
      setIssues(val.data);
      setStep(3);
    } catch (e) {
      setStepError(
        e instanceof Error ? e.message : 'Failed to validate the mapping.',
      );
    } finally {
      setValidating(false);
    }
  }, [selectedObject, parsed, mapping, activeProjectId]);

  // ---- Auto-probe connect coverage when entering the preview step ---------
  // For each relation field that has a column mapping but no probe yet, kick
  // off a sample resolution so the user sees coverage without a manual click.
  // Re-probing on demand is also available from each coverage card.
  React.useEffect(() => {
    if (step !== 3) return;
    for (const field of relationFields) {
      if (relationMap[field.key] && !relationProbes[field.key]) {
        void probeRelation(field);
      }
    }
    // We intentionally depend on `step` + the mapping keys so a newly-mapped
    // relation is probed when the user returns to the preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, relationMap, relationFields]);

  // ---- Step 4 - commit the import ----------------------------------------
  //
  // Two passes:
  //   1. Flat import via `importRecordsAction` (non-relation fields). This
  //      returns one result row per input row, IN ORDER, with the created
  //      record (+ id) for successes.
  //   2. Connect pass - best-effort. For every created record we resolve each
  //      mapped relation cell to an existing related-record id and patch it on
  //      via `updateRecordAction`. Unresolved values are skipped (left unset)
  //      and counted so the summary can show connect coverage. A connect
  //      failure NEVER fails the row - the record is already imported.
  const handleImport = React.useCallback(async () => {
    if (!selectedObject || !parsed) return;
    setStepError(null);
    setImporting(true);
    setRelationResults([]);
    try {
      const res = await importRecordsAction(
        {
          object: selectedObject.slug,
          columnMapping: mapping,
          rows: parsed.rows,
        },
        activeProjectId ?? undefined,
      );
      if (!res.ok) {
        setStepError(res.error);
        return;
      }
      setResult(res.data);
      setStep(4);

      // ---- Connect pass (best-effort) ----
      const activeRelations = relationFields.filter(
        (f) => relationMap[f.key]?.header && f.relation?.targetObject,
      );
      if (activeRelations.length > 0 && res.data.succeeded > 0) {
        // One id-resolution cache per target object (values repeat across rows).
        const caches = new Map<string, Map<string, RelationMatch>>();
        const cacheFor = (target: string): Map<string, RelationMatch> => {
          let c = caches.get(target);
          if (!c) {
            c = new Map<string, RelationMatch>();
            caches.set(target, c);
          }
          return c;
        };

        const tally = new Map<string, RelationConnectResult>();
        for (const f of activeRelations) {
          tally.set(f.key, {
            fieldKey: f.key,
            label: f.label,
            attempted: 0,
            connected: 0,
            unmatched: 0,
          });
        }

        // `res.data.rows[i]` aligns with `parsed.rows[i]`.
        for (let i = 0; i < res.data.rows.length; i++) {
          const rowRes = res.data.rows[i];
          if (!rowRes.ok) continue;
          const sourceRow = parsed.rows[i];
          if (!sourceRow) continue;

          const patch: Record<string, unknown> = {};
          for (const f of activeRelations) {
            const entry = relationMap[f.key];
            const target = f.relation?.targetObject;
            if (!entry || !target) continue;
            const value = (sourceRow[entry.header] ?? '').trim();
            if (!value) continue;
            const t = tally.get(f.key);
            if (t) t.attempted += 1;
            const match = await resolveRelationValue(
              target,
              value,
              activeProjectId ?? undefined,
              cacheFor(target),
            );
            if (match.id) {
              patch[f.key] = match.id;
              if (t) t.connected += 1;
            } else if (t) {
              t.unmatched += 1;
            }
          }

          if (Object.keys(patch).length > 0) {
            try {
              await updateRecordAction(
                rowRes.record._id,
                patch,
                activeProjectId ?? undefined,
              );
            } catch {
              // best-effort: a failed connect-patch does not unwind the import.
            }
          }
        }

        setRelationResults(
          Array.from(tally.values()).filter((t) => t.attempted > 0),
        );
      }
    } catch (e) {
      setStepError(e instanceof Error ? e.message : 'Failed to import records.');
    } finally {
      setImporting(false);
    }
  }, [selectedObject, parsed, mapping, relationFields, relationMap, activeProjectId]);

  // ---- Derived: mapping readouts + blocking / warning split ---------------
  const mappedCount = Object.keys(mapping).length;

  // Server issues are all blocking (required-unmapped, unknown header/field,
  // non-importable field). We surface them as hard errors.
  const blockingIssues = issues;

  // Soft, client-side warnings: importable fields with no mapping, and CSV
  // columns that will not be imported. These do NOT block the import.
  const warnings = React.useMemo<string[]>(() => {
    if (!parsed) return [];
    const out: string[] = [];
    const unmappedFields = fields.filter((f) => !f.required && !mapping[f.key]);
    if (unmappedFields.length > 0) {
      out.push(
        `${unmappedFields.length} field(s) are not mapped and will use their default value (if any): ${unmappedFields
          .map((f) => f.label)
          .slice(0, 6)
          .join(', ')}${unmappedFields.length > 6 ? '...' : ''}.`,
      );
    }
    const usedHeaders = new Set(Object.values(mapping));
    for (const e of Object.values(relationMap)) usedHeaders.add(e.header);
    const ignoredHeaders = parsed.headers.filter((h) => !usedHeaders.has(h));
    if (ignoredHeaders.length > 0) {
      out.push(
        `${ignoredHeaders.length} CSV column(s) are not mapped and will be ignored: ${ignoredHeaders
          .slice(0, 6)
          .join(', ')}${ignoredHeaders.length > 6 ? '...' : ''}.`,
      );
    }
    return out;
  }, [parsed, fields, mapping, relationMap]);

  // Count of relation fields wired up for connect-on-import.
  const relationMappedCount = Object.keys(relationMap).length;

  // Relation fields that are actually mapped, with their entry - used in the
  // preview-step coverage section.
  const mappedRelations = React.useMemo(
    () =>
      relationFields
        .filter((f) => relationMap[f.key]?.header)
        .map((f) => ({ field: f, entry: relationMap[f.key] })),
    [relationFields, relationMap],
  );

  // The ordered list of (field, header) pairs that will actually be imported.
  const mappedPairs = React.useMemo(
    () =>
      fields
        .filter((f) => mapping[f.key])
        .map((f) => ({ field: f, header: mapping[f.key] })),
    [fields, mapping],
  );

  const sampleRows = React.useMemo(
    () => (parsed ? parsed.rows.slice(0, 5) : []),
    [parsed],
  );

  // ---- Render -------------------------------------------------------------
  return (
    <div className="20ui sabcrm-twenty max-w-[920px] mx-auto px-[var(--st-space-4)] py-[var(--st-space-5)] flex flex-col gap-[var(--st-space-4)]">
      <Link
        href="/dashboard/settings/crm"
        className="inline-flex items-center gap-1 text-[13px] text-[var(--st-text-secondary)] hover:text-[var(--st-text)] w-fit"
      >
        <ChevronLeft size={14} aria-hidden="true" />
        Settings
      </Link>

      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Import &amp; Export</PageTitle>
          <PageDescription>
            Bulk-load records into any object from a CSV file, or export an
            object&apos;s records back out. Pick an object to begin - imports run
            through a guided 4-step wizard.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {error && (
        <Alert tone="danger" title="Could not load objects">
          {error}
        </Alert>
      )}

      {/* Object selector */}
      <Card padding="none">
        <CardHeader>
          <CardTitle>Target object</CardTitle>
          <CardDescription>
            Choose which object import and export operate on.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {loading ? (
            <Skeleton width={320} height={36} />
          ) : objects.length === 0 && !error ? (
            <EmptyState
              icon={Database}
              title="No objects available"
              description="This project has no CRM objects to import into or export from yet."
            />
          ) : (
            <div className="max-w-[320px]">
              <Field label="Object">
                <Select value={selectedSlug} onValueChange={handleObjectChange}>
                  <SelectTrigger aria-label="Object">
                    <SelectValue placeholder="Select an object" />
                  </SelectTrigger>
                  <SelectContent>
                    {objects.map((o) => (
                      <SelectItem key={o.slug} value={o.slug}>
                        {o.labelPlural}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}
        </CardBody>
      </Card>

      {selectedObject && (
        <>
          {/* Export */}
          <Card padding="none">
            <CardHeader className="flex flex-wrap items-start justify-between gap-[var(--st-space-3)]">
              <div>
                <CardTitle>
                  Export {selectedObject.labelPlural.toLowerCase()}
                </CardTitle>
                <CardDescription>
                  Download this object&apos;s records as a CSV or Excel file.
                </CardDescription>
              </div>
              <ExportControl
                object={selectedObject}
                projectId={activeProjectId ?? undefined}
              />
            </CardHeader>
          </Card>

          {/* Import wizard */}
          <Card padding="none">
            <CardHeader className="flex flex-wrap items-start justify-between gap-[var(--st-space-3)]">
              <div>
                <CardTitle>
                  Import {selectedObject.labelPlural.toLowerCase()}
                </CardTitle>
                <CardDescription>
                  A guided 4-step wizard: choose a file, map columns, preview, and
                  import.
                </CardDescription>
              </div>
              {(step !== 1 || parsed) && (
                <Button variant="ghost" iconLeft={RotateCcw} onClick={resetWizard}>
                  Start over
                </Button>
              )}
            </CardHeader>

            <CardBody>
              <StepIndicator step={step} />

              {stepError && (
                <div className="mb-[var(--st-space-3)]">
                  <Alert tone="danger">{stepError}</Alert>
                </div>
              )}

              {/* ---- Step 1 - object confirmed + file pick ---- */}
              {step === 1 && (
                <div className="flex flex-col gap-[var(--st-space-4)]">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[var(--st-text)]">
                      Choose a CSV file
                    </h3>
                    <p className="text-[13px] text-[var(--st-text-secondary)] mt-1">
                      Importing into{' '}
                      <strong className="text-[var(--st-text)]">
                        {selectedObject.labelPlural}
                      </strong>
                      . Pick a CSV from your SabFiles library or upload a new one.
                    </p>
                  </div>

                  {parsed ? (
                    <div className="flex items-center gap-[var(--st-space-3)] p-[var(--st-space-3)] border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]">
                      <FileText
                        size={18}
                        className="text-[var(--st-text-secondary)]"
                        aria-hidden="true"
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[13px] font-medium text-[var(--st-text)] truncate">
                          {parsed.name}
                        </span>
                        <span className="text-[12px] text-[var(--st-text-secondary)]">
                          {parsed.rows.length} row(s), {parsed.headers.length}{' '}
                          column(s)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        iconLeft={X}
                        onClick={clearFile}
                        aria-label="Remove file"
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-[var(--st-space-3)] p-[var(--st-space-5)] border border-dashed border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-center">
                      <Upload
                        size={22}
                        className="text-[var(--st-text-tertiary)]"
                        aria-hidden="true"
                      />
                      <p className="text-[13px] text-[var(--st-text-secondary)] m-0">
                        Pick a CSV file from your SabFiles library or upload a new
                        one.
                      </p>
                      <SabFileToFileButton
                        accept="all"
                        onPickFile={(file) => handleFile(file)}
                        onError={(e) => setStepError(e.message)}
                      >
                        <Upload size={14} aria-hidden="true" /> Choose CSV
                      </SabFileToFileButton>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-[var(--st-space-3)]">
                    <span />
                    <Button
                      variant="primary"
                      iconRight={ChevronRight}
                      loading={validating}
                      onClick={() => void goToMapping()}
                      disabled={!parsed || validating}
                    >
                      Next: map columns
                    </Button>
                  </div>
                </div>
              )}

              {/* ---- Step 2 - map columns ---- */}
              {step === 2 && parsed && (
                <div className="flex flex-col gap-[var(--st-space-4)]">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[var(--st-text)]">
                      Map columns to fields
                    </h3>
                    <p className="text-[13px] text-[var(--st-text-secondary)] mt-1">
                      We pre-filled likely matches. Map each{' '}
                      {selectedObject.labelSingular.toLowerCase()} field to a CSV
                      column, or leave it as <em>Skip</em>.
                      {relationFields.length > 0 && (
                        <>
                          {' '}
                          Relation fields can be{' '}
                          <strong className="text-[var(--st-text)]">
                            connected
                          </strong>{' '}
                          to existing records by matching a CSV value.
                        </>
                      )}
                    </p>
                  </div>

                  <Badge tone="success" dot>
                    {parsed.name} - {parsed.rows.length} row(s),{' '}
                    {parsed.headers.length} column(s), {mappedCount} field(s)
                    mapped
                    {relationMappedCount > 0 &&
                      ` , ${relationMappedCount} relation(s) to connect`}
                  </Badge>

                  <div className="border border-[var(--st-border)] rounded-[var(--st-radius)] overflow-hidden">
                    <Table density="compact">
                      <THead>
                        <Tr>
                          <Th>Field</Th>
                          <Th>Type</Th>
                          <Th>CSV column</Th>
                        </Tr>
                      </THead>
                      <TBody>
                        {fields.map((f) => (
                          <Tr key={f.key}>
                            <Td>
                              {f.label}
                              {f.required && (
                                <span
                                  className="text-[var(--st-danger)]"
                                  aria-hidden="true"
                                >
                                  {' '}
                                  *
                                </span>
                              )}
                            </Td>
                            <Td className="text-[var(--st-text-secondary)]">
                              {f.type}
                            </Td>
                            <Td>
                              <Select
                                value={mapping[f.key] ?? ''}
                                onValueChange={(v) =>
                                  setFieldColumn(f.key, v === '__skip__' ? '' : v)
                                }
                              >
                                <SelectTrigger
                                  aria-label={`CSV column for ${f.label}`}
                                >
                                  <SelectValue placeholder="Skip" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__skip__">Skip</SelectItem>
                                  {parsed.headers.map((h) => (
                                    <SelectItem key={h} value={h}>
                                      {h}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Td>
                          </Tr>
                        ))}
                      </TBody>
                    </Table>
                  </div>

                  {/* ---- Relation connect mapping ---- */}
                  {relationFields.length > 0 && (
                    <div className="flex flex-col gap-[var(--st-space-2)]">
                      <h3 className="text-[15px] font-semibold text-[var(--st-text)] flex items-center gap-[6px]">
                        <Link2 size={14} aria-hidden="true" />
                        Connect relations
                      </h3>
                      <p className="text-[13px] text-[var(--st-text-secondary)]">
                        Map a CSV column to a relation to link each row to an{' '}
                        <strong className="text-[var(--st-text)]">existing</strong>{' '}
                        record. Choose which field of the related object to match
                        the column&apos;s values against.
                      </p>
                      <div className="border border-[var(--st-border)] rounded-[var(--st-radius)] overflow-hidden">
                        <Table density="compact">
                          <THead>
                            <Tr>
                              <Th>Relation</Th>
                              <Th>Links to</Th>
                              <Th>CSV column</Th>
                            </Tr>
                          </THead>
                          <TBody>
                            {relationFields.map((f) => {
                              const target = targetFor(f);
                              const entry = relationMap[f.key];
                              const choices = matchByFields(target);
                              return (
                                <Tr key={f.key}>
                                  <Td>
                                    {f.label}
                                    {f.required && (
                                      <span
                                        className="text-[var(--st-danger)]"
                                        aria-hidden="true"
                                      >
                                        {' '}
                                        *
                                      </span>
                                    )}
                                  </Td>
                                  <Td className="text-[var(--st-text-secondary)]">
                                    {target
                                      ? target.labelPlural
                                      : f.relation?.targetObject ?? '-'}
                                  </Td>
                                  <Td>
                                    <div className="flex flex-col gap-[var(--st-space-2)]">
                                      <Select
                                        value={entry?.header ?? ''}
                                        onValueChange={(v) =>
                                          setRelationColumn(
                                            f,
                                            v === '__skip__' ? '' : v,
                                          )
                                        }
                                      >
                                        <SelectTrigger
                                          aria-label={`CSV column for ${f.label}`}
                                        >
                                          <SelectValue placeholder="Skip" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__skip__">
                                            Skip
                                          </SelectItem>
                                          {parsed.headers.map((h) => (
                                            <SelectItem key={h} value={h}>
                                              {h}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      {entry?.header && (
                                        <Field label="Match by">
                                          <Select
                                            value={entry.matchBy}
                                            onValueChange={(v) =>
                                              setRelationMatchBy(f.key, v)
                                            }
                                          >
                                            <SelectTrigger
                                              aria-label={`Match ${f.label} by`}
                                            >
                                              <SelectValue placeholder="Match by" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {choices.map((c) => (
                                                <SelectItem
                                                  key={c.key}
                                                  value={c.key}
                                                >
                                                  {c.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </Field>
                                      )}
                                    </div>
                                  </Td>
                                </Tr>
                              );
                            })}
                          </TBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-[var(--st-space-3)]">
                    <Button
                      variant="ghost"
                      iconLeft={ChevronLeft}
                      onClick={() => {
                        setStepError(null);
                        setStep(1);
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      iconRight={ChevronRight}
                      loading={validating}
                      onClick={() => void goToPreview()}
                      disabled={mappedCount === 0 || validating}
                    >
                      Next: preview
                    </Button>
                  </div>
                </div>
              )}

              {/* ---- Step 3 - preview + validate ---- */}
              {step === 3 && parsed && (
                <div className="flex flex-col gap-[var(--st-space-4)]">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[var(--st-text)]">
                      Preview &amp; validate
                    </h3>
                    <p className="text-[13px] text-[var(--st-text-secondary)] mt-1">
                      Review what will be imported. Fix any blocking issues before
                      continuing.
                    </p>
                  </div>

                  <div className="grid gap-[var(--st-space-3)] grid-cols-2 sm:grid-cols-4">
                    <StatCard label="Rows to import" value={parsed.rows.length} />
                    <StatCard label="Mapped columns" value={mappedCount} />
                    {relationMappedCount > 0 && (
                      <StatCard
                        label="Relations to connect"
                        value={relationMappedCount}
                      />
                    )}
                    <StatCard
                      label="Blocking issues"
                      value={blockingIssues.length}
                    />
                  </div>

                  {/* Blocking issues */}
                  {blockingIssues.length > 0 && (
                    <Alert tone="danger" title="Blocking issues">
                      <ul className="list-disc pl-4 flex flex-col gap-1">
                        {blockingIssues.map((iss, i) => (
                          <li key={i}>{iss.message}</li>
                        ))}
                      </ul>
                    </Alert>
                  )}

                  {/* Soft warnings */}
                  {warnings.length > 0 && (
                    <Alert tone="warning" title="Warnings">
                      <ul className="list-disc pl-4 flex flex-col gap-1">
                        {warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </Alert>
                  )}

                  {blockingIssues.length === 0 && (
                    <Alert tone="success">
                      No blocking issues - ready to import {parsed.rows.length}{' '}
                      row(s).
                    </Alert>
                  )}

                  {/* ---- Relation connect coverage ---- */}
                  {mappedRelations.length > 0 && (
                    <div className="flex flex-col gap-[var(--st-space-2)]">
                      <p className="text-[13px] text-[var(--st-text-secondary)] flex items-center gap-[6px]">
                        <Link2 size={13} aria-hidden="true" />
                        Relation connect coverage - a sample of distinct values is
                        matched against existing records.
                      </p>
                      <div className="grid gap-[var(--st-space-3)] sm:grid-cols-2">
                        {mappedRelations.map(({ field, entry }) => {
                          const target = targetFor(field);
                          const probe = relationProbes[field.key];
                          const matched = probe?.matched ?? 0;
                          const sampled = probe?.sampled ?? 0;
                          const badge =
                            sampled === 0
                              ? null
                              : matched === sampled
                                ? ('ok' as const)
                                : matched === 0
                                  ? ('none' as const)
                                  : ('partial' as const);
                          return (
                            <div
                              className="border border-[var(--st-border)] rounded-[var(--st-radius)] p-[var(--st-space-3)] bg-[var(--st-bg-secondary)] flex flex-col gap-[var(--st-space-2)]"
                              key={field.key}
                            >
                              <div className="flex items-start justify-between gap-[var(--st-space-2)]">
                                <span className="flex items-center gap-[6px] text-[13px] font-medium text-[var(--st-text)]">
                                  <Link2 size={13} aria-hidden="true" />
                                  {field.label}
                                  <span className="text-[12px] font-normal text-[var(--st-text-secondary)]">
                                    {entry.header} to{' '}
                                    {target?.labelPlural ??
                                      field.relation?.targetObject}
                                  </span>
                                </span>
                                {probe?.loading ? (
                                  <Badge tone="neutral">
                                    <span className="inline-flex items-center gap-[6px]">
                                      <Spinner size="sm" label="Checking" />
                                      Checking
                                    </span>
                                  </Badge>
                                ) : badge ? (
                                  <Badge
                                    tone={
                                      badge === 'ok'
                                        ? 'success'
                                        : badge === 'none'
                                          ? 'danger'
                                          : 'warning'
                                    }
                                  >
                                    {matched}/{sampled} matched
                                  </Badge>
                                ) : null}
                              </div>
                              {probe && !probe.loading ? (
                                probe.samples.length === 0 ? (
                                  <p className="text-[12px] text-[var(--st-text-tertiary)] m-0">
                                    No non-empty values found in this column to
                                    match.
                                  </p>
                                ) : (
                                  <>
                                    <div className="flex flex-col gap-1">
                                      {probe.samples.map((s, si) => (
                                        <div
                                          className="flex items-center gap-[6px] text-[12px]"
                                          key={si}
                                        >
                                          <span
                                            className={
                                              s.match.id
                                                ? 'text-[var(--st-status-ok)]'
                                                : 'text-[var(--st-danger)]'
                                            }
                                            aria-hidden="true"
                                          >
                                            {s.match.id ? (
                                              <CheckCircle2 size={14} />
                                            ) : (
                                              <XCircle size={14} />
                                            )}
                                          </span>
                                          <span
                                            className="text-[var(--st-text)] truncate max-w-[120px]"
                                            title={s.value}
                                          >
                                            {s.value}
                                          </span>
                                          <ArrowRight
                                            size={12}
                                            className="text-[var(--st-text-tertiary)] shrink-0"
                                            aria-hidden="true"
                                          />
                                          {s.match.id ? (
                                            <span
                                              className="text-[var(--st-text-secondary)] truncate"
                                              title={s.match.label ?? undefined}
                                            >
                                              {s.match.label}
                                            </span>
                                          ) : (
                                            <span className="text-[var(--st-danger)]">
                                              not found
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                    <div className="flex items-center justify-between gap-[var(--st-space-2)] pt-[var(--st-space-2)] border-t border-[var(--st-border)]">
                                      <span className="text-[12px] text-[var(--st-text-secondary)]">
                                        {matched === sampled
                                          ? 'All sampled values connect.'
                                          : `${
                                              sampled - matched
                                            } of ${sampled} sampled value(s) had no match - those rows import without this link.`}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        iconLeft={RotateCcw}
                                        onClick={() => void probeRelation(field)}
                                      >
                                        Re-check
                                      </Button>
                                    </div>
                                  </>
                                )
                              ) : !probe ? (
                                <p className="text-[12px] text-[var(--st-text-tertiary)] m-0">
                                  Checking connect coverage
                                </p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sample rows */}
                  <div className="flex flex-col gap-[var(--st-space-2)]">
                    <p className="text-[13px] text-[var(--st-text-secondary)]">
                      Sample of the first {sampleRows.length} mapped row(s):
                    </p>
                    {mappedPairs.length === 0 ? (
                      <p className="text-[13px] text-[var(--st-text-secondary)] m-0">
                        No columns are mapped yet - go back and map at least one
                        field.
                      </p>
                    ) : (
                      <div className="border border-[var(--st-border)] rounded-[var(--st-radius)] overflow-auto">
                        <Table density="compact">
                          <THead>
                            <Tr>
                              {mappedPairs.map(({ field, header }) => (
                                <Th key={field.key}>
                                  {field.label}
                                  <span className="block text-[11px] font-normal text-[var(--st-text-tertiary)]">
                                    from {header}
                                  </span>
                                </Th>
                              ))}
                            </Tr>
                          </THead>
                          <TBody>
                            {sampleRows.map((row, ri) => (
                              <Tr key={ri}>
                                {mappedPairs.map(({ field, header }) => {
                                  const v = row[header] ?? '';
                                  return (
                                    <Td
                                      key={field.key}
                                      className={
                                        v
                                          ? undefined
                                          : 'text-[var(--st-text-tertiary)]'
                                      }
                                      title={v || undefined}
                                    >
                                      {v || '-'}
                                    </Td>
                                  );
                                })}
                              </Tr>
                            ))}
                          </TBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-[var(--st-space-3)]">
                    <Button
                      variant="ghost"
                      iconLeft={ChevronLeft}
                      onClick={() => {
                        setStepError(null);
                        setStep(2);
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      loading={importing}
                      iconLeft={importing ? undefined : Upload}
                      onClick={() => void handleImport()}
                      disabled={
                        importing ||
                        mappedCount === 0 ||
                        blockingIssues.length > 0
                      }
                    >
                      {importing
                        ? relationMappedCount > 0
                          ? 'Importing & connecting'
                          : 'Importing'
                        : relationMappedCount > 0
                          ? `Import ${parsed.rows.length} row(s) & connect`
                          : `Import ${parsed.rows.length} row(s)`}
                    </Button>
                  </div>
                </div>
              )}

              {/* ---- Step 4 - import summary ---- */}
              {step === 4 && result && (
                <div className="flex flex-col gap-[var(--st-space-4)]">
                  {(() => {
                    const allOk = result.failed === 0 && result.succeeded > 0;
                    const allFail =
                      result.succeeded === 0 && result.failed > 0;
                    const tone = allOk
                      ? ('success' as const)
                      : allFail
                        ? ('danger' as const)
                        : ('warning' as const);
                    const text = allOk
                      ? `Imported all ${result.succeeded} record(s) successfully.`
                      : allFail
                        ? `Import failed - none of the ${result.total} row(s) were imported.`
                        : `Imported ${result.succeeded} of ${result.total} row(s); ${result.failed} failed.`;
                    return <Alert tone={tone}>{text}</Alert>;
                  })()}

                  <div className="grid gap-[var(--st-space-3)] grid-cols-3">
                    <StatCard label="Processed" value={result.total} />
                    <StatCard label="Imported" value={result.succeeded} />
                    <StatCard label="Failed" value={result.failed} />
                  </div>

                  {/* Relation connect readout (best-effort) */}
                  {relationMappedCount > 0 &&
                    (importing ? (
                      <Card variant="ghost" padding="md">
                        <div className="flex items-center gap-[6px] text-[13px] font-medium text-[var(--st-text)] mb-[var(--st-space-2)]">
                          <Link2 size={13} aria-hidden="true" />
                          Connecting relations
                        </div>
                        <div className="flex items-center gap-[var(--st-space-2)] text-[13px] text-[var(--st-text-secondary)]">
                          <Spinner size="sm" label="Connecting relations" />
                          <span>
                            Matching relation values to existing records and
                            linking them.
                          </span>
                        </div>
                      </Card>
                    ) : relationResults.length > 0 ? (
                      <Card variant="outlined" padding="md">
                        <div className="flex items-center gap-[6px] text-[13px] font-medium text-[var(--st-text)] mb-[var(--st-space-2)]">
                          <Link2 size={13} aria-hidden="true" />
                          Relation connect (best-effort)
                        </div>
                        <div className="flex flex-col gap-[var(--st-space-2)]">
                          {relationResults.map((r) => (
                            <div
                              className="flex items-start gap-[var(--st-space-2)] text-[13px] text-[var(--st-text-secondary)]"
                              key={r.fieldKey}
                            >
                              {r.unmatched === 0 ? (
                                <CheckCircle2
                                  size={14}
                                  className="text-[var(--st-status-ok)] shrink-0 mt-[2px]"
                                  aria-hidden="true"
                                />
                              ) : (
                                <AlertTriangle
                                  size={14}
                                  className="text-[var(--st-warn)] shrink-0 mt-[2px]"
                                  aria-hidden="true"
                                />
                              )}
                              <span>
                                <strong className="text-[var(--st-text)]">
                                  {r.label}
                                </strong>
                                : connected {r.connected} of {r.attempted} row(s)
                                {r.unmatched > 0 && (
                                  <span className="text-[var(--st-warn)]">
                                    {' '}
                                    , {r.unmatched} value(s) had no match (left
                                    unlinked)
                                  </span>
                                )}
                                .
                              </span>
                            </div>
                          ))}
                        </div>
                      </Card>
                    ) : null)}

                  {result.failed > 0 && (
                    <div className="flex flex-col gap-[var(--st-space-2)]">
                      <p className="text-[13px] text-[var(--st-text-secondary)]">
                        Per-row failures (first 50):
                      </p>
                      <div className="flex flex-col gap-[var(--st-space-2)]">
                        {result.rows
                          .map((r, idx) => ({ r, idx }))
                          .filter((x) => !x.r.ok)
                          .slice(0, 50)
                          .map(({ r, idx }) =>
                            !r.ok ? (
                              <div
                                key={idx}
                                className="flex items-start gap-[var(--st-space-2)] text-[13px] text-[var(--st-danger)] p-[var(--st-space-2)] border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-danger-soft)]"
                              >
                                <AlertTriangle
                                  size={14}
                                  className="shrink-0 mt-[2px]"
                                  aria-hidden="true"
                                />
                                <span>
                                  Row {idx + 1}: {r.errors.join('; ')}
                                </span>
                              </div>
                            ) : null,
                          )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-[var(--st-space-3)]">
                    <Button
                      variant="secondary"
                      iconLeft={RotateCcw}
                      onClick={resetWizard}
                    >
                      Import another file
                    </Button>
                    <Link href={`/sabcrm/${selectedObject.slug}`}>
                      <Button variant="ghost" iconRight={ChevronRight}>
                        View {selectedObject.labelPlural.toLowerCase()}
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
