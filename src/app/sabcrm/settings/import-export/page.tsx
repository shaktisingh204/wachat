'use client';

/**
 * SabCRM — Import & Export (`/sabcrm/settings/import-export`), Twenty-style.
 *
 * A self-written Twenty-faithful rebuild using the shared `.st-*` kit
 * (`src/styles/sabcrm-twenty.css`), the reports extras (`reports-twenty.css`),
 * and the page-local wizard extras (`./import-wizard.css`). No ZoruUI /
 * Tailwind / clay in the page chrome — the ONLY ZoruUI piece is the
 * `<SabFileToFileButton>` widget, used to satisfy the project-wide SabFiles
 * policy (every file input must come from the SabFiles library / upload; never
 * a free-text URL paste).
 *
 * The import side is a Twenty-style 4-step IMPORT WIZARD:
 *
 *   1. Object & file   — choose the target object, then pick a CSV via SabFiles
 *                        (parsed client-side with PapaParse).
 *   2. Map columns     — CSV header → object-field select, pre-filled from
 *                        `buildColumnMappingSuggestionsAction`. RELATION fields
 *                        are also mappable here (Twenty's "connect on import"):
 *                        a relation column resolves each CSV value to an
 *                        EXISTING related record and stores its id. Each
 *                        relation row gets a "match by" sub-select naming which
 *                        field of the target object to match on.
 *   3. Preview         — `validateImportMappingAction` gives blocking issues;
 *                        we add soft warnings + a sample-rows preview table and
 *                        a row-count / mapped-column readout. For every relation
 *                        column we probe a sample of distinct values through
 *                        `searchRecordsForPickerAction` and show ✓ found / ✗ not
 *                        found per value plus an overall connect-coverage badge.
 *   4. Import          — `importRecordsAction` runs the (non-relation) batch,
 *                        then — best-effort — we resolve each created record's
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
 * Export keeps its own Twenty CSV/XLSX dropdown (`exportRecordsAction` →
 * `downloadCsv` / `downloadXlsx`) and is unaffected by the wizard.
 *
 * Auth / onboarding / RBACGuard are enforced by the parent SabCRM `layout.tsx`;
 * each action re-runs the full gate, so the page fails closed into an inline
 * error state. Every step traps its own errors so one failed action never wedges
 * the wizard — the user can retry or step back.
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

import '../../reports/reports-twenty.css';
import './import-wizard.css';
import './relation-map.css';

// ---------------------------------------------------------------------------
// Field-type gating: which fields can be imported from a spreadsheet.
//
// FLAT fields (everything except RELATION + FILE) flow through the normal
// server import (`importRecordsAction`). RELATION fields are NOT importable as
// flat values — but they CAN be "connected" on import (Twenty-style) by
// matching each CSV value to an existing related record and storing its id.
// FILE fields stay excluded (they need real uploads, not ids).
// ---------------------------------------------------------------------------

function importableFields(object: ObjectMetadata): FieldMetadata[] {
  return object.fields.filter(
    (f) => !f.system && f.type !== 'RELATION' && f.type !== 'FILE',
  );
}

/**
 * RELATION fields that point at a known target object — the ones eligible for
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
 * choice mirrors Twenty's connect UX and lets the user document intent).
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
// Relation connect — resolve a CSV value to an existing related-record id.
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
    // best-effort — leave as a miss
  }
  cache.set(key, match);
  return match;
}

// ---------------------------------------------------------------------------
// Import wizard state machine — a linear 4-step flow.
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
  /** A capped list of sampled value → match outcomes for display. */
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
// Export control (Twenty-styled dropdown) — unchanged, keeps export working.
// ---------------------------------------------------------------------------

