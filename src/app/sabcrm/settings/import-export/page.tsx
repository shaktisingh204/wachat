'use client';

/**
 * SabCRM — Import & Export (`/sabcrm/settings/import-export`), Twenty-style.
 *
 * A self-written Twenty-faithful rebuild using the shared `.st-*` kit
 * (`src/styles/sabcrm-twenty.css`) plus the page-local extras in
 * `../../reports/reports-twenty.css`. No ZoruUI / Tailwind / clay in the page
 * chrome — the ONLY ZoruUI piece is the `<SabFileToFileButton>` widget, used to
 * satisfy the project-wide SabFiles policy (every file input must come from the
 * SabFiles library / upload; never a free-text URL paste).
 *
 * Flow:
 *   - Object selector (`listObjectsAction`) chooses the target object for both
 *     import and export.
 *   - Export: a Twenty CSV/XLSX dropdown that calls `exportRecordsAction` and
 *     hands the result to `downloadCsv` / `downloadXlsx`.
 *   - Import: a guided inline flow —
 *       1. Pick a CSV via SabFiles → parsed client-side with PapaParse.
 *       2. Suggested column→field mapping (`buildColumnMappingSuggestionsAction`),
 *          editable per field, validated live (`validateImportMappingAction`).
 *       3. Commit with `importRecordsAction`, then show a per-row summary.
 *
 * Auth / onboarding / RBACGuard are enforced by the parent SabCRM `layout.tsx`;
 * each action re-runs the full gate, so the page fails closed into an inline
 * error state.
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
  CheckCircle2,
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
// Import flow state machine
// ---------------------------------------------------------------------------

type ImportStage = 'pick' | 'map' | 'done';

interface ParsedFile {
  name: string;
  headers: string[];
  rows: RawRow[];
}

// ---------------------------------------------------------------------------
// Export control (Twenty-styled dropdown)
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
// Page
// ---------------------------------------------------------------------------

export default function SabcrmImportExportPage(): React.JSX.Element {
  const { activeProjectId } = useProject();

  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = React.useState<string>('');

  // Import sub-state
  const [stage, setStage] = React.useState<ImportStage>('pick');
  const [parsed, setParsed] = React.useState<ParsedFile | null>(null);
  const [mapping, setMapping] = React.useState<ColumnMapping>({});
  const [issues, setIssues] = React.useState<MappingValidationIssue[]>([]);
  const [importing, setImporting] = React.useState(false);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ImportBatchResult | null>(null);

  // ---- Load objects -------------------------------------------------------
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
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
      setLoading(false);
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

  // Reset the import flow whenever the target object changes.
  const resetImport = React.useCallback(() => {
    setStage('pick');
    setParsed(null);
    setMapping({});
    setIssues([]);
    setImportError(null);
    setResult(null);
  }, []);

  const handleObjectChange = React.useCallback(
    (slug: string) => {
      setSelectedSlug(slug);
      resetImport();
    },
    [resetImport],
  );

  // ---- File picked (via SabFiles) → parse → suggest mapping ---------------
  const handleFile = React.useCallback(
    async (file: File) => {
      if (!selectedObject) return;
      setImportError(null);
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        setImportError('Please export your spreadsheet as CSV before importing.');
        return;
      }
      let text: string;
      try {
        text = await file.text();
      } catch {
        setImportError('Could not read the selected file.');
        return;
      }
      const { headers, rows } = parseCsv(text);
      if (headers.length === 0) {
        setImportError('The selected file has no column headers.');
        return;
      }
      if (rows.length === 0) {
        setImportError('The file has headers but no data rows.');
        return;
      }

      setParsed({ name: file.name, headers, rows });

      // Suggest a mapping, then validate it.
      const sug = await buildColumnMappingSuggestionsAction(
        selectedObject.slug,
        headers,
        activeProjectId ?? undefined,
      );
      const initialMapping: ColumnMapping = sug.ok ? sug.data : {};
      setMapping(initialMapping);

      const val = await validateImportMappingAction(
        selectedObject.slug,
        initialMapping,
        headers,
        activeProjectId ?? undefined,
      );
      setIssues(val.ok ? val.data : []);
      setStage('map');
    },
    [selectedObject, activeProjectId],
  );

  // ---- Re-validate when the user edits the mapping ------------------------
  const revalidate = React.useCallback(
    async (next: ColumnMapping) => {
      if (!selectedObject || !parsed) return;
      const val = await validateImportMappingAction(
        selectedObject.slug,
        next,
        parsed.headers,
        activeProjectId ?? undefined,
      );
      setIssues(val.ok ? val.data : []);
    },
    [selectedObject, parsed, activeProjectId],
  );

  const setFieldColumn = React.useCallback(
    (fieldKey: string, header: string) => {
      setMapping((prev) => {
        const next = { ...prev };
        if (header) next[fieldKey] = header;
        else delete next[fieldKey];
        void revalidate(next);
        return next;
      });
    },
    [revalidate],
  );

  const mappedCount = Object.keys(mapping).length;
  const blockingIssues = issues.length > 0;

  // ---- Commit -------------------------------------------------------------
  const handleImport = React.useCallback(async () => {
    if (!selectedObject || !parsed) return;
    setImporting(true);
    setImportError(null);
    const res = await importRecordsAction(
      {
        object: selectedObject.slug,
        columnMapping: mapping,
        rows: parsed.rows,
      },
      activeProjectId ?? undefined,
    );
    setImporting(false);
    if (!res.ok) {
      setImportError(res.error);
      return;
    }
    setResult(res.data);
    setStage('done');
  }, [selectedObject, parsed, mapping, activeProjectId]);

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
        through a guided column-mapping step.
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

          {/* Import */}
          <div className="st-section">
            <div className="st-section__head">
              <div className="st-section__head-text">
                <h2 className="st-section__title">
                  Import {selectedObject.labelPlural.toLowerCase()}
                </h2>
                <p className="st-section__desc">
                  Upload a CSV file, map its columns to{' '}
                  {selectedObject.labelSingular.toLowerCase()} fields, and commit.
                </p>
              </div>
              {stage !== 'pick' && (
                <div className="st-section__head-actions">
                  <button
                    type="button"
                    className="st-btn st-btn--ghost"
                    onClick={resetImport}
                  >
                    <RotateCcw size={14} aria-hidden="true" />
                    Start over
                  </button>
                </div>
              )}
            </div>

            <div className="st-section__body">
              {/* Step indicator */}
              <div className="st-iox-steps">
                {(['pick', 'map', 'done'] as const).map((s, i) => {
                  const labels = ['Upload', 'Map columns', 'Done'];
                  const order: ImportStage[] = ['pick', 'map', 'done'];
                  const current = order.indexOf(stage);
                  const cls =
                    s === stage ? 'is-active' : i < current ? 'is-done' : '';
                  return (
                    <React.Fragment key={s}>
                      {i > 0 && <span className="st-iox-step__sep" aria-hidden="true" />}
                      <span className={`st-iox-step ${cls}`}>
                        <span className="st-iox-step__dot">{i + 1}</span>
                        {labels[i]}
                      </span>
                    </React.Fragment>
                  );
                })}
              </div>

              {importError && (
                <div className="st-iox-issue" style={{ marginBottom: 'var(--st-space-3)' }}>
                  <AlertTriangle size={14} aria-hidden="true" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Step 1 — pick file */}
              {stage === 'pick' && (
                <div className="st-iox-drop">
                  <Upload size={22} aria-hidden="true" />
                  <p className="st-muted" style={{ margin: 0 }}>
                    Pick a CSV file from your SabFiles library or upload a new one.
                  </p>
                  <SabFileToFileButton
                    accept="all"
                    onPickFile={(file) => handleFile(file)}
                    onError={(e) => setImportError(e.message)}
                  >
                    <Upload size={14} aria-hidden="true" /> Choose CSV
                  </SabFileToFileButton>
                </div>
              )}

              {/* Step 2 — map columns */}
              {stage === 'map' && parsed && (
                <div className="st-stack">
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

                  {issues.length > 0 && (
                    <div>
                      {issues.map((iss, i) => (
                        <div className="st-iox-issue" key={i}>
                          <AlertTriangle size={14} aria-hidden="true" />
                          <span>{iss.message}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 'var(--st-space-2)',
                    }}
                  >
                    <button
                      type="button"
                      className="st-btn st-btn--primary"
                      onClick={() => void handleImport()}
                      disabled={importing || mappedCount === 0 || blockingIssues}
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
              )}

              {/* Step 3 — summary */}
              {stage === 'done' && result && (
                <div className="st-stack">
                  <div className="st-iox-summary">
                    <div className="st-iox-summary__tile">
                      <div className="st-iox-summary__num">{result.total}</div>
                      <div className="st-iox-summary__cap">Processed</div>
                    </div>
                    <div className="st-iox-summary__tile">
                      <div className="st-iox-summary__num">{result.succeeded}</div>
                      <div className="st-iox-summary__cap">Imported</div>
                    </div>
                    <div className="st-iox-summary__tile">
                      <div className="st-iox-summary__num">{result.failed}</div>
                      <div className="st-iox-summary__cap">Failed</div>
                    </div>
                  </div>

                  {result.failed > 0 && (
                    <div>
                      <p className="st-muted">First failures:</p>
                      {result.rows
                        .map((r, idx) => ({ r, idx }))
                        .filter((x) => !x.r.ok)
                        .slice(0, 10)
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
                  )}

                  <div style={{ display: 'flex', gap: 'var(--st-space-2)' }}>
                    <button
                      type="button"
                      className="st-btn st-btn--secondary"
                      onClick={resetImport}
                    >
                      Import another file
                    </button>
                    <Link
                      href={`/sabcrm/${selectedObject.slug}`}
                      className="st-btn st-btn--ghost"
                    >
                      View {selectedObject.labelPlural.toLowerCase()}
                    </Link>
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
