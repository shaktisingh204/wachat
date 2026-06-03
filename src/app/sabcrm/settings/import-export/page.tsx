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
 *                        `buildColumnMappingSuggestionsAction`.
 *   3. Preview         — `validateImportMappingAction` gives blocking issues;
 *                        we add soft warnings + a sample-rows preview table and
 *                        a row-count / mapped-column readout.
 *   4. Import          — `importRecordsAction` runs the batch and we render a
 *                        success / partial / failure summary with per-row errors.
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
} from 'lucide-react';

import {
  listObjectsAction,
  exportRecordsAction,
  buildColumnMappingSuggestionsAction,
  validateImportMappingAction,
  importRecordsAction,
} from '@/app/actions/sabcrm.actions';
import { useProject } from '@/context/project-context';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';
import { SabFileToFileButton } from '@/components/sabfiles';
import type { ObjectMetadata, FieldMetadata } from '@/lib/sabcrm/types';
import type {
  ColumnMapping,
  MappingValidationIssue,
} from '@/app/actions/sabcrm.actions.types';
import type {
  RawRow,
  ImportBatchResult,
  ExportRecordsResult,
} from '@/lib/sabcrm/import-export.server';

import '../../reports/reports-twenty.css';
import './import-wizard.css';

// ---------------------------------------------------------------------------
// Field-type gating: which fields can be imported from a spreadsheet.
// (RELATION + FILE are not importable — they need resolved ids / uploads.)
// ---------------------------------------------------------------------------

function importableFields(object: ObjectMetadata): FieldMetadata[] {
  return object.fields.filter(
    (f) => !f.system && f.type !== 'RELATION' && f.type !== 'FILE',
  );
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
  const [issues, setIssues] = React.useState<MappingValidationIssue[]>([]);
  const [validating, setValidating] = React.useState(false);
  const [stepError, setStepError] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [result, setResult] = React.useState<ImportBatchResult | null>(null);

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

  // Reset the whole wizard (used on object change + "start over").
  const resetWizard = React.useCallback(() => {
    setStep(1);
    setParsed(null);
    setMapping({});
    setIssues([]);
    setStepError(null);
    setResult(null);
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
      setIssues([]);
    },
    [selectedObject],
  );

  const clearFile = React.useCallback(() => {
    setParsed(null);
    setMapping({});
    setIssues([]);
    setStepError(null);
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

  // ---- Step 4 — commit the import ----------------------------------------
  const handleImport = React.useCallback(async () => {
    if (!selectedObject || !parsed) return;
    setStepError(null);
    setImporting(true);
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
    } catch (e) {
      setStepError(e instanceof Error ? e.message : 'Failed to import records.');
    } finally {
      setImporting(false);
    }
  }, [selectedObject, parsed, mapping, activeProjectId]);

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
    const ignoredHeaders = parsed.headers.filter((h) => !usedHeaders.has(h));
    if (ignoredHeaders.length > 0) {
      out.push(
        `${ignoredHeaders.length} CSV column(s) are not mapped and will be ignored: ${ignoredHeaders
          .slice(0, 6)
          .join(', ')}${ignoredHeaders.length > 6 ? '…' : ''}.`,
      );
    }
    return out;
  }, [parsed, fields, mapping]);

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
                    </p>
                  </div>

                  <div className="st-pill">
                    <CheckCircle2 size={14} aria-hidden="true" />
                    <span>
                      {parsed.name} — {parsed.rows.length} row(s),{' '}
                      {parsed.headers.length} column(s) · {mappedCount} field(s)
                      mapped
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
                          ? 'Importing…'
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