function ExportControl({
  object,
  projectId,
}: {
  object: ObjectMetadata;
  projectId?: string;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const run = React.useCallback(
    async (format: 'csv' | 'xlsx') => {
      setOpen(false);
      setBusy(true);
      setMsg(null);
      try {
        const res = await exportRecordsAction({ object: object.slug }, projectId);
        if (!res.ok) {
          setMsg({ ok: false, text: res.error });
          return;
        }
        const data = res.data as ExportRecordsResult;
        const filename = `${object.slug}-${dateStamp()}.${format}`;
        if (format === 'csv') {
          downloadCsv(filename, data.headers, data.rows);
        } else {
          await downloadXlsx(filename, data.headers, data.rows, object.labelPlural);
        }
        setMsg({
          ok: true,
          text: `Exported ${data.rows.length} ${object.labelPlural.toLowerCase()}.`,
        });
      } catch (e) {
        setMsg({
          ok: false,
          text: e instanceof Error ? e.message : 'Export failed.',
        });
      } finally {
        setBusy(false);
      }
    },
    [object, projectId],
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--st-space-3)' }}>
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          type="button"
          className="st-btn st-btn--secondary"
          onClick={() => setOpen((v) => !v)}
          disabled={busy}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {busy ? (
            <span className="st-spinner" aria-hidden="true" />
          ) : (
            <Download size={14} aria-hidden="true" />
          )}
          {busy ? 'Exporting…' : 'Export'}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
        {open && (
          <div
            role="menu"
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              right: 0,
              zIndex: 20,
              minWidth: 160,
              padding: 4,
              border: '1px solid var(--st-border)',
              borderRadius: 'var(--st-radius)',
              background: 'var(--st-bg)',
              boxShadow: 'var(--st-shadow-pop)',
            }}
          >
            <button
              type="button"
              role="menuitem"
              className="st-btn st-btn--ghost"
              style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => void run('csv')}
            >
              Export as CSV
            </button>
            <button
              type="button"
              role="menuitem"
              className="st-btn st-btn--ghost"
              style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => void run('xlsx')}
            >
              Export as Excel
            </button>
          </div>
        )}
      </div>
      {msg && (
        <span
          className={msg.ok ? 'st-pill' : 'st-iox-issue'}
          style={{ margin: 0 }}
        >
          {msg.text}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step indicator — Twenty-style numbered stepper with connector rails.
// ---------------------------------------------------------------------------

function StepIndicator({ step }: { step: WizardStep }): React.JSX.Element {
  const steps: WizardStep[] = [1, 2, 3, 4];
  return (
    <div className="st-iw-steps" aria-label="Import progress">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          {i > 0 && (
            <span
              className={`st-iw-step__rail ${s <= step ? 'is-filled' : ''}`}
              aria-hidden="true"
            />
          )}
          <div
            className={`st-iw-step ${
              s === step ? 'is-active' : s < step ? 'is-done' : ''
            }`}
            aria-current={s === step ? 'step' : undefined}
          >
            <span className="st-iw-step__dot">
              {s < step ? <CheckCircle2 size={15} aria-hidden="true" /> : s}
            </span>
            <span className="st-iw-step__label">{STEP_LABELS[s]}</span>
          </div>
        </React.Fragment>
      ))}
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
  // RELATION fields mapped for connect-on-import: relation field key → entry.
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

  // ---- Step 1 — file picked (via SabFiles) → parse CSV --------------------
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
      // Successful parse — store the file but stay on step 1 so the user can
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

  // ---- Advance from step 1 → 2: fetch suggested mapping -------------------
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

  // ---- Advance from step 2 → 3: server-validate the mapping ---------------
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
  // off a sample resolution so the user sees ✓/✗ coverage without a manual
  // click. Re-probing on demand is also available from each coverage card.
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

  // ---- Step 4 — commit the import ----------------------------------------
  //
  // Two passes:
  //   1. Flat import via `importRecordsAction` (non-relation fields). This
  //      returns one result row per input row, IN ORDER, with the created
  //      record (+ id) for successes.
  //   2. Connect pass — best-effort. For every created record we resolve each
  //      mapped relation cell to an existing related-record id and patch it on
  //      via `updateRecordAction`. Unresolved values are skipped (left unset)
  //      and counted so the summary can show connect coverage. A connect
  //      failure NEVER fails the row — the record is already imported.
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
  // columns that won't be imported. These do NOT block the import.
  const warnings = React.useMemo<string[]>(() => {
    if (!parsed) return [];
    const out: string[] = [];
    const unmappedFields = fields.filter((f) => !f.required && !mapping[f.key]);
    if (unmappedFields.length > 0) {
      out.push(
        `${unmappedFields.length} field(s) are not mapped and will use their default value (if any): ${unmappedFields
          .map((f) => f.label)
          .slice(0, 6)
          .join(', ')}${unmappedFields.length > 6 ? '…' : ''}.`,
      );
    }
    const usedHeaders = new Set(Object.values(mapping));
    for (const e of Object.values(relationMap)) usedHeaders.add(e.header);
    const ignoredHeaders = parsed.headers.filter((h) => !usedHeaders.has(h));
    if (ignoredHeaders.length > 0) {
      out.push(
        `${ignoredHeaders.length} CSV column(s) are not mapped and will be ignored: ${ignoredHeaders
          .slice(0, 6)
          .join(', ')}${ignoredHeaders.length > 6 ? '…' : ''}.`,
      );
    }
    return out;
  }, [parsed, fields, mapping, relationMap]);

  // Count of relation fields wired up for connect-on-import.
  const relationMappedCount = Object.keys(relationMap).length;

  // Relation fields that are actually mapped, with their entry — used in the
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
    <div className="st-page">
      <Link href="/sabcrm/settings" className="st-back">
        Settings
      </Link>

      <header className="st-page-header">
        <span className="st-page-header__icon" aria-hidden="true">
          <Database size={16} />
        </span>
        <h1 className="st-page-header__title">Import &amp; Export</h1>
      </header>

      <p className="st-muted" style={{ marginBottom: 'var(--st-space-4)' }}>
        Bulk-load records into any object from a CSV file, or export an
        object&apos;s records back out. Pick an object to begin — imports run
        through a guided 4-step wizard.
      </p>

      {error && (
        <div className="st-banner" role="alert">
          <AlertTriangle className="st-banner__icon" size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Object selector */}
      <div className="st-section">
        <div className="st-section__head">
          <div className="st-section__head-text">
            <h2 className="st-section__title">Target object</h2>
            <p className="st-section__desc">
              Choose which object import and export operate on.
            </p>
          </div>
        </div>
        <div className="st-section__body">
          {loading ? (
            <div className="st-skeleton st-skeleton-row" style={{ maxWidth: 320 }} />
          ) : objects.length === 0 && !error ? (
            <div className="st-empty">
              <span className="st-empty__icon" aria-hidden="true">
                <Database size={20} />
              </span>
              <h3 className="st-empty__title">No objects available</h3>
              <p className="st-empty__desc">
                This project has no CRM objects to import into or export from yet.
              </p>
            </div>
          ) : (
            <div className="st-field" style={{ maxWidth: 320 }}>
              <label className="st-field__label" htmlFor="iox-object">
                Object
              </label>
              <select
                id="iox-object"
                className="st-select"
                value={selectedSlug}
                onChange={(e) => handleObjectChange(e.target.value)}
              >
                <option value="" disabled>
                  Select an object…
                </option>
                {objects.map((o) => (
                  <option key={o.slug} value={o.slug}>
                    {o.labelPlural}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {selectedObject && (
        <>
          {/* Export */}
          <div className="st-section">
            <div className="st-section__head">
              <div className="st-section__head-text">
                <h2 className="st-section__title">
                  Export {selectedObject.labelPlural.toLowerCase()}
                </h2>
                <p className="st-section__desc">
                  Download this object&apos;s records as a CSV or Excel file.
                </p>
              </div>
              <div className="st-section__head-actions">
                <ExportControl
                  object={selectedObject}
                  projectId={activeProjectId ?? undefined}
                />
              </div>
            </div>
          </div>

          {/* Import wizard */}
          <div className="st-section">
            <div className="st-section__head">
              <div className="st-section__head-text">
                <h2 className="st-section__title">
                  Import {selectedObject.labelPlural.toLowerCase()}
                </h2>
                <p className="st-section__desc">
                  A guided 4-step wizard: choose a file, map columns, preview, and
                  import.
                </p>
              </div>
              {(step !== 1 || parsed) && (
                <div className="st-section__head-actions">
                  <button
                    type="button"
                    className="st-btn st-btn--ghost"
                    onClick={resetWizard}
                  >
                    <RotateCcw size={14} aria-hidden="true" />
                    Start over
                  </button>
                </div>
              )}
            </div>

            <div className="st-section__body">
              <StepIndicator step={step} />

              {stepError && (
                <div
                  className="st-iox-issue"
                  style={{ marginBottom: 'var(--st-space-3)' }}
                  role="alert"
                >
                  <AlertTriangle size={14} aria-hidden="true" />
                  <span>{stepError}</span>
                </div>
              )}

              {/* ---- Step 1 — object confirmed + file pick ---- */}
              {step === 1 && (
                <div className="st-iw-body">
                  <div>
                    <h3 className="st-iw-step-title">Choose a CSV file</h3>
                    <p className="st-iw-step-hint">
                      Importing into{' '}
                      <strong>{selectedObject.labelPlural}</strong>. Pick a CSV
                      from your SabFiles library or upload a new one.
                    </p>
                  </div>

                  {parsed ? (
                    <div className="st-iw-file">
                      <FileText size={18} aria-hidden="true" />
                      <div className="st-iw-file__meta">
                        <span className="st-iw-file__name">{parsed.name}</span>
                        <span className="st-iw-file__sub">
                          {parsed.rows.length} row(s) · {parsed.headers.length}{' '}
                          column(s)
                        </span>
                      </div>
                      <button
                        type="button"
                        className="st-btn st-btn--ghost st-iw-file__clear"
                        onClick={clearFile}
                        aria-label="Remove file"
                      >
                        <X size={14} aria-hidden="true" />
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="st-iox-drop">
                      <Upload size={22} aria-hidden="true" />
                      <p className="st-muted" style={{ margin: 0 }}>
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

                  <div className="st-iw-nav">
                    <span />
                    <div className="st-iw-nav__right">
                      <button
                        type="button"
                        className="st-btn st-btn--primary"
                        onClick={() => void goToMapping()}
                        disabled={!parsed || validating}
                      >
                        {validating ? (
                          <span className="st-spinner" aria-hidden="true" />
                        ) : null}
                        Next: map columns
                        <ChevronRight size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ---- Step 2 — map columns ---- */}
              {step === 2 && parsed && (
                <div className="st-iw-body">
                  <div>
                    <h3 className="st-iw-step-title">Map columns to fields</h3>
                    <p className="st-iw-step-hint">
                      We pre-filled likely matches. Map each{' '}
                      {selectedObject.labelSingular.toLowerCase()} field to a CSV
                      column, or leave it as <em>Skip</em>.
                      {relationFields.length > 0 && (
                        <>
                          {' '}
                          Relation fields can be <strong>connected</strong> to
                          existing records by matching a CSV value.
                        </>
                      )}
                    </p>
                  </div>

                  <div className="st-pill">
                    <CheckCircle2 size={14} aria-hidden="true" />
                    <span>
                      {parsed.name} — {parsed.rows.length} row(s),{' '}
                      {parsed.headers.length} column(s) · {mappedCount} field(s)
                      mapped
                      {relationMappedCount > 0 &&
                        ` · ${relationMappedCount} relation(s) to connect`}
                    </span>
                  </div>

                  <div className="st-table-wrap">
                    <table className="st-table">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Type</th>
                          <th>CSV column</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((f) => (
                          <tr className="st-row" key={f.key}>
                            <td>
                              {f.label}
                              {f.required && (
                                <span className="st-field__req"> *</span>
                              )}
                            </td>
                            <td className="st-cell-muted">{f.type}</td>
                            <td>
                              <select
                                className="st-select"
                                value={mapping[f.key] ?? ''}
                                onChange={(e) =>
                                  setFieldColumn(f.key, e.target.value)
                                }
                              >
                                <option value="">— Skip —</option>
                                {parsed.headers.map((h) => (
                                  <option key={h} value={h}>
                                    {h}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* ---- Relation connect mapping ---- */}
                  {relationFields.length > 0 && (
                    <div>
                      <h3
                        className="st-iw-step-title"
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <Link2 size={14} aria-hidden="true" />
                        Connect relations
                      </h3>
                      <p className="st-iw-step-hint">
                        Map a CSV column to a relation to link each row to an{' '}
                        <strong>existing</strong> record. Choose which field of the
                        related object to match the column&apos;s values against.
                      </p>
                      <div className="st-table-wrap">
                        <table className="st-table">
                          <thead>
                            <tr>
                              <th>Relation</th>
                              <th>Links to</th>
                              <th>CSV column</th>
                            </tr>
                          </thead>
                          <tbody>
                            {relationFields.map((f) => {
                              const target = targetFor(f);
                              const entry = relationMap[f.key];
                              const choices = matchByFields(target);
                              return (
                                <tr className="st-row" key={f.key}>
                                  <td>
                                    {f.label}
                                    {f.required && (
                                      <span className="st-field__req"> *</span>
                                    )}
                                  </td>
                                  <td className="st-cell-muted">
                                    {target
                                      ? target.labelPlural
                                      : f.relation?.targetObject ?? '—'}
                                  </td>
                                  <td>
                                    <select
                                      className="st-select"
                                      value={entry?.header ?? ''}
                                      onChange={(e) =>
                                        setRelationColumn(f, e.target.value)
                                      }
                                    >
                                      <option value="">— Skip —</option>
                                      {parsed.headers.map((h) => (
                                        <option key={h} value={h}>
                                          {h}
                                        </option>
                                      ))}
                                    </select>
                                    {entry?.header && (
                                      <div className="st-rc-matchby">
                                        <span className="st-rc-matchby__label">
                                          Match by
                                        </span>
                                        <select
                                          className="st-select"
                                          value={entry.matchBy}
                                          onChange={(e) =>
                                            setRelationMatchBy(
                                              f.key,
                                              e.target.value,
                                            )
                                          }
                                          aria-label={`Match ${f.label} by`}
                                        >
                                          {choices.map((c) => (
                                            <option key={c.key} value={c.key}>
                                              {c.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="st-iw-nav">
                    <button
                      type="button"
                      className="st-btn st-btn--ghost"
                      onClick={() => {
                        setStepError(null);
                        setStep(1);
                      }}
                    >
                      <ChevronLeft size={14} aria-hidden="true" />
                      Back
                    </button>
                    <div className="st-iw-nav__right">
                      <button
                        type="button"
                        className="st-btn st-btn--primary"
                        onClick={() => void goToPreview()}
                        disabled={mappedCount === 0 || validating}
                      >
                        {validating ? (
                          <span className="st-spinner" aria-hidden="true" />
                        ) : null}
                        Next: preview
                        <ChevronRight size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ---- Step 3 — preview + validate ---- */}
              {step === 3 && parsed && (
                <div className="st-iw-body">
                  <div>
                    <h3 className="st-iw-step-title">Preview &amp; validate</h3>
                    <p className="st-iw-step-hint">
                      Review what will be imported. Fix any blocking issues before
                      continuing.
                    </p>
                  </div>

                  <div className="st-iw-stats">
                    <div className="st-iw-stat">
                      <div className="st-iw-stat__num">{parsed.rows.length}</div>
                      <div className="st-iw-stat__cap">Rows to import</div>
                    </div>
                    <div className="st-iw-stat">
                      <div className="st-iw-stat__num">{mappedCount}</div>
                      <div className="st-iw-stat__cap">Mapped columns</div>
                    </div>
                    {relationMappedCount > 0 && (
                      <div className="st-iw-stat">
                        <div className="st-iw-stat__num">
                          {relationMappedCount}
                        </div>
                        <div className="st-iw-stat__cap">Relations to connect</div>
                      </div>
                    )}
                    <div className="st-iw-stat">
                      <div className="st-iw-stat__num">{blockingIssues.length}</div>
                      <div className="st-iw-stat__cap">Blocking issues</div>
                    </div>
                  </div>

                  {/* Blocking issues */}
                  {blockingIssues.length > 0 && (
                    <div className="st-iw-issues st-iw-issues--error">
                      <div className="st-iw-issues__head">
                        <AlertTriangle size={13} aria-hidden="true" />
                        Blocking issues
                      </div>
                      {blockingIssues.map((iss, i) => (
                        <div className="st-iox-issue" key={i}>
                          <AlertTriangle size={14} aria-hidden="true" />
                          <span>{iss.message}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Soft warnings */}
                  {warnings.length > 0 && (
                    <div className="st-iw-issues st-iw-issues--warn">
                      <div className="st-iw-issues__head">
                        <AlertTriangle size={13} aria-hidden="true" />
                        Warnings
                      </div>
                      {warnings.map((w, i) => (
                        <div className="st-iw-warn-row" key={i}>
                          <AlertTriangle size={14} aria-hidden="true" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {blockingIssues.length === 0 && (
                    <div className="st-iw-ok">
                      <CheckCircle2 size={15} aria-hidden="true" />
                      <span>
                        No blocking issues — ready to import {parsed.rows.length}{' '}
                        row(s).
                      </span>
                    </div>
                  )}

                  {/* ---- Relation connect coverage ---- */}
                  {mappedRelations.length > 0 && (
                    <div>
                      <p
                        className="st-iw-step-hint"
                        style={{
                          marginBottom: 6,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Link2 size={13} aria-hidden="true" />
                        Relation connect coverage — a sample of distinct values is
                        matched against existing records.
                      </p>
                      <div className="st-rc-coverage">
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
                            <div className="st-rc-card" key={field.key}>
                              <div className="st-rc-card__head">
                                <span className="st-rc-card__title">
                                  <Link2 size={13} aria-hidden="true" />
                                  {field.label}
                                  <span className="st-rc-card__sub">
                                    {entry.header} →{' '}
                                    {target?.labelPlural ??
                                      field.relation?.targetObject}
                                  </span>
                                </span>
                                {probe?.loading ? (
                                  <span
                                    className="st-rc-badge"
                                    style={{ gap: 6 }}
                                  >
                                    <span
                                      className="st-spinner"
                                      aria-hidden="true"
                                    />
                                    Checking…
                                  </span>
                                ) : badge ? (
                                  <span
                                    className={`st-rc-badge st-rc-badge--${badge}`}
                                  >
                                    {badge === 'ok' ? (
                                      <CheckCircle2
                                        size={12}
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <AlertTriangle
                                        size={12}
                                        aria-hidden="true"
                                      />
                                    )}
                                    {matched}/{sampled} matched
                                  </span>
                                ) : null}
                              </div>
                              {probe && !probe.loading ? (
                                probe.samples.length === 0 ? (
                                  <div className="st-rc-empty">
                                    No non-empty values found in this column to
                                    match.
                                  </div>
                                ) : (
                                  <>
                                    <div className="st-rc-samples">
                                      {probe.samples.map((s, si) => (
                                        <div className="st-rc-sample" key={si}>
                                          <span
                                            className={`st-rc-sample__icon ${
                                              s.match.id
                                                ? 'st-rc-sample__icon--ok'
                                                : 'st-rc-sample__icon--miss'
                                            }`}
                                            aria-hidden="true"
                                          >
                                            {s.match.id ? (
                                              <CheckCircle2 size={14} />
                                            ) : (
                                              <XCircle size={14} />
                                            )}
                                          </span>
                                          <span
                                            className="st-rc-sample__val"
                                            title={s.value}
                                          >
                                            {s.value}
                                          </span>
                                          <ArrowRight
                                            size={12}
                                            className="st-rc-sample__arrow"
                                            aria-hidden="true"
                                          />
                                          {s.match.id ? (
                                            <span
                                              className="st-rc-sample__hit"
                                              title={s.match.label ?? undefined}
                                            >
                                              {s.match.label}
                                            </span>
                                          ) : (
                                            <span className="st-rc-sample__hit st-rc-sample__hit--miss">
                                              not found
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                    <div className="st-rc-card__foot">
                                      <span>
                                        {matched === sampled
                                          ? 'All sampled values connect.'
                                          : `${
                                              sampled - matched
                                            } of ${sampled} sampled value(s) had no match — those rows import without this link.`}
                                      </span>
                                      <button
                                        type="button"
                                        className="st-btn st-btn--ghost"
                                        onClick={() =>
                                          void probeRelation(field)
                                        }
                                      >
                                        <RotateCcw
                                          size={12}
                                          aria-hidden="true"
                                        />
                                        Re-check
                                      </button>
                                    </div>
                                  </>
                                )
                              ) : !probe ? (
                                <div className="st-rc-empty">
                                  Checking connect coverage…
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sample rows */}
                  <div>
                    <p className="st-iw-step-hint" style={{ marginBottom: 6 }}>
                      Sample of the first {sampleRows.length} mapped row(s):
                    </p>
                    {mappedPairs.length === 0 ? (
                      <p className="st-muted" style={{ margin: 0 }}>
                        No columns are mapped yet — go back and map at least one
                        field.
                      </p>
                    ) : (
                      <div className="st-iw-preview">
                        <table>
                          <thead>
                            <tr>
                              {mappedPairs.map(({ field, header }) => (
                                <th key={field.key}>
                                  {field.label}
                                  <span className="st-iw-preview__src">
                                    ← {header}
                                  </span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sampleRows.map((row, ri) => (
                              <tr key={ri}>
                                {mappedPairs.map(({ field, header }) => {
                                  const v = row[header] ?? '';
                                  return (
                                    <td
                                      key={field.key}
                                      className={v ? undefined : 'is-empty'}
                                      title={v || undefined}
                                    >
                                      {v || '—'}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="st-iw-nav">
                    <button
                      type="button"
                      className="st-btn st-btn--ghost"
                      onClick={() => {
                        setStepError(null);
                        setStep(2);
                      }}
                    >
                      <ChevronLeft size={14} aria-hidden="true" />
                      Back
                    </button>
                    <div className="st-iw-nav__right">
                      <button
                        type="button"
                        className="st-btn st-btn--primary"
                        onClick={() => void handleImport()}
                        disabled={
                          importing ||
                          mappedCount === 0 ||
                          blockingIssues.length > 0
                        }
                      >
                        {importing ? (
                          <span className="st-spinner" aria-hidden="true" />
                        ) : (
                          <Upload size={14} aria-hidden="true" />
                        )}
                        {importing
                          ? relationMappedCount > 0
                            ? 'Importing & connecting…'
                            : 'Importing…'
                          : relationMappedCount > 0
                            ? `Import ${parsed.rows.length} row(s) & connect`
                            : `Import ${parsed.rows.length} row(s)`}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ---- Step 4 — import summary ---- */}
              {step === 4 && result && (
                <div className="st-iw-body">
                  {(() => {
                    const allOk = result.failed === 0 && result.succeeded > 0;
                    const allFail =
                      result.succeeded === 0 && result.failed > 0;
                    const cls = allOk
                      ? 'st-iw-result-banner--ok'
                      : allFail
                        ? 'st-iw-result-banner--fail'
                        : 'st-iw-result-banner--partial';
                    const Icon = allOk ? CheckCircle2 : AlertTriangle;
                    const text = allOk
                      ? `Imported all ${result.succeeded} record(s) successfully.`
                      : allFail
                        ? `Import failed — none of the ${result.total} row(s) were imported.`
                        : `Imported ${result.succeeded} of ${result.total} row(s); ${result.failed} failed.`;
                    return (
                      <div className={`st-iw-result-banner ${cls}`} role="status">
                        <Icon size={16} aria-hidden="true" />
                        <span>{text}</span>
                      </div>
                    );
                  })()}

                  <div className="st-iw-stats">
                    <div className="st-iw-stat">
                      <div className="st-iw-stat__num">{result.total}</div>
                      <div className="st-iw-stat__cap">Processed</div>
                    </div>
                    <div className="st-iw-stat">
                      <div className="st-iw-stat__num">{result.succeeded}</div>
                      <div className="st-iw-stat__cap">Imported</div>
                    </div>
                    <div className="st-iw-stat">
                      <div className="st-iw-stat__num">{result.failed}</div>
                      <div className="st-iw-stat__cap">Failed</div>
                    </div>
                  </div>

                  {/* Relation connect readout (best-effort) */}
                  {relationMappedCount > 0 &&
                    (importing ? (
                      <div className="st-rc-result">
                        <div className="st-rc-result__head">
                          <Link2 size={13} aria-hidden="true" />
                          Connecting relations
                        </div>
                        <div className="st-rc-result__row">
                          <span className="st-spinner" aria-hidden="true" />
                          <span>
                            Matching relation values to existing records and
                            linking them…
                          </span>
                        </div>
                      </div>
                    ) : relationResults.length > 0 ? (
                      <div className="st-rc-result">
                        <div className="st-rc-result__head">
                          <Link2 size={13} aria-hidden="true" />
                          Relation connect (best-effort)
                        </div>
                        {relationResults.map((r) => (
                          <div className="st-rc-result__row" key={r.fieldKey}>
                            {r.unmatched === 0 ? (
                              <CheckCircle2 size={14} aria-hidden="true" />
                            ) : (
                              <AlertTriangle size={14} aria-hidden="true" />
                            )}
                            <span>
                              <strong>{r.label}</strong>: connected{' '}
                              {r.connected} of {r.attempted} row(s)
                              {r.unmatched > 0 && (
                                <span className="st-rc-result__miss">
                                  {' '}
                                  · {r.unmatched} value(s) had no match (left
                                  unlinked)
                                </span>
                              )}
                              .
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null)}

                  {result.failed > 0 && (
                    <div>
                      <p className="st-iw-step-hint" style={{ marginBottom: 6 }}>
                        Per-row failures (first 50):
                      </p>
                      <div className="st-iw-failures">
                        {result.rows
                          .map((r, idx) => ({ r, idx }))
                          .filter((x) => !x.r.ok)
                          .slice(0, 50)
                          .map(({ r, idx }) =>
                            !r.ok ? (
                              <div className="st-iox-issue" key={idx}>
                                <AlertTriangle size={14} aria-hidden="true" />
                                <span>
                                  Row {idx + 1}: {r.errors.join('; ')}
                                </span>
                              </div>
                            ) : null,
                          )}
                      </div>
                    </div>
                  )}

                  <div className="st-iw-nav">
                    <button
                      type="button"
                      className="st-btn st-btn--secondary"
                      onClick={resetWizard}
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                      Import another file
                    </button>
                    <div className="st-iw-nav__right">
                      <Link
                        href={`/sabcrm/${selectedObject.slug}`}
                        className="st-btn st-btn--ghost"
                      >
                        View {selectedObject.labelPlural.toLowerCase()}
                        <ChevronRight size={14} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
